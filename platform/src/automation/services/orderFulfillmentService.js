"use strict";

const db = require("../database/automationDb");
const operationService = require("./operationService");

const ESTADOS_PAGAMENTO_AUTORIZADOS = new Set([
    "CONFIRMADO_MANUALMENTE",
    "CONFIRMADO_AUTOMATICAMENTE"
]);

function normalizarDestinoVodacom(valor) {
    let numero = String(valor || "").replace(/\D/g, "");
    if (numero.startsWith("258") && numero.length === 12) numero = numero.slice(3);
    if (!/^(84|85)\d{7}$/.test(numero)) return null;
    return numero;
}

function classificarEstadoFulfillment(estadoOperacao, subestados = []) {
    const estados = [estadoOperacao, ...(Array.isArray(subestados) ? subestados : [])]
        .filter(Boolean);
    if (estados.includes("PENDENTE_REVISAO")) return "PENDENTE_REVISAO";
    if (estados.includes("PENDENTE")) return "AGUARDANDO_RECURSOS";
    if (estados.some(estado => ["AGUARDANDO_EXECUCAO", "EXECUTANDO"].includes(estado))) {
        return "EM_PROCESSAMENTO";
    }
    return "EM_PROCESSAMENTO";
}

function calcularMegas(order) {
    if (!Array.isArray(order.items) || order.items.length === 0) {
        return { error: "O pedido não contém pacotes de Internet." };
    }

    let total = 0;
    for (const item of order.items) {
        const mb = Number(item.quantidadeMB);
        const quantidade = Number(item.quantity);
        if (!Number.isSafeInteger(mb) || mb < 100 ||
            !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 99) {
            return { error: "Um pacote não tem quantidade de megas válida para transferência." };
        }
        total += mb * quantidade;
        if (!Number.isSafeInteger(total) || total > 204800) {
            return { error: "O pedido excede o limite operacional de 204800 MB." };
        }
    }

    return { megas: total };
}

/**
 * Cria a operação telecom apenas a partir de um pedido cuja confirmação de
 * pagamento foi registada pelo Backend. A trava PROCESSANDO é persistida
 * antes de criar tarefas; após reinício, um estado incerto não é repetido.
 */
