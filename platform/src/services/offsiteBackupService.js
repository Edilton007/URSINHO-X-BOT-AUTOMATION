"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const API_BASE = "https://api.cloudflare.com/client/v4";
const DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024;
// O processo do bot também mantém a sessão Baileys em memória.
// Limitar a recolha reduz picos de RAM em servidores gratuitos pequenos.
const MAX_TOTAL_SOURCE_BYTES = 20 * 1024 * 1024;
let backupTimer = null;
let backupInProgress = false;
let backupFailureHandler = null;

function setFailureHandler(handler) {
    backupFailureHandler = typeof handler === "function" ? handler : null;
}

function sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

function parseEncryptionKey(value = process.env.OFFSITE_BACKUP_ENCRYPTION_KEY_BASE64) {
    if (!value) throw new Error("OFFSITE_BACKUP_ENCRYPTION_KEY_BASE64 não configurada.");
    const encoded = String(value).trim();
    if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded)) {
        throw new Error("A chave deve ser Base64 canónico de 32 bytes (44 caracteres, com = final).");
    }
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32 || key.toString("base64") !== encoded) {
        throw new Error("A chave de cifragem deve conter exatamente 32 bytes em Base64 válido.");
    }
    return key;
}

function cloudflareConfig() {
    const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
    const namespaceId = String(process.env.CLOUDFLARE_KV_NAMESPACE_ID || "").trim();
    const token = String(process.env.CLOUDFLARE_API_TOKEN || "").trim();
    const prefix = String(process.env.OFFSITE_BACKUP_PREFIX || "ursinho-x/backup").trim().replace(/^\/+|\/+$/g, "");
    if (!accountId || !namespaceId || !token) throw new Error("Configuração Cloudflare incompleta.");
    if (!/^[a-f0-9]{32}$/i.test(accountId) || !/^[a-f0-9]{32}$/i.test(namespaceId)) {
        throw new Error("Account ID ou Namespace ID Cloudflare inválido.");
    }
    if (!/^[A-Za-z0-9._/-]{3,180}$/.test(prefix)) throw new Error("OFFSITE_BACKUP_PREFIX inválido.");
    return { accountId, namespaceId, token, prefix };
}

