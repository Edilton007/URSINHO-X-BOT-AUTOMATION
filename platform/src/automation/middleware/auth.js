const crypto = require("crypto");
// ============================================================
// auth.js — NOVO
//
// O histórico do projeto (setembro/2026) indicava uma única
// x-api-key partilhada — explicitamente sinalizado como
// "aceitável só para testes, não para produção com múltiplos
// tenants". Esta implementação separa:
//   - apiKey por TENANT (usada pelo Tenant App)
//   - apiKey por DEVICE (usada pelo Android Agent)
// Cada uma só autoriza o que lhe pertence (isolamento real).
// ============================================================

const tenantService = require("../services/tenantService");

/**
 * Protege as rotas /automation/tenants/:tenantId/*
 * Exige x-api-key correspondente a ESSE tenantId.
 */
function autenticarTenant(req, res, next) {
    const tenantId = req.params.tenantId;
    const apiKey = req.get("x-api-key");

    if (!apiKey) {
        return res.status(401).json({ ok: false, error: "x-api-key em falta." });
    }

    if (!tenantService.autenticarTenant(tenantId, apiKey)) {
        return res.status(403).json({ ok: false, error: "Tenant ou apiKey inválidos." });
    }

    next();
}

/**
 * Protege as rotas /automation/device/:deviceId/*
 * Exige x-api-key correspondente a ESSE deviceId.
 */
function autenticarDevice(req, res, next) {
    const deviceId = req.params.deviceId;
    const apiKey = req.get("x-api-key");

    if (!apiKey) {
        return res.status(401).json({ ok: false, error: "x-api-key em falta." });
    }

    if (!tenantService.autenticarDevice(deviceId, apiKey)) {
        return res.status(403).json({ ok: false, error: "Device ou apiKey inválidos." });
    }

    tenantService.marcarContactoDevice(deviceId);

    next();
}

/**
 * Protege as rotas administrativas (/admin/*).
 * Usa uma chave separada, só do dono da plataforma — NUNCA a
 * mesma chave de um tenant ou device.
 */
function autenticarAdmin(req, res, next) {
    const chave = req.get("x-admin-key");

    if (!process.env.ADMIN_API_KEY) {
        return res.status(500).json({
            ok: false,
            error: "ADMIN_API_KEY não configurada no servidor."
        });
    }

    const esperado = Buffer.from(String(process.env.ADMIN_API_KEY));
    const recebido = Buffer.from(String(chave || ""));
    const igual = !!chave && esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);

    if (!igual) {
        return res.status(403).json({ ok: false, error: "Acesso administrativo negado." });
    }

    next();
}

module.exports = {
    autenticarTenant,
    autenticarDevice,
    autenticarAdmin
};