function cumprirPedidoPago(orderId, tenantId) {
    const order = db.storeOrders?.[String(orderId || "")];
    if (!order || order.tenantId !== tenantId) {
        return { error: "Pedido não encontrado para este Tenant.", code: "ORDER_NOT_FOUND" };
    }

    if (!ESTADOS_PAGAMENTO_AUTORIZADOS.has(order.pagamentoEstado)) {
        return {
            error: "A transferência só pode ser criada depois da confirmação do pagamento.",
            code: "PAYMENT_NOT_CONFIRMED",
            status: 402
        };
    }

    const estadosJaCriados = new Set([
        "AGUARDANDO_RECURSOS",
        "EM_PROCESSAMENTO",
        "PENDENTE_REVISAO",
        "CONCLUIDO"
    ]);
    if (estadosJaCriados.has(order.fulfillmentStatus)) {
        return {
            ok: true,
            idempotente: true,
            fulfillmentStatus: order.fulfillmentStatus,
            operationId: order.operationId || null,
            operationIds: order.operationIds || []
        };
    }
    if (order.fulfillmentStatus === "PROCESSANDO") {
        return {
            error: "O pedido já está a ser processado. Não será criada uma segunda operação.",
            code: "FULFILLMENT_IN_PROGRESS",
            status: 409
        };
    }
    if (order.fulfillmentStatus === "REVISAO_NECESSARIA") {
        return {
            error: "O pedido exige revisão administrativa antes de qualquer nova tentativa.",
            code: "FULFILLMENT_REVIEW_REQUIRED",
            status: 409
        };
    }

    // Novos pedidos guardam o destino separadamente do contacto do cliente.
    // Pedidos antigos continuam compatíveis: telefone era o destino no modelo anterior.
    const destino = normalizarDestinoVodacom(order.destino || order.telefone);
    if (!destino) {
        return { error: "O destino não é um número Vodacom 84/85 válido.", code: "INVALID_VODACOM_DESTINATION" };
    }

    const calculo = calcularMegas(order);
    if (calculo.error) {
        order.fulfillmentStatus = "REVISAO_NECESSARIA";
        order.fulfillmentError = calculo.error;
        order.atualizadoEmMs = Date.now();
        db.auditar?.({
            tenantId,
            acao: "ORDER_FULFILLMENT_BLOCKED",
            orderId: order.id,
            motivo: calculo.error
        });
        db.save();
        return { error: calculo.error, code: "INVALID_ORDER_PACKAGES" };
    }

    const tenant = db.tenants?.[tenantId];
    const deviceId = tenant?.deviceId;
    if (!deviceId) {
        return { error: "Tenant sem Android Agent associado.", code: "DEVICE_NOT_ASSOCIATED" };
    }

    order.fulfillmentStatus = "PROCESSANDO";
    order.fulfillmentStartedAtMs = Date.now();
    order.fulfillmentError = null;
    order.atualizadoEmMs = Date.now();
    db.save();

    let result;
    try {
        result = operationService.criarPedido(
            tenantId,
            deviceId,
            calculo.megas,
            destino
        );
    } catch (error) {
        order.fulfillmentStatus = "REVISAO_NECESSARIA";
        order.fulfillmentError = "Erro interno ao criar a operação. Revisão manual obrigatória; não repetir automaticamente.";
        order.atualizadoEmMs = Date.now();
        db.auditar?.({
            tenantId,
            acao: "ORDER_FULFILLMENT_ERROR",
            orderId: order.id,
            error: String(error?.message || error).slice(0, 200)
        });
        db.save();
        return {
            error: order.fulfillmentError,
            code: "FULFILLMENT_INTERNAL_ERROR"
        };
    }

    if (!result || result.error) {
        order.fulfillmentStatus = "REVISAO_NECESSARIA";
        order.fulfillmentError = String(result?.error || "Não foi possível criar a operação.");
        order.atualizadoEmMs = Date.now();
        db.auditar?.({
            tenantId,
            acao: "ORDER_FULFILLMENT_REJECTED",
            orderId: order.id,
            motivo: order.fulfillmentError
        });
        db.save();
        return {
            error: order.fulfillmentError,
            code: "FULFILLMENT_REJECTED"
        };
    }

    const operation = result.operacao || null;
    const pedido = result.pedido || null;
    const operationIds = pedido?.suboperacoes?.map(item => item.id).filter(Boolean) ||
        (operation?.id ? [operation.id] : []);

    order.operationId = operation?.id || operationIds[0] || null;
    order.operationIds = operationIds;
    const estadosSuboperacoes = pedido?.suboperacoes?.map(item => item.estado) || [];
    order.fulfillmentStatus = classificarEstadoFulfillment(operation?.estado, estadosSuboperacoes);
    order.fulfillmentStartedAtMs ||= Date.now();
    order.fulfillmentUpdatedAtMs = Date.now();
    order.fulfillmentError = null;
    order.atualizadoEmMs = Date.now();
    db.auditar?.({
        tenantId,
        acao: "ORDER_FULFILLMENT_CREATED",
        orderId: order.id,
        operationId: order.operationId,
        operationIds,
        megas: calculo.megas,
        destino
    });
    db.save();

    return {
        ok: true,
        idempotente: false,
        fulfillmentStatus: order.fulfillmentStatus,
        operationId: order.operationId,
        operationIds,
        operacao: operation,
        pedido
    };
}

module.exports = {
    cumprirPedidoPago,
    normalizarDestinoVodacom,
    calcularMegas,
    classificarEstadoFulfillment
};
