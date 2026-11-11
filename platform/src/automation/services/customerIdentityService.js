"use strict";

const crypto = require("crypto");

const MAX_GROUPS_PER_TENANT = 3;
const db = require("../database/automationDb");

function ensureCollections() {
    db.customers ||= {};
    db.customerTenantRelations ||= {};
    db.whatsappTenantGroups ||= {};
}

function clean(value, max = 120) {
    return String(value || "").trim().slice(0, max);
}

function normalizarJid(value) {
    let jid = clean(value, 180).toLowerCase();
    if (!jid) return null;
    // Alguns eventos do Baileys entregam o número sem sufixo JID.
    const digits = jid.replace(/^\+/, "");
    if (/^\d{8,15}$/.test(digits)) jid = digits + "@s.whatsapp.net";
    if (!/@(s\.whatsapp\.net|lid)$/.test(jid)) return null;
    return jid;
}

function customerIdFor(jid) {
    return "CUS-" + crypto.createHash("sha256").update(jid).digest("hex").slice(0, 32).toUpperCase();
}

function relationKey(customerId, tenantId) {
    return customerId + "::" + tenantId;
}

function tenantExiste(tenantId) {
    return !!db.tenants?.[tenantId] && db.tenants[tenantId].ativo !== false;
}

function registarContacto(jidInput, nome = "", persist = true) {
    ensureCollections();
    const jid = normalizarJid(jidInput);
    if (!jid) return { error: "Identificador WhatsApp inválido." };

    const customerId = customerIdFor(jid);
    const agora = Date.now();
    const atual = db.customers[customerId];
    db.customers[customerId] = {
        id: customerId,
        jid,
        nome: clean(nome, 100) || atual?.nome || "",
        criadoEmMs: atual?.criadoEmMs || agora,
        atualizadoEmMs: agora,
        ultimaAtividadeEmMs: agora
    };
    if (persist) db.save();
    return { ok: true, cliente: { ...db.customers[customerId] } };
}

/**
 * Associa um grupo observado pelo socket WhatsApp a um Tenant.
 * Esta função deve ser chamada apenas pelo processo Bot autenticado
 * depois de confirmar que o bot é membro do grupo e que o código
 * de associação foi emitido pelo Tenant.
 */
function associarGrupo(tenantId, groupIdInput, groupName = "", pairingCode) {
    ensureCollections();
    if (!tenantExiste(tenantId)) return { error: "Tenant inexistente ou desativado." };

    const groupId = clean(groupIdInput, 180).toLowerCase();
    if (!/^\d{5,25}-\d{5,25}@g\.us$/.test(groupId)) {
        return { error: "Identificador de grupo WhatsApp inválido." };
    }

    const code = clean(pairingCode, 40).toUpperCase();
    const challenge = db.system?.whatsappGroupPairings?.[code];
    if (!challenge || challenge.tenantId !== tenantId || challenge.estado !== "PENDENTE" ||
        !Number.isSafeInteger(challenge.expiraEmMs) || challenge.expiraEmMs <= Date.now()) {
        return { error: "Código de associação inválido ou expirado." };
    }

    const existing = db.whatsappTenantGroups[groupId];
    if (existing && existing.tenantId !== tenantId && existing.ativo !== false) {
        return { error: "Este grupo já está associado a outra loja." };
    }

    const alreadyActiveForTenant = existing && existing.tenantId === tenantId && existing.ativo !== false;
    const activeGroupCount = Object.values(db.whatsappTenantGroups)
        .filter(group => group.tenantId === tenantId && group.ativo !== false).length;
    if (!alreadyActiveForTenant && activeGroupCount >= MAX_GROUPS_PER_TENANT) {
        return { error: "Este Tenant já atingiu o limite de 3 grupos WhatsApp." };
    }

    const agora = Date.now();
    db.whatsappTenantGroups[groupId] = {
        groupId, tenantId, nome: clean(groupName, 100),
        ativo: true, associadoEmMs: existing?.associadoEmMs || agora,
        atualizadoEmMs: agora
    };
    challenge.estado = "UTILIZADO";
    challenge.utilizadoEmMs = agora;
    db.save();
    return { ok: true, grupo: { ...db.whatsappTenantGroups[groupId] } };
}

