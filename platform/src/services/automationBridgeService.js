const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const tenantService = require("../automation/services/tenantService");
const operationService = require("../automation/services/operationService");
const customerIdentityService = require("../automation/services/customerIdentityService");
const salesService = require("./salesService");

const TRACK_FILE = process.env.AUTOMATION_ORDERS_FILE
    ? path.resolve(process.env.AUTOMATION_ORDERS_FILE)
    : path.join(__dirname, "../database/automationOrders.json");
let monitorTimer = null;
let currentSocket = null;
let busy = false;
let warnedBadJson = false;

const { criarArmazem } = require("./safeJsonStore");

const trackStore = criarArmazem({
    file: TRACK_FILE,
    nome: "automationOrders.json",
    keep: 8,
    intervaloMs: 6 * 3600 * 1000,
    validar: (dados) => {
        if (dados.items !== undefined && !Array.isArray(dados.items)) throw new Error("items inválido");
    }
});

/**
 * Lê o acompanhamento. Se o ficheiro existir mas estiver ilegível (e sem
 * cópia válida), devolve broken:true e NÃO uma lista vazia, para que
 * nenhuma gravação posterior apague o histórico.
 */
function loadTrack() {
    const leitura = trackStore.ler();

    if (leitura.estado === "ausente") return { items: [], broken: false };

    if (leitura.estado === "ilegivel") {
        console.error("[AUTOMATION] automationOrders.json ilegível e sem cópia válida:", leitura.erro);
        return { items: [], broken: true };
    }

    const itens = Array.isArray(leitura.dados.items) ? leitura.dados.items : [];
    return { items: itens, broken: false };
}

function saveTrack(data) {
    if (data.broken) throw new Error("automationOrders.json está ilegível: gravação recusada para preservar os dados.");
    trackStore.gravar({ items: data.items });
}

function getGroupMappings() {
    const raw = String(process.env.AUTOMATION_GROUPS_JSON || "").trim();
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        if (!warnedBadJson) {
            warnedBadJson = true;
            console.error("[AUTOMATION] AUTOMATION_GROUPS_JSON não é JSON válido. A integração dos grupos permanece desligada.");
        }
        return {};
    }
}

function isAutomationEnabledForGroup(groupId) {
    const association = customerIdentityService.resolverTenantGrupo(groupId);

    // A associação persistida por pairing é a fonte preferencial.
    // Registos desativados/órfãos também bloqueiam o fluxo antigo,
    // em vez de permitir que uma venda manual anuncie uma entrega.
    if (association.ok || association.error) return true;

    // Compatibilidade temporária com grupos antigos configurados por ENV.
    const raw = String(process.env.AUTOMATION_GROUPS_JSON || "").trim();
    if (!raw) return false;
    const mappings = getGroupMappings();
    if (warnedBadJson) return true;
    return Object.prototype.hasOwnProperty.call(mappings, String(groupId || ""));
}

function getGroupMapping(groupId) {
    const association = customerIdentityService.resolverTenantGrupo(groupId);
    if (association.ok) return { tenantId: association.tenantId };
    if (association.error && association.code !== "GROUP_NOT_LINKED") {
        return { error: association.error };
    }

    // Fallback legado apenas quando nunca houve pairing persistido.
    const config = getGroupMappings()[String(groupId || "")];
    if (!config || typeof config !== "object") return null;
    const tenantId = String(config.tenantId || "").trim();
    const apiKey = String(config.apiKey || "").trim();
    if (!tenantId || !apiKey) return { error: "Mapeamento legado do grupo incompleto: tenantId/apiKey em falta." };
    if (!tenantService.autenticarTenant(tenantId, apiKey)) {
        return { error: "A apiKey configurada para este grupo não corresponde ao tenant." };
    }
    return { tenantId };
}

/**
 * Só é chamado por .compra, que exige um administrador real.
 * Assim, o OCR do comprovativo nunca dispara uma transferência sozinho.
 */
