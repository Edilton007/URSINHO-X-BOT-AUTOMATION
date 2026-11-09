"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-health-backup-test-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.AUTOMATION_ALLOW_EXECUTION = "false";
process.env.DEVICE_OFFLINE_AFTER_SEC = "120";
process.env.SIM_TELEMETRY_STALE_MIN = "45";

const db = require("../src/automation/database/automationDb");
const tenants = require("../src/automation/services/tenantService");
const health = require("../src/automation/services/deviceHealthService");
const telemetry = require("../src/automation/services/simTelemetryService");
const backup = require("../src/services/offsiteBackupService");
const alerts = require("../src/services/healthAlertService");


test("saúde usa 120 s para Agent, 45 min por SIM e rejeita timestamps futuros", () => {
    const tenant = tenants.criarTenant({ nome: "Tenant Saúde" });
    const device = tenants.registrarDevice(tenant.id, "device-health-test");
    const now = Date.now();

    db.devices[device.id].ultimoContactoMs = now - 119000;
    assert.equal(health.avaliarDevice(device.id, now).estado, "ONLINE");

    db.devices[device.id].ultimoContactoMs = now - 121000;
    assert.equal(health.avaliarDevice(device.id, now).estado, "OFFLINE");

    db.devices[device.id].ultimoContactoMs = now + 300000;
    assert.equal(health.avaliarDevice(device.id, now).estado, "TIMESTAMP_FUTURO");
    assert.equal(health.avaliarTenant(tenant.id, now).estado, "CRITICO");

    db.devices[device.id].ultimoContactoMs = now - 1000;
    db.sims[`${device.id}-SLOT0`] = {
        simId: `${device.id}-SLOT0`, tenantId: tenant.id, deviceId: device.id,
        slot: 0, subscriptionId: 12, operadora: "Vodacom Moçambique",
        internetMB: 500, atualizadoEmMs: now - 46 * 60000
    };
    const snapshot = health.avaliarTenant(tenant.id, now);
    assert.equal(snapshot.device.estado, "ONLINE");
    assert.equal(snapshot.device.sims[0].estado, "ANTIGA");
    assert.equal(snapshot.execucaoPermitida, false);
});


test("contacto do Agent atualiza memória sempre e persiste no máximo uma vez por minuto por device", () => {
    const tenant = tenants.criarTenant({ nome: "Tenant Heartbeat" });
    const device = tenants.registrarDevice(tenant.id, "device-heartbeat-test");
    const originalNow = Date.now;
    const originalSave = db.save;
    let now = 1000000;
    let saves = 0;
    Date.now = () => now;
    db.save = () => { saves++; };
    try {
        tenants.marcarContactoDevice(device.id);
        const first = db.devices[device.id].ultimoContactoMs;
        now += 20000;
        tenants.marcarContactoDevice(device.id);
        assert.equal(db.devices[device.id].ultimoContactoMs, first + 20000);
        assert.equal(saves, 1);
        now += 41000;
        tenants.marcarContactoDevice(device.id);
        assert.equal(saves, 2);
    } finally {
        Date.now = originalNow;
        db.save = originalSave;
    }
});


test("telemetria SIM futura não é considerada atualizada nem aceite como leitura de evidência", () => {
    const tenant = tenants.criarTenant({ nome: "Tenant SIM Timestamp" });
    const device = tenants.registrarDevice(tenant.id, "device-sim-time-test");
    const now = Date.now();
    assert.equal(telemetry.telemetriaRecente(now + 5 * 60000, now), false);
    db.sims[`${device.id}-SLOT1`] = {
        simId: `${device.id}-SLOT1`, tenantId: tenant.id, deviceId: device.id,
        slot: 1, subscriptionId: 14, operadora: "Vodacom Moçambique",
        internetMB: 300, atualizadoEmMs: now + 5 * 60000
    };
    assert.equal(telemetry.listarSimsDoTenant(tenant.id)[0].online, false);
});