function criarCodigoAssociacaoGrupo(tenantId, ttlMs = 10 * 60 * 1000) {
    ensureCollections();
    if (!tenantExiste(tenantId)) return { error: "Tenant inexistente ou desativado." };
    const activeGroupCount = Object.values(db.whatsappTenantGroups)
        .filter(group => group.tenantId === tenantId && group.ativo !== false).length;
    if (activeGroupCount >= MAX_GROUPS_PER_TENANT) {
        return { error: "Este Tenant já atingiu o limite de 3 grupos WhatsApp." };
    }
    const ttl = Number(ttlMs);
    if (!Number.isSafeInteger(ttl) || ttl < 60_000 || ttl > 15 * 60 * 1000) {
        return { error: "Validade do código deve estar entre 1 e 15 minutos." };
    }
    db.system.whatsappGroupPairings ||= {};
    const code = crypto.randomBytes(5).toString("hex").toUpperCase();
    const agora = Date.now();
    db.system.whatsappGroupPairings[code] = {
        tenantId, estado: "PENDENTE", criadoEmMs: agora, expiraEmMs: agora + ttl
    };
    db.save();
    return { ok: true, codigo: code, expiraEmMs: agora + ttl };
}


function associarGrupoPorCodigo(groupId, groupName = "", pairingCode) {
    ensureCollections();
    const code = clean(pairingCode, 40).toUpperCase();
    const challenge = db.system?.whatsappGroupPairings?.[code];
    if (!challenge) return { error: "Código de associação inválido ou expirado." };
    return associarGrupo(challenge.tenantId, groupId, groupName, code);
}

function listarGruposDoTenant(tenantId) {
    ensureCollections();
    return Object.values(db.whatsappTenantGroups)
        .filter(g => g.tenantId === tenantId && g.ativo !== false)
        .map(g => ({ ...g }));
}

/**
 * Resolve a associação já validada por pairing para uso interno do Backend.
 * Um registo desativado não é tratado como grupo desconhecido: isso impede
 * que uma configuração antiga em variável de ambiente reative o grupo.
 */
function resolverTenantGrupo(groupIdInput) {
    ensureCollections();
    const groupId = clean(groupIdInput, 180).toLowerCase();
    if (!groupId || !/^\\d{5,25}-\\d{5,25}@g\\.us$/.test(groupId)) {
        return { error: "Identificador de grupo WhatsApp inválido.", code: "GROUP_ID_INVALID" };
    }

    const group = db.whatsappTenantGroups[groupId];
    if (!group) return { ok: false, code: "GROUP_NOT_LINKED" };
    if (group.ativo === false) {
        return { error: "Este grupo está desassociado do Tenant.", code: "GROUP_DISABLED" };
    }
    if (!tenantExiste(group.tenantId)) {
        return { error: "O Tenant associado ao grupo está desativado ou não existe.", code: "TENANT_DISABLED" };
    }

    return { ok: true, tenantId: group.tenantId, grupo: { ...group } };
}

function removerGrupo(tenantId, groupIdInput) {
    ensureCollections();
    const groupId = clean(groupIdInput, 180).toLowerCase();
    const group = db.whatsappTenantGroups[groupId];
    if (!group || group.tenantId !== tenantId) return { error: "Grupo não encontrado." };
    group.ativo = false;
    group.removidoEmMs = Date.now();
    db.save();
    return { ok: true };
}

