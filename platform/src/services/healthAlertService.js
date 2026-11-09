"use strict";

const db = require("../automation/database/automationDb");
const health = require("../automation/services/deviceHealthService");

let timer = null;
let currentSocket = null;
let polling = false;

function ownerPrivateJid() {
    const raw = String(process.env.OWNER_NUMBER || process.env.OWNER || "").trim();
    const digits = raw.replace(/\D/g, "");
    if (!/^\d{9,15}$/.test(digits)) return null;
    return `${digits}@s.whatsapp.net`;
}

function issueMessage(kind, tenantId, detail) {
    const prefix = `\nTenant: ${tenantId}`;
    const messages = {
        DEVICE_OFFLINE: `⚠️ URSINHO X AUTOMATION\nAgent sem contacto ou offline. O heartbeat está ausente ou ultrapassou a janela de 120 segundos.${prefix}`,
        DEVICE_RECOVERED: `✅ URSINHO X AUTOMATION\nAgent voltou a comunicar com o Backend.${prefix}`,
        SIM_STALE: `⚠️ URSINHO X AUTOMATION\nTelemetria SIM antiga ou inválida: ${detail}.${prefix}`,
        SIM_RECOVERED: `✅ URSINHO X AUTOMATION\nA telemetria do SIM foi atualizada: ${detail}.${prefix}`,
        REVIEW_STUCK: `⚠️ URSINHO X AUTOMATION\nExiste uma operação em revisão há mais de 30 minutos: ${detail}.${prefix}`,
        BACKUP_FAILED: `🚨 URSINHO X AUTOMATION\nO backup externo falhou. Nenhum snapshot novo foi confirmado. Verifique o log privado do servidor.\nMotivo: ${String(detail || "não informado").slice(0, 240)}`
    };
    return messages[kind] || null;
}

async function sendPrivate(kind, tenantId, detail = "") {
    const jid = ownerPrivateJid();
    if (!jid || jid.endsWith("@g.us")) {
        console.warn("[HEALTH] Alertas desativados: OWNER_NUMBER/OWNER não é um número privado válido.");
        return false;
    }
    if (!currentSocket || typeof currentSocket.sendMessage !== "function") return false;
    const text = issueMessage(kind, tenantId, detail);
    if (!text) return false;
    try {
        await currentSocket.sendMessage(jid, { text });
        return true;
    } catch (error) {
        console.error("[HEALTH] Falha ao enviar alerta privado:", error?.message || error);
        return false;
    }
}

async function checkOnce() {
    if (polling || !currentSocket) return;
    polling = true;
    try {
        db.system = db.system || {};
        const sent = db.system.healthAlertState || (db.system.healthAlertState = {});
        const now = Date.now();
        let changed = false;

        for (const tenantId of health.listarTenantsMonitorados()) {
            const snapshot = health.avaliarTenant(tenantId, now);
            const deviceKey = `device:${tenantId}`;
            const previousDevice = sent[deviceKey];
            const deviceIsOffline = ["OFFLINE", "SEM_CONTACTO", "TIMESTAMP_FUTURO"].includes(snapshot.device.estado);
            if (deviceIsOffline && previousDevice !== "OFFLINE") {
                if (await sendPrivate("DEVICE_OFFLINE", tenantId)) { sent[deviceKey] = "OFFLINE"; changed = true; }
            } else if (snapshot.device.estado === "ONLINE" && previousDevice === "OFFLINE") {
                if (await sendPrivate("DEVICE_RECOVERED", tenantId)) { sent[deviceKey] = "ONLINE"; changed = true; }
            } else if (!previousDevice && snapshot.device.estado === "ONLINE") {
                sent[deviceKey] = "ONLINE"; changed = true;
            }

            for (const sim of snapshot.device.sims || []) {
                const simKey = `sim:${tenantId}:${sim.slot ?? "unknown"}`;
                const previous = sent[simKey];
                if (!sim.online && previous !== sim.estado) {
                    if (await sendPrivate("SIM_STALE", tenantId, `slot ${sim.slot ?? "?"}: ${sim.estado}`)) { sent[simKey] = sim.estado; changed = true; }
                } else if (sim.online && previous && previous !== "ATUALIZADA") {
                    if (await sendPrivate("SIM_RECOVERED", tenantId, `slot ${sim.slot ?? "?"}`)) { sent[simKey] = "ATUALIZADA"; changed = true; }
                } else if (sim.online && !previous) { sent[simKey] = "ATUALIZADA"; changed = true; }
            }

            const oldReviews = Object.values(db.operations || {}).filter((op) => op.tenantId === tenantId &&
                op.estado === "PENDENTE_REVISAO" && now - (op.atualizadaEmMs || op.criadaEmMs || now) > 30 * 60000);
            for (const op of oldReviews) {
                const key = `review:${op.id}`;
                if (!sent[key] && await sendPrivate("REVIEW_STUCK", tenantId, op.id)) { sent[key] = now; changed = true; }
            }
        }
        if (changed) db.save();
    } catch (error) {
        console.error("[HEALTH] Erro ao verificar alertas:", error?.message || error);
    } finally {
        polling = false;
    }
}

function startHealthAlertMonitor(socket) {
    if (socket) currentSocket = socket;
    if (timer) return;
    const interval = 60000;
    timer = setInterval(() => checkOnce().catch(() => {}), interval);
    if (typeof timer.unref === "function") timer.unref();
    checkOnce().catch(() => {});
    console.log(`[HEALTH] Monitor de alertas iniciado (${interval} ms). Destinatário: proprietário privado.`);
}

async function sendBackupFailure(error) {
    return sendPrivate("BACKUP_FAILED", "PLATAFORMA", error?.message || String(error || "erro desconhecido"));
}

module.exports = { ownerPrivateJid, issueMessage, sendPrivate, sendBackupFailure, checkOnce, startHealthAlertMonitor };