test("backup AES-256-GCM cifra, verifica conteúdo e rejeita chave ou ciphertext adulterado", () => {
    const key = crypto.randomBytes(32);
    const files = [{
        path: "data/example.json", mode: 0o600, size: 8,
        sha256: backup.sha256(Buffer.from("{\"ok\":1}")),
        dataBase64: Buffer.from("{\"ok\":1}").toString("base64")
    }];
    const snapshotId = "20261106T100000Z-test12345";
    const encrypted = backup.buildEncryptedArchive({ files, snapshotId }, key);
    const opened = backup.openEncryptedArchive(encrypted, key);
    assert.equal(opened.snapshotId, snapshotId);
    assert.equal(Buffer.from(opened.files[0].dataBase64, "base64").toString(), "{\"ok\":1}");
    assert.throws(() => backup.openEncryptedArchive(encrypted, crypto.randomBytes(32)));
    const altered = Buffer.from(encrypted.ciphertext);
    altered[0] ^= 0xff;
    assert.throws(() => backup.openEncryptedArchive({ ...encrypted, ciphertext: altered }, key), /Integridade/);
});


test("divisão em blocos respeita o tamanho configurado e cobre o conteúdo integral", () => {
    const original = crypto.randomBytes(25000);
    const parts = backup.splitBuffer(original, 4096);
    assert.ok(parts.every((part) => part.length <= 4096));
    assert.deepEqual(Buffer.concat(parts), original);
});


test("recolha de backup inclui bases e sessão, sem incluir .env", () => {
    const previousCwd = process.cwd();
    const sourceRoot = path.join(temp, "source");
    fs.mkdirSync(path.join(sourceRoot, "data"), { recursive: true });
    fs.mkdirSync(path.join(sourceRoot, "sessions", "principal"), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, "data", "bot-db.json"), "{}\n");
    fs.writeFileSync(path.join(sourceRoot, "data", "automation.json"), "{}\n");
    fs.writeFileSync(path.join(sourceRoot, "data", "automation-orders.json"), "{}\n");
    fs.writeFileSync(path.join(sourceRoot, "data", "sales.json"), "{}\n");
    fs.writeFileSync(path.join(sourceRoot, "sessions", "principal", "creds.json"), "{\"creds\":true}");
    fs.writeFileSync(path.join(sourceRoot, "sessions", "principal", ".env.backup"), "SECRET=do-not-backup");
    fs.writeFileSync(path.join(sourceRoot, ".env"), "SECRET=do-not-backup");
    const previous = { ...process.env };
    try {
        process.chdir(sourceRoot);
        process.env.BOT_DB_FILE = "./data/bot-db.json";
        process.env.AUTOMATION_DB_FILE = "./data/automation.json";
        process.env.AUTOMATION_ORDERS_FILE = "./data/automation-orders.json";
        process.env.SALES_DB_FILE = "./data/sales.json";
        process.env.OFFSITE_BACKUP_INCLUDE_SESSION = "true";
        process.env.OFFSITE_BACKUP_SESSION_DIR = "./sessions/principal";
        const collected = backup.collectSources();
        assert.equal(collected.files.length, 5);
        assert.equal(collected.sessionIncluded, true);
        assert.equal(collected.files.some((file) => file.path.toLowerCase().includes(".env")), false);
    } finally {
        process.chdir(previousCwd);
        for (const [key, value] of Object.entries(process.env)) if (!(key in previous)) delete process.env[key];
        Object.assign(process.env, previous);
    }
});


test("alertas usam exclusivamente JID privado do proprietário", () => {
    const oldOwner = process.env.OWNER_NUMBER;
    const oldOwnerShort = process.env.OWNER;
    process.env.OWNER_NUMBER = "258841234567";
    delete process.env.OWNER;
    try {
        assert.equal(alerts.ownerPrivateJid(), "258841234567@s.whatsapp.net");
        assert.equal(alerts.ownerPrivateJid().endsWith("@g.us"), false);
        assert.match(alerts.issueMessage("DEVICE_OFFLINE", "TEN-TEST"), /Agent sem contacto ou offline/);
    } finally {
        if (oldOwner === undefined) delete process.env.OWNER_NUMBER; else process.env.OWNER_NUMBER = oldOwner;
        if (oldOwnerShort === undefined) delete process.env.OWNER; else process.env.OWNER = oldOwnerShort;
    }
});


test("contratos preservam a filtragem de claims internos e acrescentam rotas sem substituir as anteriores", () => {
    const tenantRoutes = fs.readFileSync(path.join(__dirname, "../src/automation/routes/tenantRoutes.js"), "utf8");
    const adminRoutes = fs.readFileSync(path.join(__dirname, "../src/automation/routes/adminRoutes.js"), "utf8");
    assert.match(tenantRoutes, /claimToken,\s*claimDeviceId,\s*leaseExpiresAtMs/);
    for (const endpoint of ["storefront", "products", "store-orders", "operacoes", "sims", "transferir", "saude"]) {
        assert.ok(tenantRoutes.includes(endpoint), `endpoint esperado não encontrado: ${endpoint}`);
    }
    for (const endpoint of ["overview", "tenants", "status", "devices", "reviews", "store-orders", "auditoria"]) {
        assert.ok(adminRoutes.includes(endpoint), `endpoint admin esperado não encontrado: ${endpoint}`);
    }
});