function kvValueUrl(config, key, query = {}) {
    const encoded = encodeURIComponent(key);
    const url = new URL(`${API_BASE}/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${encoded}`);
    for (const [name, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
    }
    return url.toString();
}

async function cloudflareRequest(url, options = {}) {
    const { token, ...requestOptions } = options;
    const response = await fetch(url, {
        ...requestOptions,
        signal: requestOptions.signal || AbortSignal.timeout(30000),
        headers: {
            Authorization: `Bearer ${token}`,
            ...(requestOptions.headers || {})
        }
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Cloudflare HTTP ${response.status}: ${detail.slice(0, 500)}`);
    }
    return response;
}

function retentionSeconds() {
    const days = Number(process.env.OFFSITE_BACKUP_RETENTION_DAYS);
    const safeDays = Number.isInteger(days) && days >= 7 && days <= 90 ? days : 7;
    return safeDays * 24 * 60 * 60;
}

async function putValue(config, key, value) {
    const response = await cloudflareRequest(kvValueUrl(config, key, { expiration_ttl: retentionSeconds() }), {
        method: "PUT",
        token: config.token,
        headers: { "Content-Type": "application/octet-stream" },
        body: value
    });
    const body = await response.json().catch(() => null);
    if (body && body.success === false) throw new Error("Cloudflare recusou a gravação KV.");
}

async function getValue(config, key) {
    const url = kvValueUrl(config, key);
    // KV é eventualmente consistente. Para chaves novas, uma leitura pode
    // demorar a refletir a gravação; tentamos novamente sem ocultar falhas reais.
    const delays = [0, 1000, 3000, 7000, 15000, 30000, 60000];
    let lastError;
    for (const delay of delays) {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        try {
            const response = await cloudflareRequest(url, { method: "GET", token: config.token });
            return Buffer.from(await response.arrayBuffer());
        } catch (error) {
            lastError = error;
            if (!String(error?.message || "").includes("HTTP 404")) throw error;
        }
    }
    throw lastError || new Error("Não foi possível confirmar a leitura do valor KV.");
}

function resolveInsideProject(value) {
    const absolute = path.resolve(process.cwd(), value);
    const relative = path.relative(process.cwd(), absolute);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Caminho de backup fora da pasta do projeto: ${value}`);
    }
    if (path.basename(absolute).toLowerCase() === ".env" || path.basename(absolute).toLowerCase().startsWith(".env.")) {
        throw new Error("Ficheiros .env nunca podem entrar no backup.");
    }
    return { absolute, relative: relative.split(path.sep).join("/") };
}

function collectFile(absolute, relative, output, total) {
    const baseName = path.basename(absolute).toLowerCase();
    if (baseName === ".env" || baseName.startsWith(".env.")) return total;
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) return total;
    const data = fs.readFileSync(absolute);
    const after = fs.lstatSync(absolute);
    if (stat.ino !== after.ino || stat.size !== after.size || stat.mtimeMs !== after.mtimeMs || data.length !== after.size) {
        throw new Error(`Fonte alterada durante o snapshot; backup cancelado para evitar cópia inconsistente: ${relative}`);
    }
    const nextTotal = total + data.length;
    if (nextTotal > MAX_TOTAL_SOURCE_BYTES) {
        throw new Error(`Fontes de backup excedem ${MAX_TOTAL_SOURCE_BYTES} bytes.`);
    }
    output.push({
        path: relative,
        mode: stat.mode & 0o777,
        size: data.length,
        sha256: sha256(data),
        dataBase64: data.toString("base64")
    });
    return nextTotal;
}

function collectDirectory(absolute, relative, output, total) {
    if (!fs.existsSync(absolute)) return total;
    const stat = fs.lstatSync(absolute);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return total;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const childAbsolute = path.join(absolute, entry.name);
        const childRelative = `${relative}/${entry.name}`;
        if (entry.isDirectory()) total = collectDirectory(childAbsolute, childRelative, output, total);
        else if (entry.isFile()) total = collectFile(childAbsolute, childRelative, output, total);
    }
    return total;
}

function collectSources(env = process.env) {
    const files = [];
    const missing = [];
    let total = 0;
    const configured = [
        ["BOT_DB_FILE", env.BOT_DB_FILE || "./src/database/db.json"],
        ["AUTOMATION_DB_FILE", env.AUTOMATION_DB_FILE || "./src/automation/database/automation.json"],
        ["AUTOMATION_ORDERS_FILE", env.AUTOMATION_ORDERS_FILE || "./src/database/automationOrders.json"],
        ["SALES_DB_FILE", env.SALES_DB_FILE || "./src/database/sales.json"]
    ];

    for (const [name, configuredPath] of configured) {
        const resolved = resolveInsideProject(configuredPath);
        if (!fs.existsSync(resolved.absolute)) {
            missing.push(name);
            continue;
        }
        total = collectFile(resolved.absolute, resolved.relative, files, total);
    }

    const includeSession = String(env.OFFSITE_BACKUP_INCLUDE_SESSION ?? "true").toLowerCase() === "true";
    let sessionIncluded = false;
    if (includeSession) {
        const sessionResolved = resolveInsideProject(env.OFFSITE_BACKUP_SESSION_DIR || "./sessions/principal");
        if (fs.existsSync(sessionResolved.absolute)) {
            total = collectDirectory(sessionResolved.absolute, sessionResolved.relative, files, total);
            sessionIncluded = files.some((file) => file.path.startsWith(`${sessionResolved.relative}/`));
        } else {
            missing.push("OFFSITE_BACKUP_SESSION_DIR");
        }
    }

    if (files.length === 0) throw new Error("Nenhum ficheiro de dados encontrado para backup.");
    return { files, missing, sessionIncluded, sourceBytes: total };
}

