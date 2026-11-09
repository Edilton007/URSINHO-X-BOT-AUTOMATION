"use strict";

const db = require("../database/automationDb");
const tenantService = require("./tenantService");

const FUTURE_TOLERANCE_MS = 120000;

function limiteTelemetriaMs() {
    const n = Number(process.env.SIM_TELEMETRY_STALE_MIN);
    return (Number.isFinite(n) && n >= 5 && n <= 1440 ? n : 45) * 60000;
}

function timestampState(value, now, maxAgeMs) {
    if (!Number.isSafeInteger(value) || value <= 0) return { valid: false, reason: "SEM_LEITURA", ageMs: null };
    if (value > now + FUTURE_TOLERANCE_MS) return { valid: false, reason: "TIMESTAMP_FUTURO", ageMs: null };
    const ageMs = Math.max(0, now - value);
    if (ageMs > maxAgeMs) return { valid: false, reason: "ANTIGA", ageMs };
    return { valid: true, reason: "ATUALIZADA", ageMs };
}

function avaliarDevice(deviceId, now = Date.now()) {
    const device = db.devices[deviceId] || null;
    if (!device) return { deviceId, conhecido: false, online: false, estado: "DESCONHECIDO", sims: [] };

    const heartbeat = timestampState(device.ultimoContactoMs, now, tenantService.janelaOfflineMs());
    const tenant = db.tenants[device.tenantId] || null;
    let deviceState = heartbeat.reason;
    if (tenant?.ativo === false || device.autorizado === false) deviceState = "BLOQUEADO";
    else if (heartbeat.valid) deviceState = "ONLINE";
    else if (heartbeat.reason === "SEM_LEITURA") deviceState = "SEM_CONTACTO";
    else if (heartbeat.reason === "ANTIGA") deviceState = "OFFLINE";

    const sims = Object.values(db.sims || {})
        .filter((sim) => sim.deviceId === deviceId)
        .map((sim) => {
            const health = timestampState(sim.atualizadoEmMs, now, limiteTelemetriaMs());
            return {
                simId: sim.simId || null,
                slot: Number.isInteger(sim.slot) ? sim.slot : null,
                operadora: sim.operadora || null,
                subscriptionId: Number.isInteger(sim.subscriptionId) ? sim.subscriptionId : null,
                internetMB: Number.isFinite(sim.internetMB) ? sim.internetMB : null,
                saldoMT: Number.isFinite(sim.saldoMT) ? sim.saldoMT : null,
                atualizadoEmMs: Number.isSafeInteger(sim.atualizadoEmMs) ? sim.atualizadoEmMs : null,
                estado: health.reason,
                online: health.valid,
                idadeSeg: health.ageMs === null ? null : Math.floor(health.ageMs / 1000)
            };
        })
        .sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99));

    return {
        deviceId,
        tenantId: device.tenantId,
        conhecido: true,
        autorizado: device.autorizado !== false,
        online: deviceState === "ONLINE",
        estado: deviceState,
        ultimoContactoMs: Number.isSafeInteger(device.ultimoContactoMs) ? device.ultimoContactoMs : null,
        idadeContactoSeg: heartbeat.ageMs === null ? null : Math.floor(heartbeat.ageMs / 1000),
        janelaOfflineSeg: Math.floor(tenantService.janelaOfflineMs() / 1000),
        sims
    };
}

function resumoOperacoes(tenantId, now = Date.now()) {
    const ops = Object.values(db.operations || {}).filter((op) => op.tenantId === tenantId);
    const count = (...states) => ops.filter((op) => states.includes(op.estado)).length;
    const revisoesAntigas = ops.filter((op) => op.estado === "PENDENTE_REVISAO" &&
        Number.isSafeInteger(op.atualizadaEmMs || op.criadaEmMs) &&
        now - (op.atualizadaEmMs || op.criadaEmMs) > 30 * 60000).length;
    return {
        pendentes: count("PENDENTE"),
        aguardandoOuExecutando: count("AGUARDANDO_EXECUCAO", "EXECUTANDO"),
        emRevisao: count("PENDENTE_REVISAO"),
        revisoesAntigas
    };
}

function avaliarTenant(tenantId, now = Date.now()) {
    const tenant = db.tenants[tenantId] || null;
    const device = tenant?.deviceId
        ? avaliarDevice(tenant.deviceId, now)
        : { conhecido: false, online: false, estado: "SEM_DEVICE", sims: [] };
    const operacoes = resumoOperacoes(tenantId, now);
    const sims = device.sims || [];
    const staleSimCount = sims.filter((sim) => !sim.online).length;
    let estado = "SAUDAVEL";
    if (!tenant || tenant.ativo === false || ["BLOQUEADO", "OFFLINE", "SEM_CONTACTO", "TIMESTAMP_FUTURO"].includes(device.estado)) estado = "CRITICO";
    else if (device.estado !== "ONLINE" || staleSimCount > 0 || operacoes.revisoesAntigas > 0) estado = "ATENCAO";
    return {
        tenantId,
        tenantAtivo: !!tenant && tenant.ativo !== false,
        estado,
        device,
        sims: { total: sims.length, atualizados: sims.length - staleSimCount, antigosOuSemLeitura: staleSimCount },
        operacoes,
        execucaoPermitida: String(process.env.AUTOMATION_ALLOW_EXECUTION || "false").toLowerCase() === "true",
        geradoEmMs: now
    };
}

function listarTenantsMonitorados() {
    return Object.values(db.tenants || {}).filter((tenant) => tenant && tenant.id).map((tenant) => tenant.id);
}

module.exports = { avaliarDevice, avaliarTenant, resumoOperacoes, listarTenantsMonitorados, timestampState, limiteTelemetriaMs };
