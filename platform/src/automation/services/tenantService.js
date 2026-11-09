// ============================================================
// tenantService.js — COMPLETAMENTE NOVO
//
// Nenhuma versão recuperada deste ficheiro foi encontrada em
// nenhuma fonte (telemóvel, GitHub, pacotes do outro chat).
// A gestão de tenants/licenças/devices nunca foi confirmada
// como implementada no histórico do projeto. Este ficheiro
// implementa o necessário para que automationDb.js (schema:
// tenants, licenseCodes, devices) e operationService.js
// (que já exige tenant.licencaId, licenca.estado, etc.)
// funcionem de verdade.
// ============================================================

const crypto = require("crypto");
const db = require("../database/automationDb");

function genId(prefixo) {
    return `${prefixo}-${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

function genApiKey() {
    return crypto.randomBytes(32).toString("base64url");
}

function hashApiKey(value) {
    return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function segredoCorresponde(registo, fornecido) {
    if (!fornecido || !registo) return false;
    const hashGuardado = registo.apiKeyHash;
    const comparado = hashGuardado || registo.apiKey;
    if (!comparado) return false;
    const valorRecebido = hashGuardado ? hashApiKey(fornecido) : String(fornecido);
    const a = Buffer.from(String(comparado));
    const b = Buffer.from(String(valorRecebido));
    const igual = a.length === b.length && crypto.timingSafeEqual(a, b);
    // Migração transparente: chaves antigas em texto passam a hash na primeira autenticação.
    if (igual && !hashGuardado) {
        registo.apiKeyHash = hashApiKey(fornecido);
        delete registo.apiKey;
        db.save();
    }
    return igual;
}

// ------------------------------------------------------------
// TENANTS
// ------------------------------------------------------------

function criarTenant({ nome }) {
    if (String(nome || "").trim().length < 2) return { error: "O nome do tenant deve ter pelo menos 2 caracteres." };
    const tenantId = genId("TEN");
    const apiKey = genApiKey();

    db.tenants[tenantId] = {
        id: tenantId,
        nome: String(nome || tenantId).trim().slice(0, 100),
        apiKeyHash: hashApiKey(apiKey),
        ativo: true,
        licencaId: null,
        deviceId: null,
        criadoEmMs: Date.now()
    };

    db.save();

    return { ...db.tenants[tenantId], apiKey };
}

function getTenant(tenantId) {
    return db.tenants[tenantId] || null;
}

function autenticarTenant(tenantId, apiKey) {
    const tenant = db.tenants[tenantId];
    return !!tenant && tenant.ativo !== false && segredoCorresponde(tenant, apiKey);
}

function resumoTenant(tenantId) {
    const tenant = db.tenants[tenantId];

    if (!tenant) {
        return null;
    }

    return {
        id: tenant.id,
        nome: tenant.nome,
        ativo: tenant.ativo !== false,
        deviceId: tenant.deviceId || null,
        temLicenca: !!tenant.licencaId
    };
}

// ------------------------------------------------------------
// LICENÇAS
// ------------------------------------------------------------

/**
 * Gera um código de licença (admin), por um número de dias.
 * Fica por ativar até o tenant a reivindicar com
 * ativarLicenca().
 */
function gerarCodigoLicenca(dias) {
    const codigo = `LIC-${crypto.randomBytes(16).toString("hex").toUpperCase()}`;

    const periodoDias = Number(dias);
    if (!Number.isInteger(periodoDias) || periodoDias < 1 || periodoDias > 3650) {
        return { error: "A licença deve ter entre 1 e 3650 dias." };
    }
    db.licenseCodes[codigo] = {
        codigo,
        dias: periodoDias,
        estado: "POR_ATIVAR", // POR_ATIVAR | ATIVA | EXPIRADA | REVOGADA
        tenantId: null,
        criadoEmMs: Date.now(),
        ativadaEmMs: null,
        expiraEmMs: null
    };

    db.save();

    return db.licenseCodes[codigo];
}

/**
 * O tenant ativa um código de licença recebido do
 * administrador. A partir daqui a licença fica vinculada a
 * esse tenant (não reutilizável por outro).
 */
function ativarLicenca(tenantId, codigo) {
    const tenant = db.tenants[tenantId];

    if (!tenant) {
        return { error: "Tenant não encontrado." };
    }

    const licenca = db.licenseCodes[codigo];

    if (!licenca) {
        return { error: "Código de licença inválido." };
    }

    if (licenca.estado !== "POR_ATIVAR") {
        return { error: "Este código de licença já foi utilizado, expirou ou foi revogado. Gere uma nova licença." };
    }

    const agora = Date.now();
    const licencaAnterior = tenant.licencaId ? db.licenseCodes[tenant.licencaId] : null;
    const inicioNovoPeriodo = licencaAnterior && licencaAnterior.estado === "ATIVA" &&
        typeof licencaAnterior.expiraEmMs === "number" && licencaAnterior.expiraEmMs > agora
        ? licencaAnterior.expiraEmMs
        : agora;

    if (licencaAnterior && licencaAnterior.codigo !== codigo && licencaAnterior.estado === "ATIVA") {
        licencaAnterior.estado = "SUBSTITUIDA";
        licencaAnterior.substituidaPor = codigo;
    }

    licenca.estado = "ATIVA";
    licenca.tenantId = tenantId;
    licenca.ativadaEmMs = agora;
    licenca.expiraEmMs = inicioNovoPeriodo + licenca.dias * 24 * 60 * 60 * 1000;

    tenant.licencaId = codigo;

    db.save();

    return { ok: true, licenca };
}

function getLicenca(tenantId) {
    const tenant = db.tenants[tenantId];

    if (!tenant || !tenant.licencaId) {
        return null;
    }

    const licenca = db.licenseCodes[tenant.licencaId];

    if (!licenca) {
        return null;
    }

    // Marca como expirada automaticamente, sem apagar o registo.
    if (
        licenca.estado === "ATIVA" &&
        typeof licenca.expiraEmMs === "number" &&
        Date.now() > licenca.expiraEmMs
    ) {
        licenca.estado = "EXPIRADA";
        db.save();
    }

    return licenca;
}

// ------------------------------------------------------------
// DEVICES (Android Agent)
// ------------------------------------------------------------

/**
 * Regista/autoriza um device para um tenant, com a própria
 * apiKey do device (diferente da apiKey do tenant — assim um
 * vazamento da chave do painel Tenant não dá acesso ao Agent,
 * e vice-versa).
 */
function registrarDevice(tenantId, deviceId) {
    const tenant = db.tenants[tenantId];
    deviceId = String(deviceId || "").trim();

    if (!tenant) {
        return { error: "Tenant não encontrado." };
    }
    if (!/^[A-Za-z0-9._-]{3,80}$/.test(deviceId)) {
        return { error: "deviceId inválido. Use 3 a 80 caracteres: letras, números, ponto, hífen ou underscore." };
    }

    const existente = db.devices[deviceId];
    if (existente && existente.tenantId !== tenantId) {
        return { error: "Este deviceId já está associado a outro tenant." };
    }

    const apiKey = genApiKey();

    db.devices[deviceId] = {
        id: deviceId,
        tenantId,
        apiKeyHash: hashApiKey(apiKey),
        autorizado: existente ? existente.autorizado !== false : true,
        registadoEmMs: existente?.registadoEmMs || Date.now(),
        ultimoContactoMs: existente?.ultimoContactoMs || null
    };

    tenant.deviceId = deviceId;

    db.save();

    return { ...db.devices[deviceId], apiKey };
}

function autenticarDevice(deviceId, apiKey) {
    const device = db.devices[deviceId];
    const tenant = device ? db.tenants[device.tenantId] : null;
    return !!device && !!tenant && tenant.ativo !== false && device.autorizado !== false && segredoCorresponde(device, apiKey);
}

function janelaOfflineMs() {
    const configured = Number(process.env.DEVICE_OFFLINE_AFTER_SEC);
    const seconds = Number.isFinite(configured) && configured >= 30 && configured <= 600 ? configured : 120;
    return seconds * 1000;
}

function timestampRecente(timestamp, agora = Date.now(), janelaMs = janelaOfflineMs()) {
    return Number.isSafeInteger(timestamp) && timestamp > 0 &&
        timestamp <= agora + 120000 && agora - timestamp <= janelaMs;
}

function getDeviceDoTenant(tenantId) {
    const tenant = db.tenants[tenantId];

    if (!tenant || !tenant.deviceId) {
        return null;
    }

    const device = db.devices[tenant.deviceId];

    if (!device) {
        return null;
    }

    const agora = Date.now();
    return {
        ...device,
        online: timestampRecente(device.ultimoContactoMs, agora),
        estadoSaude: timestampRecente(device.ultimoContactoMs, agora)
            ? "ONLINE"
            : (Number.isSafeInteger(device.ultimoContactoMs) ? "OFFLINE" : "SEM_CONTACTO")
    };
}

// O Agent consulta o Backend em intervalos curtos. Atualizamos a memória em
// todos os contactos, mas persistimos no máximo uma vez por minuto por device.
// O primeiro contacto é sempre persistido; outros saves do DB também incluem
// o timestamp mais recente que estiver em memória.
const ultimoSaveContactoPorDevice = new Map();
function marcarContactoDevice(deviceId) {
    const device = db.devices[deviceId];
    if (!device) return;

    const agora = Date.now();
    device.ultimoContactoMs = agora;
    const ultimoSave = ultimoSaveContactoPorDevice.get(deviceId) || 0;
    if (!ultimoSave || agora < ultimoSave || agora - ultimoSave >= 60000) {
        ultimoSaveContactoPorDevice.set(deviceId, agora);
        db.save();
    }
}

function getTenantDoDevice(deviceId) {
    const device = db.devices[deviceId];
    return device ? device.tenantId : null;
}

module.exports = {
    criarTenant,
    getTenant,
    autenticarTenant,
    resumoTenant,
    gerarCodigoLicenca,
    ativarLicenca,
    getLicenca,
    registrarDevice,
    autenticarDevice,
    getDeviceDoTenant,
    marcarContactoDevice,
    getTenantDoDevice,
    janelaOfflineMs,
    timestampRecente
};