test("chave Base64 é validada estritamente e caminhos de restauração bloqueiam traversal e .env", () => {
    const key = crypto.randomBytes(32).toString("base64");
    assert.equal(backup.parseEncryptionKey(key).length, 32);
    assert.throws(() => backup.parseEncryptionKey("abc"));
    assert.throws(() => backup.safeRestorePath("../outside.json"));
    assert.throws(() => backup.safeRestorePath("data/.env"));
    assert.throws(() => backup.safeRestorePath("sessions/.env.backup"));
    assert.equal(backup.safeRestorePath("sessions/principal/creds.json"), "sessions/principal/creds.json");
});


test("backup Cloudflare simulado grava com retenção, lista e restaura apenas para staging", async () => {
    const oldFetch = global.fetch;
    const oldEnv = { ...process.env };
    const oldCwd = process.cwd();
    const root = path.join(temp, "restore-cloudflare-test");
    fs.mkdirSync(root, { recursive: true });
    const store = new Map();
    const key = crypto.randomBytes(32);
    const config = {
        accountId: "a".repeat(32),
        namespaceId: "b".repeat(32),
        token: "test-token",
        prefix: "ursinho-x/backup"
    };
    const snapshotId = "20261106T100000Z-test12345";
    const sourceData = Buffer.from('{"snapshot":"valid"}');
    const source = {
        files: [{ path: "data/bot-db.json", mode: 0o600, size: sourceData.length,
            sha256: backup.sha256(sourceData), dataBase64: sourceData.toString("base64") }],
        missing: ["OFFSITE_BACKUP_SESSION_DIR"], sessionIncluded: false, sourceBytes: sourceData.length
    };
    process.env.OFFSITE_BACKUP_RETENTION_DAYS = "30";
    process.env.OFFSITE_BACKUP_CHUNK_BYTES = "1048576";
    global.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const tokenHeader = new Headers(init.headers).get("authorization");
        assert.equal(tokenHeader, "Bearer test-token");
        if (url.pathname.endsWith("/keys")) {
            const prefix = url.searchParams.get("prefix");
            const result = [...store.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name }));
            return new Response(JSON.stringify({ success: true, result, result_info: { count: result.length } }), { status: 200 });
        }
        const name = decodeURIComponent(url.pathname.split("/values/")[1] || "");
        if (init.method === "PUT") {
            assert.equal(url.searchParams.get("expiration_ttl"), "2592000");
            store.set(name, Buffer.from(init.body));
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        if (!store.has(name)) return new Response("not found", { status: 404 });
        return new Response(store.get(name), { status: 200 });
    };
    try {
        process.chdir(root);
        const created = await backup.createBackup({ config, key, source, snapshotId });
        assert.equal(created.ok, true);
        const listed = await backup.listSnapshots({ config });
        assert.equal(listed[0].snapshotId, snapshotId);
        const staging = path.join(root, "restore-staging");
        const receipt = await backup.restoreSnapshotToStaging(snapshotId, { config, key, outputDir: staging });
        assert.equal(receipt.files.length, 1);
        assert.equal(fs.readFileSync(path.join(staging, "data", "bot-db.json"), "utf8"), sourceData.toString());
        assert.equal(fs.statSync(staging).mode & 0o777, 0o700);
        await assert.rejects(() => backup.restoreSnapshotToStaging(snapshotId, { config, key: crypto.randomBytes(32), outputDir: path.join(root, "wrong-key") }));
        const chunkKey = [...store.keys()].find((name) => name.includes("/chunk-"));
        store.set(chunkKey, Buffer.from("adulterado"));
        await assert.rejects(() => backup.restoreSnapshotToStaging(snapshotId, { config, key, outputDir: path.join(root, "tampered") }), /Bloco corrompido/);
    } finally {
        global.fetch = oldFetch;
        process.chdir(oldCwd);
        for (const [keyName, value] of Object.entries(process.env)) if (!(keyName in oldEnv)) delete process.env[keyName];
        Object.assign(process.env, oldEnv);
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test.after(() => fs.rmSync(temp, { recursive: true, force: true }));