function buildEncryptedArchive({ files, missing = [], sessionIncluded = false, snapshotId, createdAt = new Date().toISOString() }, key = parseEncryptionKey()) {
    if (!Array.isArray(files) || files.length === 0) throw new Error("Snapshot sem ficheiros.");
    const bundle = {
        format: "URSINHO_X_AUTOMATION_BACKUP",
        formatVersion: 1,
        snapshotId,
        createdAt,
        missing,
        sessionIncluded,
        files
    };
    const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(bundle)), { level: 6 });
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
        ciphertext,
        encryption: {
            algorithm: "AES-256-GCM",
            iv: iv.toString("base64"),
            authTag: authTag.toString("base64"),
            ciphertextSha256: sha256(ciphertext),
            compressedSha256: sha256(compressed)
        },
        bundleSha256: sha256(Buffer.from(JSON.stringify(bundle)))
    };
}

function openEncryptedArchive({ ciphertext, encryption }, key = parseEncryptionKey()) {
    if (!Buffer.isBuffer(ciphertext)) ciphertext = Buffer.from(ciphertext);
    if (sha256(ciphertext) !== encryption.ciphertextSha256) throw new Error("Integridade do conteúdo cifrado inválida.");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(encryption.iv, "base64"));
    decipher.setAuthTag(Buffer.from(encryption.authTag, "base64"));
    const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (sha256(compressed) !== encryption.compressedSha256) throw new Error("Integridade do arquivo comprimido inválida.");
    const raw = zlib.gunzipSync(compressed, { maxOutputLength: 64 * 1024 * 1024 });
    const bundle = JSON.parse(raw.toString("utf8"));
    if (bundle.format !== "URSINHO_X_AUTOMATION_BACKUP" || bundle.formatVersion !== 1 || !Array.isArray(bundle.files)) {
        throw new Error("Formato de snapshot não reconhecido.");
    }
    let totalBytes = 0;
    const seenPaths = new Set();
    for (const file of bundle.files) {
        const safePath = safeRestorePath(file.path);
        if (seenPaths.has(safePath)) throw new Error(`Snapshot contém caminho duplicado: ${safePath}`);
        seenPaths.add(safePath);
        const data = Buffer.from(String(file.dataBase64 || ""), "base64");
        if (!Number.isSafeInteger(file.size) || file.size < 0 || data.length !== file.size || sha256(data) !== file.sha256) {
            throw new Error(`Verificação do ficheiro falhou: ${file.path}`);
        }
        totalBytes += data.length;
        if (totalBytes > MAX_TOTAL_SOURCE_BYTES) throw new Error("Snapshot excede o limite seguro de restauração.");
    }
    return bundle;
}

function splitBuffer(buffer, chunkBytes = DEFAULT_CHUNK_BYTES) {
    if (!Number.isInteger(chunkBytes) || chunkBytes < 1024 || chunkBytes > 20 * 1024 * 1024) {
        throw new Error("Tamanho de bloco inválido; use entre 1 KiB e 20 MiB.");
    }
    const chunks = [];
    for (let offset = 0; offset < buffer.length; offset += chunkBytes) {
        chunks.push(buffer.subarray(offset, Math.min(offset + chunkBytes, buffer.length)));
    }
    return chunks.length ? chunks : [Buffer.alloc(0)];
}

function createSnapshotId(now = new Date()) {
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    return `${stamp}-${crypto.randomBytes(5).toString("hex")}`;
}