function criarTransferenciaAprovada({
    groupId,
    customerJid,
    recipientNumber,
    paymentReference,
    paymentOperator,
    megas,
    pacote,
    approvedBy
}) {
    if (!groupId || !String(groupId).endsWith("@g.us")) return { error: "Grupo WhatsApp inválido." };
    if (!paymentReference) return { error: "Referência de pagamento em falta." };

    const mapping = getGroupMapping(groupId);
    if (!mapping) return { error: "Este grupo não tem tenant de Automation configurado." };
    if (mapping.error) return { error: mapping.error };

    const destino = String(recipientNumber || "").replace(/\D/g, "");
    const quantidade = Number(megas);
    if (!/^\d{9,12}$/.test(destino)) return { error: "Número para receber inválido." };
    if (!Number.isInteger(quantidade) || quantidade < 100 || quantidade > 10240) {
        return { error: "A automação aceita transferências inteiras entre 100 MB e 10.240 MB." };
    }

    const tenantId = mapping.tenantId;
    const device = tenantService.getDeviceDoTenant(tenantId);
    if (!device) return { error: "O tenant ainda não tem Android Agent autorizado." };

    // Se o histórico de acompanhamento estiver ilegível, não criar uma
    // transferência sem mecanismo confiável para acompanhar/notificar o cliente.
    const track = loadTrack();
    if (track.broken) {
        return { error: "O histórico automationOrders.json está ilegível e não foi possível restaurá-lo. A transferência não foi criada; restaure a base antes de repetir." };
    }

    const externalOrderId = "BOT-" + crypto
        .createHash("sha256")
        .update(`${groupId}|${paymentReference}`)
        .digest("hex")
        .slice(0, 32)
        .toUpperCase();

    const itemRegistado = track.items.find((item) => item.externalOrderId === externalOrderId);
    if (itemRegistado) {
        const operacaoAnterior = operationService.listarOperacoes(tenantId)
            .find((item) => item.externalOrderId === externalOrderId);
        const correspondenciaValida = operacaoAnterior &&
            operacaoAnterior.id === itemRegistado.operationId &&
            String(itemRegistado.recipientNumber) === destino &&
            Number(itemRegistado.megas) === quantidade &&
            String(itemRegistado.paymentOperator || "") === String(paymentOperator || "") &&
            String(itemRegistado.customerJid || "") === String(customerJid || "");
        if (!correspondenciaValida) {
            return { error: "Existe um registo anterior desta referência, mas os dados não coincidem entre o Backend e o acompanhamento. A transferência foi bloqueada para evitar duplicação; exige revisão administrativa." };
        }
        return { operation: operacaoAnterior, externalOrderId, idempotente: true };
    }

    const operation = operationService.criarTransferencia(
        tenantId,
        device.id,
        quantidade,
        destino,
        {
            externalOrderId,
            paymentReference,
            paymentOperator,
            origem: "URSINHO_X_BOT_V2",
            grupoWhatsApp: groupId,
            clienteWhatsApp: customerJid || null,
            autorizadoPor: approvedBy || null
        }
    );

    if (operation.error) return operation;

    const existing = track.items.find(item => item.externalOrderId === externalOrderId);
    if (!existing) {
        track.items.push({
            externalOrderId,
            operationId: operation.id,
            tenantId,
            groupId,
            customerJid: customerJid || null,
            recipientNumber: destino,
            paymentReference: String(paymentReference),
            paymentOperator: paymentOperator || null,
            megas: quantidade,
            packageLabel: pacote || `${quantidade} MB`,
            createdAtMs: Date.now(),
            lastState: operation.estado,
            notifiedAtMs: null,
            notifiedState: null,
            sendingState: null,
            sendFailuresState: operation.estado,
            sendFailures: 0
        });
        saveTrack(track);
    }

    return { operation, externalOrderId, idempotente: operation.idempotente === true };
}

