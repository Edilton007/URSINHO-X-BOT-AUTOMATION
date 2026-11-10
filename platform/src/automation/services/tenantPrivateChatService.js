"use strict";

const crypto = require("crypto");
const db = require("../database/automationDb");
const identity = require("./customerIdentityService");
const storefront = require("./storefrontService");

function ensureSessions() {
    db.system.whatsappPrivateSessions ||= {};
}

function keyFor(jid) {
    const normalized = String(jid || "").trim().toLowerCase();
    return "WPS-" + crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

function tenantLabel(tenantId) {
    const tenant = db.tenants?.[tenantId];
    return tenant?.nome || "Loja";
}

function menuLojas(relations) {
    return [
        "🏬 *As tuas lojas no URSINHO X BOT*",
        "",
        ...relations.map((r, i) => `${i + 1}. ${tenantLabel(r.tenantId)}`),
        "",
        "Responde com o número da loja para continuar."
    ].join("\n");
}

async function handle(sock, message, sender, text) {
    const cleanText = String(text || "").trim();
    if (!cleanText) return false;

    const relations = identity.listarTenantsDoCliente(sender)
        .filter(r => db.tenants?.[r.tenantId] && db.tenants[r.tenantId].ativo !== false);
    if (!relations.length) return false;

    ensureSessions();
    const sessionKey = keyFor(sender);
    const session = db.system.whatsappPrivateSessions[sessionKey] || {};
    const normalizedCommand = cleanText.toLowerCase();

    if (/^(?:\.ursinho\s+)?(?:lojas|minhas lojas)$/i.test(cleanText)) {
        db.system.whatsappPrivateSessions[sessionKey] = {
            ...session, tenantIds: relations.map(r => r.tenantId),
            estado: "SELECIONAR_LOJA", atualizadoEmMs: Date.now()
        };
        db.save();
        await sock.sendMessage(message.key.remoteJid, { text: menuLojas(relations) }, { quoted: message });
        return true;
    }

    if (session.estado === "SELECIONAR_LOJA" && /^\d{1,2}$/.test(cleanText)) {
        const selected = relations[Number(cleanText) - 1];
        if (!selected) {
            await sock.sendMessage(message.key.remoteJid, { text: "Número inválido. Escolhe uma das lojas apresentadas." }, { quoted: message });
            return true;
        }
        db.system.whatsappPrivateSessions[sessionKey] = {
            tenantId: selected.tenantId, estado: "LOJA_SELECIONADA",
            atualizadoEmMs: Date.now()
        };
        db.save();
        await sock.sendMessage(message.key.remoteJid, {
            text: `✅ Loja selecionada: *${tenantLabel(selected.tenantId)}*\n\nComandos disponíveis:\n• *catalogo* ou *.catalogo* para ver produtos\n• *lojas* para trocar de loja\n• *ajuda loja* para ver esta ajuda`
        }, { quoted: message });
        return true;
    }

    let tenantId = session.tenantId;
    if (tenantId && !relations.some(r => r.tenantId === tenantId)) tenantId = null;

    if (!tenantId && relations.length === 1) {
        tenantId = relations[0].tenantId;
        db.system.whatsappPrivateSessions[sessionKey] = {
            tenantId, estado: "LOJA_SELECIONADA", atualizadoEmMs: Date.now()
        };
        db.save();
    }

    if (!tenantId && relations.length > 1) {
        db.system.whatsappPrivateSessions[sessionKey] = {
            tenantIds: relations.map(r => r.tenantId),
            estado: "SELECIONAR_LOJA", atualizadoEmMs: Date.now()
        };
        db.save();
        await sock.sendMessage(message.key.remoteJid, { text: menuLojas(relations) }, { quoted: message });
        return true;
    }

    if (!tenantId) return false;

    if (/^(?:\.ursinho\s+)?(?:ajuda loja|ajuda da loja)$/i.test(cleanText)) {
        await sock.sendMessage(message.key.remoteJid, {
            text: `🏬 *${tenantLabel(tenantId)}*\n\n• *catalogo* para consultar produtos\n• *lojas* para trocar de loja\n\nPara pagamentos, segue apenas as instruções apresentadas no pedido. Nunca envies PIN ou código secreto.`
        }, { quoted: message });
        return true;
    }

    if (/^(?:\.ursinho\s+)?(?:catalogo|catálogo|produtos)$/i.test(cleanText)) {
        const store = storefront.getStoreByTenant(tenantId);
        if (!store || store.publicado !== true) {
            await sock.sendMessage(message.key.remoteJid, { text: "A loja selecionada ainda não está disponível." }, { quoted: message });
            return true;
        }
        const catalog = storefront.catalogoPublico(store.slug);
        if (!catalog) {
            await sock.sendMessage(message.key.remoteJid, { text: "Não foi possível carregar o catálogo desta loja." }, { quoted: message });
            return true;
        }
        const products = catalog.produtos || [];
        const lines = products.map((p, i) => `${i + 1}. *${p.nome}*\n   ${p.precoMT} MT${p.descricao ? `\n   ${p.descricao}` : ""}`);
        const payment = (catalog.loja.metodosPagamento || []).map(m => `• ${m.nome}: ${m.conta}`).join("\n");
        const body = [
            `🛍️ *${catalog.loja.nome}*`,
            catalog.loja.descricao || "",
            "",
            ...(lines.length ? lines : ["Neste momento não há produtos publicados."]),
            "",
            payment ? "*Métodos de pagamento disponíveis:*\n" + payment : "Contacta a loja para conhecer os métodos de pagamento.",
            "",
            "Para trocar de loja, escreve *lojas*."
        ].filter(Boolean).join("\n");
        await sock.sendMessage(message.key.remoteJid, { text: body }, { quoted: message });
        return true;
    }

    if (normalizedCommand === "loja" || normalizedCommand === ".loja") {
        await sock.sendMessage(message.key.remoteJid, {
            text: `Estás a falar com *${tenantLabel(tenantId)}*. Escreve *catalogo* para ver os produtos ou *lojas* para trocar de loja.`
        }, { quoted: message });
        return true;
    }

    return false;
}

module.exports = { handle };