async function createBackup(options = {}) {
    if (backupInProgress) return { ok: false, skipped: true, reason: "BACKUP_ALREADY_RUNNING" };
    backupInProgress = true;
    try {
        const config = options.config || cloudflareConfig();
        const key = options.key || parseEncryptionKey();
        const source = options.source || collectSources();
        const snapshotId = options.snapshotId || createSnapshotId();
        const createdAt = new Date().toISOString();
        const encrypted = buildEncryptedArchive({ ...source, snapshotId, createdAt }, key);
        const chunkBytes = Number(process.env.OFFSITE_BACKUP_CHUNK_BYTES) || DEFAULT_CHUNK_BYTES;
        if (!Number.isInteger(chunkBytes) || chunkBytes < 1024 * 1024 || chunkBytes > 20 * 1024 * 1024) {
            throw new Error("OFFSITE_BACKUP_CHUNK_BYTES deve estar entre 1 MiB e 20 MiB.");
        }
        const chunks = splitBuffer(encrypted.ciphertext, chunkBytes);
        const chunkRecords = [];
        const base = `${config.prefix}/snapshots/${snapshotId}`;

        for (let index = 0; index < chunks.length; index++) {
            const chunk = chunks[index];
            const name = `${base}/chunk-${String(index + 1).padStart(4, "0")}`;
            await putValue(config, name, chunk);
            const verify = await getValue(config, name);
            if (sha256(verify) !== sha256(chunk)) throw new Error(`Verificação Cloudflare falhou no bloco ${index + 1}.`);
            chunkRecords.push({ key: name, bytes: chunk.length, sha256: sha256(chunk) });
        }

        const manifest = {
            format: "URSINHO_X_KV_SNAPSHOT",
            formatVersion: 1,
            snapshotId,
            createdAt,
            retentionDays: Math.floor(retentionSeconds() / 86400),
            encryption: encrypted.encryption,
            ciphertextBytes: encrypted.ciphertext.length,
            chunkCount: chunks.length,
            chunks: chunkRecords,
            sourceFiles: source.files.map(({ path: filePath, size, sha256: digest }) => ({ path: filePath, size, sha256: digest })),
            missingSources: source.missing,
            sessionIncluded: source.sessionIncluded,
            sourceBytes: source.sourceBytes
        };
        const manifestKey = `${base}/manifest.json`;
        const manifestBuffer = Buffer.from(JSON.stringify(manifest));
        await putValue(config, manifestKey, manifestBuffer);
        const verifiedManifest = await getValue(config, manifestKey);
        if (sha256(verifiedManifest) !== sha256(manifestBuffer)) throw new Error("Verificação do manifesto Cloudflare falhou.");

        return { ok: true, snapshotId, manifestKey, chunks: chunks.length, sourceFiles: source.files.length,
            sourceBytes: source.sourceBytes, encryptedBytes: encrypted.ciphertext.length,
            sessionIncluded: source.sessionIncluded, missingSources: source.missing };
    } finally {
        backupInProgress = false;
    }
}

async function downloadSnapshot(snapshotId, options = {}) {
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(String(snapshotId || ""))) throw new Error("Snapshot ID inválido.");
    const config = options.config || cloudflareConfig();
    const base = `${config.prefix}/snapshots/${snapshotId}`;
    const manifestBytes = await getValue(config, `${base}/manifest.json`);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    if (manifest.format !== "URSINHO_X_KV_SNAPSHOT" || manifest.formatVersion !== 1 || manifest.snapshotId !== snapshotId || !Array.isArray(manifest.chunks)) {
        throw new Error("Manifesto inválido ou incompatível.");
    }
    if (!Number.isInteger(manifest.chunkCount) || manifest.chunkCount < 1 || manifest.chunkCount > 64 || manifest.chunks.length !== manifest.chunkCount) {
        throw new Error("Quantidade de blocos do snapshot inválida.");
    }
    if (!Number.isSafeInteger(manifest.ciphertextBytes) || manifest.ciphertextBytes < 1 || manifest.ciphertextBytes > 64 * 1024 * 1024) {
        throw new Error("Tamanho do snapshot excede o limite de segurança.");
    }
    const expectedChunkPrefix = `${config.prefix}/snapshots/${snapshotId}/chunk-`;
    const pieces = [];
    for (const record of manifest.chunks) {
        if (!record || typeof record.key !== "string" || !record.key.startsWith(expectedChunkPrefix) ||
            !Number.isSafeInteger(record.bytes) || record.bytes < 0 || record.bytes > 20 * 1024 * 1024 ||
            !/^[a-f0-9]{64}$/.test(String(record.sha256 || ""))) {
            throw new Error("Metadados de bloco inválidos.");
        }
        const chunk = await getValue(config, record.key);
        if (chunk.length !== record.bytes || sha256(chunk) !== record.sha256) throw new Error(`Bloco corrompido: ${record.key}`);
        pieces.push(chunk);
    }
    const ciphertext = Buffer.concat(pieces);
    if (ciphertext.length !== manifest.ciphertextBytes) throw new Error("Tamanho total do snapshot não confere.");
    return { manifest, ciphertext };
}