function buildFinalMessage(item, operation) {
    const packageLabel = item.packageLabel || `${item.megas} MB`;
    const base = `👤 Cliente: ${item.customerJid ? `@${String(item.customerJid).split("@")[0]}` : "Cliente"}\n📲 Destino: ${item.recipientNumber}\n📦 Pacote: ${packageLabel}\n🧾 Operação: ${operation.id}`;

    if (operation.estado === "CONCLUIDA") {
        return `╭━━━〔 URSINHO X AUTOMATION 〕━━━╮\n┃\n┃ ✅ TRANSFERÊNCIA CONCLUÍDA\n┃\n${base.split("\n").map(line => `┃ ${line}`).join("\n")}\n┃\n┃ O Backend confirmou a diferença real\n┃ do saldo antes/depois da execução.\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }

    if (operation.estado === "FALHOU") {
        return `╭━━━〔 URSINHO X AUTOMATION 〕━━━╮\n┃\n┃ ❌ TRANSFERÊNCIA NÃO CONCLUÍDA\n┃\n${base.split("\n").map(line => `┃ ${line}`).join("\n")}\n┃\n┃ O Backend marcou a operação como FALHOU.\n┃ Não será anunciada como entregue.\n┃ Um administrador deve verificar o caso.\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }

    if (operation.estado === "PENDENTE_REVISAO") {
        return `╭━━━〔 URSINHO X AUTOMATION 〕━━━╮\n┃\n┃ ⚠️ TRANSFERÊNCIA PENDENTE DE REVISÃO\n┃\n${base.split("\n").map(line => `┃ ${line}`).join("\n")}\n┃\n┃ A evidência não confirmou a quantidade\n┃ exata. Não marcar como entregue.\n┃ É necessária revisão administrativa.\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }

    return null;
}

async function pollOnce() {
    try {
        operationService.reprocessarPendentes();
    } catch (error) {
        console.error("[AUTOMATION] Erro ao reprocessar pendentes:", error?.message || error);
    }

    if (busy || !currentSocket) return;
    busy = true;

    try {
        const track = loadTrack();

        if (track.broken) return;

        for (const item of track.items) {
            try {
                const operations = operationService.listarOperacoes(item.tenantId);
                const operation = operations.find(op => op.id === item.operationId);
                if (!operation) continue;

                if (item.lastState !== operation.estado) {
                    item.lastState = operation.estado;
                    if (item.sendFailuresState !== operation.estado) {
                        item.sendFailuresState = operation.estado;
                        item.sendFailures = 0;
                    }
                    saveTrack(track);
                }

                if (!["CONCLUIDA", "FALHOU", "PENDENTE_REVISAO"].includes(operation.estado)) continue;

                // Cada estado é anunciado uma vez após confirmação de envio.
                // Um estado posterior (ex.: revisão resolvida) gera nova mensagem.
                const jaNotificado = item.notifiedState || (item.notifiedAtMs ? "LEGADO" : null);
                if (jaNotificado === operation.estado) continue;
                if (jaNotificado === "LEGADO" && operation.estado === "PENDENTE_REVISAO") continue;
                const falhasNesteEstado = item.sendFailuresState === operation.estado ? (item.sendFailures || 0) : 0;
                if (falhasNesteEstado >= 5) continue;

                const message = buildFinalMessage(item, operation);
                if (!message) continue;

                const updates = operation.estado === "CONCLUIDA"
                    ? { status: "confirmado", deliveryStatus: "entregue", automationState: operation.estado, completedAt: Date.now() }
                    : operation.estado === "FALHOU"
                        ? { status: "cancelado", deliveryStatus: "falhou", automationState: operation.estado, completedAt: Date.now() }
                        : { status: "em_revisao", deliveryStatus: "pendente_revisao", automationState: operation.estado, completedAt: Date.now() };

                salesService.updateOrderByOperationId(item.groupId, item.operationId, updates);

                // Regista intenção de envio, mas só marca como notificado depois
                // de sendMessage concluir. Em caso de queda pode haver repetição,
                // mas não se perde silenciosamente uma confirmação.
                item.sendingState = operation.estado;
                item.sendFailuresState = operation.estado;
                saveTrack(track);

                try {
                    const mentions = item.customerJid ? [item.customerJid] : [];
                    await currentSocket.sendMessage(item.groupId, { text: message, mentions });
                    item.notifiedState = operation.estado;
                    item.notifiedAtMs = Date.now();
                    item.sendingState = null;
                    item.sendFailures = 0;
                    saveTrack(track);
                } catch (sendError) {
                    item.sendingState = operation.estado;
                    item.sendFailuresState = operation.estado;
                    item.sendFailures = falhasNesteEstado + 1;
                    saveTrack(track);
                    console.error("[AUTOMATION] Falha ao notificar o grupo:", sendError?.message || sendError);
                }
            } catch (itemError) {
                // Um pedido com problema não pode travar os outros.
                console.error(`[AUTOMATION] Erro no pedido ${item.operationId}:`, itemError?.message || itemError);
            }
        }
    } catch (error) {
        console.error("[AUTOMATION] Erro no monitor:", error?.message || error);
    } finally {
        busy = false;
    }
}

function startAutomationMonitor(sock) {
    if (sock) currentSocket = sock;
    if (monitorTimer) return;

    const interval = Math.max(10000, Number(process.env.AUTOMATION_MONITOR_INTERVAL_MS) || 30000);
    pollOnce().catch(() => {});
    monitorTimer = setInterval(() => pollOnce().catch(() => {}), interval);
    if (typeof monitorTimer.unref === "function") monitorTimer.unref();
    console.log(`[AUTOMATION] Monitor ligado (${interval} ms).`);
}

module.exports = {
    isAutomationEnabledForGroup,
    criarTransferenciaAprovada,
    startAutomationMonitor,
    pollOnce
};