function aplicarMembroGrupo(groupId, group, jidInput, nome = "", membroAtivo = true) {
    const contacto = registarContacto(jidInput, nome, false);
    if (contacto.error) return contacto;
    const customerId = contacto.cliente.id;
    const key = relationKey(customerId, group.tenantId);
    const atual = db.customerTenantRelations[key] || {
        customerId, tenantId: group.tenantId, groupIds: [],
        primeiraAssociacaoEmMs: Date.now(), estado: "ATIVO"
    };
    if (membroAtivo && !atual.groupIds.includes(groupId)) atual.groupIds.push(groupId);
    if (!membroAtivo) atual.groupIds = atual.groupIds.filter(id => id !== groupId);
    atual.estado = atual.groupIds.length ? "MEMBRO_GRUPO" : "RELACAO_COMERCIAL";
    atual.ultimaAtualizacaoEmMs = Date.now();
    db.customerTenantRelations[key] = atual;
    return { ok: true, customerId, tenantId: group.tenantId, estado: atual.estado };
}

function atualizarMembroGrupo(groupIdInput, jidInput, nome = "", membroAtivo = true) {
    ensureCollections();
    const groupId = clean(groupIdInput, 180).toLowerCase();
    const group = db.whatsappTenantGroups[groupId];
    if (!group || group.ativo === false) return { error: "Grupo não associado a uma loja." };

    const result = aplicarMembroGrupo(groupId, group, jidInput, nome, membroAtivo);
    if (result.ok) db.save();
    return result;
}

function sincronizarMembrosGrupo(groupIdInput, participants = []) {
    ensureCollections();
    const groupId = clean(groupIdInput, 180).toLowerCase();
    const group = db.whatsappTenantGroups[groupId];
    if (!group || group.ativo === false) return { error: "Grupo não associado a uma loja." };
    if (!Array.isArray(participants) || participants.length > 5000) {
        return { error: "Lista de membros inválida para sincronização." };
    }

    let sincronizados = 0;
    let ignorados = 0;
    for (const participant of participants) {
        const jid = typeof participant === "string"
            ? participant
            : participant?.phoneNumber || participant?.id || participant?.jid || participant?.lid;
        const nome = typeof participant === "string"
            ? ""
            : participant?.notify || participant?.name || "";
        if (!jid) {
            ignorados++;
            continue;
        }
        const result = aplicarMembroGrupo(groupId, group, jid, nome, true);
        if (result.ok) sincronizados++;
        else ignorados++;
    }

    if (sincronizados > 0) db.save();
    return { ok: true, sincronizados, ignorados };
}

function listarTenantsDoCliente(jidInput) {
    ensureCollections();
    const jid = normalizarJid(jidInput);
    if (!jid) return [];
    const customerId = customerIdFor(jid);
    return Object.values(db.customerTenantRelations)
        .filter(r => r.customerId === customerId)
        .map(r => ({ tenantId: r.tenantId, groupIds: [...r.groupIds], estado: r.estado }));
}

/**
 * No privado, nunca escolhe silenciosamente a loja mais recente.
 * O chamador deve pedir seleção quando houver mais de uma relação.
 */
function resolverTenantPrivado(jidInput, tenantSelecionado = null) {
    const relacoes = listarTenantsDoCliente(jidInput);
    const ativas = relacoes.filter(r => tenantExiste(r.tenantId));
    if (tenantSelecionado) {
        const escolhida = ativas.find(r => r.tenantId === tenantSelecionado);
        return escolhida
            ? { ok: true, tenantId: escolhida.tenantId }
            : { error: "A loja selecionada não está associada a este contacto.", code: "TENANT_NOT_LINKED" };
    }
    if (ativas.length === 1) return { ok: true, tenantId: ativas[0].tenantId };
    if (ativas.length > 1) return { ok: false, code: "TENANT_SELECTION_REQUIRED", tenants: ativas };
    return { ok: false, code: "STORE_SELECTION_REQUIRED", tenants: [] };
}

module.exports = {
    registarContacto,
    criarCodigoAssociacaoGrupo,
    associarGrupo,
    associarGrupoPorCodigo,
    listarGruposDoTenant,
    resolverTenantGrupo,
    removerGrupo,
    atualizarMembroGrupo,
    sincronizarMembrosGrupo,
    listarTenantsDoCliente,
    resolverTenantPrivado
};