async function listSnapshots(options = {}) {
    const config = options.config || cloudflareConfig();
    const prefix = `${config.prefix}/snapshots/`;
    const urlBase = `${API_BASE}/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/keys`;
    const keys = [];
    let cursor = null;
    let page = 0;
    do {
        const url = new URL(urlBase);
        url.searchParams.set("prefix", prefix);
        url.searchParams.set("limit", "1000");
        if (cursor) url.searchParams.set("cursor", cursor);
        const response = await cloudflareRequest(url.toString(), { method: "GET", token: config.token });
        const body = await response.json();
        if (body?.success === false || !Array.isArray(body?.result)) throw new Error("Resposta de listagem KV inválida.");
        keys.push(...body.result.map((item) => item?.name).filter((name) => typeof name === "string"));
        cursor = body?.result_info?.cursor || null;
        page++;
        if (page >= 20 && cursor) throw new Error("Há mais de 20.000 chaves; limite de segurança da listagem atingido.");
    } while (cursor);

    const manifests = keys.filter((name) => name.endsWith("/manifest.json"));
    return manifests.map((manifestKey) => {
        const snapshotId = manifestKey.slice(prefix.length).split("/")[0];
        return { snapshotId, manifestKey };
    }).filter((item) => /^[A-Za-z0-9_-]{8,80}$/.test(item.snapshotId))
        .sort((a, b) => b.snapshotId.localeCompare(a.snapshotId));
}

function safeRestorePath(relative) {
    if (typeof relative !== "string" || !relative || relative.includes("\\") || path.posix.isAbsolute(relative)) {
        throw new Error("Caminho interno de snapshot inválido.");
    }
    const normalized = path.posix.normalize(relative);
    if (normalized === "." || normalized === ".." || normalized.startsWith("../")) throw new Error("Caminho interno fora da pasta de restauração.");
    const segments = normalized.split("/").map((part) => part.toLowerCase());
    if (segments.some((part) => part === ".env" || part.startsWith(".env."))) throw new Error("Snapshot tenta restaurar um ficheiro .env.");
    return normalized;
}

async function restoreSnapshotToStaging(snapshotId, options = {}) {
    const key = options.key || parseEncryptionKey();
    const { manifest, ciphertext } = await downloadSnapshot(snapshotId, options);
    const bundle = openEncryptedArchive({ ciphertext, encryption: manifest.encryption }, key);
    if (bundle.snapshotId !== snapshotId) throw new Error("ID do snapshot não corresponde ao conteúdo.");
    const root = path.resolve(options.outputDir || path.join(process.cwd(), "restore-staging", snapshotId));
    const parent = path.dirname(root);
    fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
    const parentStat = fs.lstatSync(parent);
    if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error("Pasta-pai de restauração insegura.");
    if (fs.existsSync(root)) throw new Error("A pasta de staging já existe; escolha um destino novo para não misturar restaurações.");
    fs.mkdirSync(root, { mode: 0o700 });
    fs.chmodSync(root, 0o700);
    const written = [];
    const seenPaths = new Set();
    for (const file of bundle.files) {
        const relative = safeRestorePath(file.path);
        if (seenPaths.has(relative)) throw new Error(`Snapshot contém caminho duplicado: ${relative}`);
        seenPaths.add(relative);
        const destination = path.resolve(root, ...relative.split("/"));
        const fromRoot = path.relative(root, destination);
        if (fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) throw new Error("Caminho de restauração inseguro.");
        const data = Buffer.from(file.dataBase64, "base64");
        let current = root;
        const parentSegments = relative.split("/").slice(0, -1);
        for (const segment of parentSegments) {
            current = path.join(current, segment);
            if (fs.existsSync(current)) {
                const currentStat = fs.lstatSync(current);
                if (!currentStat.isDirectory() || currentStat.isSymbolicLink()) throw new Error(`Pasta de restauração insegura: ${relative}`);
            } else {
                fs.mkdirSync(current, { mode: 0o700 });
            }
        }
        fs.writeFileSync(destination, data, { flag: "wx", mode: 0o600 });
        written.push({ path: relative, bytes: data.length });
    }
    const receipt = {
        snapshotId,
        createdAt: bundle.createdAt,
        stagedAt: new Date().toISOString(),
        destination: root,
        files: written,
        missingSources: bundle.missing || [],
        sessionIncluded: bundle.sessionIncluded === true,
        note: "STAGING ONLY: nenhum ficheiro de produção foi substituído."
    };
    fs.writeFileSync(path.join(root, "RESTORE-RECEIPT.json"), JSON.stringify(receipt, null, 2), { flag: "wx", mode: 0o600 });
    fs.chmodSync(path.join(root, "RESTORE-RECEIPT.json"), 0o600);
    return receipt;
}

function startOffsiteBackup() {
    if (backupTimer) return;
    const intervalMinutes = Number(process.env.OFFSITE_BACKUP_INTERVAL_MIN) || 60;
    if (!Number.isFinite(intervalMinutes) || intervalMinutes < 15 || intervalMinutes > 1440) {
        console.error("[BACKUP] OFFSITE_BACKUP_INTERVAL_MIN inválido; monitor de backup não iniciado.");
        return;
    }
    const hasCloudflare = !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_KV_NAMESPACE_ID && process.env.CLOUDFLARE_API_TOKEN);
    const hasKey = !!process.env.OFFSITE_BACKUP_ENCRYPTION_KEY_BASE64;
    if (!hasCloudflare || !hasKey) {
        console.log("[BACKUP] Backup externo desativado: Cloudflare ou chave de cifragem não configurados.");
        return;
    }
    backupTimer = setInterval(async () => {
        try {
            const result = await createBackup();
            if (result.ok) console.log(`[BACKUP] Snapshot ${result.snapshotId} verificado: ${result.sourceFiles} ficheiros, ${result.chunks} blocos.`);
            else console.log(`[BACKUP] Snapshot ignorado: ${result.reason}`);
        } catch (error) {
            console.error("[BACKUP] Falha no backup externo:", error?.message || error);
            if (backupFailureHandler) {
                try { await backupFailureHandler(error); }
                catch (notifyError) { console.error("[BACKUP] Não foi possível notificar o proprietário:", notifyError?.message || notifyError); }
            }
        }
    }, intervalMinutes * 60000);
    if (typeof backupTimer.unref === "function") backupTimer.unref();
    console.log(`[BACKUP] Backup externo cifrado configurado. Intervalo: ${intervalMinutes} minutos.`);
}

module.exports = {
    sha256, parseEncryptionKey, cloudflareConfig, collectSources,
    buildEncryptedArchive, openEncryptedArchive, splitBuffer,
    createSnapshotId, createBackup, listSnapshots, downloadSnapshot,
    restoreSnapshotToStaging, safeRestorePath, setFailureHandler, startOffsiteBackup
};
