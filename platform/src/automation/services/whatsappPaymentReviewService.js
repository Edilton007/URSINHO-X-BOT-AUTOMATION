"use strict";

const automationDb = require("../database/automationDb");
const customerIdentityService = require("./customerIdentityService");
const tenantService = require("./tenantService");
const operationService = require("./operationService");
const salesService = require("../../services/salesService");
const automationBridge = require("../../services/automationBridgeService");

function encontrarPedidoDoTenant(tenantId, orderId) {
    const grupos = customerIdentityService.listarGruposDoTenant(tenantId);
    const encontrados = [];

    for (const grupo of grupos) {
        const associado = customerIdentityService.resolverTenantGrupo(grupo.groupId);
        if (!associado.ok || associado.tenantId !== tenantId) continue;
        const pedido = salesService.obterPedidoAutomationPorId(grupo.groupId, orderId);
        if (pedido) encontrados.push({ groupId: grupo.groupId, pedido });
    }

    if (encontrados.length !== 1) return null;
    return encontrados[0];
}

function validarPagamentoAssociado(groupId, pedido) {
    const pagamento = salesService.getPendingPayment(
        groupId,
        pedido.sender,
        pedido.paymentReference
    );

    if (!pagamento ||
        pagamento.status !== "numero_recebido" ||
        String(pagamento.preflightOrderId || "") !== String(pedido.id) ||
        String(pagamento.sender || "") !== String(pedido.sender || "") ||
        String(pagamento.recipientNumber || "") !== String(pedido.recipientNumber || "") ||
        String(pagamento.reference || "") !== String(pedido.paymentReference || "") ||
        String(pagamento.operator || "").toLowerCase() !== String(pedido.paymentOperator || "").toLowerCase() ||
        !Number.isFinite(Number(pagamento.amount)) ||
        Math.round(Number(pagamento.amount) * 100) !== Math.round(Number(pedido.expectedAmount) * 100) ||
        Number(pagamento.expectedMegas) !== Number(pedido.megas) ||
        Math.round(Number(pagamento.expectedAmount) * 100) !== Math.round(Number(pedido.expectedAmount) * 100)) {
        return { error: "O comprovativo, cliente, destino, referência, valor ou quantidade já não correspondem ao pedido. Nenhuma operação foi criada.", code: "PAYMENT_BINDING_MISMATCH" };
    }

    return { pagamento };
}

/**
 * Aprovação/rejeição humana no painel Tenant.
 * O grupo nunca vem do corpo HTTP: é derivado da associação persistida
 * do Tenant autenticado. OCR apenas associa o comprovativo; não aprova dinheiro.
 */
function reverPedidoWhatsApp(tenantId, orderId, decisaoInput, motivoInput) {
    const decisao = String(decisaoInput || "").trim().toUpperCase();
    const motivo = String(motivoInput || "").trim().slice(0, 500);

    if (!tenantId || !orderId) {
        return { error: "Tenant ou pedido inválido.", code: "REQUEST_INVALID", status: 400 };
    }
    if (!["CONFIRMAR", "REJEITAR"].includes(decisao)) {
        return { error: "Decisão inválida. Use CONFIRMAR ou REJEITAR.", code: "DECISION_INVALID", status: 400 };
    }
    if (motivo.length < 5) {
        return { error: "Registe a verificação efectuada (mínimo 5 caracteres).", code: "REASON_REQUIRED", status: 400 };
    }

    const encontrado = encontrarPedidoDoTenant(tenantId, orderId);
    if (!encontrado) {
        return { error: "Pedido não encontrado entre os grupos activos deste Tenant.", code: "ORDER_NOT_FOUND", status: 404 };
    }

    const { groupId, pedido } = encontrado;
    const agora = Date.now();

    if (pedido.estado === "OPERACAO_CRIADA" && pedido.operationId) {
        const anterior = operationService.listarOperacoes(tenantId)
            .find(op => op.id === pedido.operationId);
        if (decisao === "CONFIRMAR" && anterior) {
            return {
                ok: true,
                idempotente: true,
                pedido,
                operacao: { id: anterior.id, estado: anterior.estado }
            };
        }
        return { error: "O pedido já tem uma decisão registada e não pode ser alterado por esta ação.", code: "ORDER_ALREADY_REVIEWED", status: 409 };
    }

    if (pedido.estado === "PAGAMENTO_REJEITADO") {
        return { error: "Este pagamento já foi rejeitado. É necessária nova pré-verificação e novo comprovativo.", code: "PAYMENT_ALREADY_REJECTED", status: 409 };
    }

    const reviewer = "TENANT:" + tenantId;
    const estadosComComprovativo = new Set([
        "COMPROVATIVO_RECEBIDO",
        "METODO_PAGAMENTO_DIVERGENTE",
        "VALOR_DIVERGENTE"
    ]);

    if (decisao === "REJEITAR") {
        if (!estadosComComprovativo.has(pedido.estado) ||
            !pedido.paymentReference ||
            !Number.isSafeInteger(pedido.proofReceivedAtMs)) {
            return { error: "O pedido não tem um comprovativo associado para rejeição.", code: "PROOF_NOT_READY", status: 409 };
        }

        // Um comprovativo que passou as verificações automáticas deve continuar
        // ligado ao pedido e ao cliente antes de ser rejeitado no Tenant.
        // Com método/valor divergentes, não existe associação financeira válida
        // no pendingPayments; a decisão de rejeição é permitida apenas para
        // registar a ocorrência, nunca para criar uma operação.
        if (pedido.estado === "COMPROVATIVO_RECEBIDO") {
            const vinculacao = validarPagamentoAssociado(groupId, pedido);
            if (vinculacao.error) return { ...vinculacao, status: 409 };
        }

        const review = { decisao, por: reviewer, emMs: agora, motivo };
        const atualizado = salesService.atualizarEstadoPedidoAutomation(
            groupId,
            pedido.id,
            "PAGAMENTO_REJEITADO",
            { paymentReview: review }
        );
        if (!atualizado) {
            return { error: "Não foi possível guardar a rejeição do pagamento.", code: "PAYMENT_REVIEW_SAVE_FAILED", status: 500 };
        }
        salesService.updatePendingPayment(groupId, pedido.sender, pedido.paymentReference, {
            status: "rejeitado",
            paymentReview: review
        });
        automationDb.auditar?.({
            tenantId,
            acao: "WHATSAPP_PAYMENT_REJECTED",
            pedidoId: pedido.id,
            por: reviewer,
            motivo
        });
        automationDb.save();
        return { ok: true, decisao, pedido: atualizado };
    }

    if (pedido.estado !== "COMPROVATIVO_RECEBIDO") {
        return { error: "Só é possível confirmar um comprovativo cujo método, conta, titular e valor correspondem ao pedido.", code: "PROOF_NOT_VALID_FOR_CONFIRMATION", status: 409 };
    }

    const vinculacao = validarPagamentoAssociado(groupId, pedido);
    if (vinculacao.error) return { ...vinculacao, status: 409 };

    const dispositivo = tenantService.getDeviceDoTenant(tenantId);
    if (!dispositivo || !dispositivo.autorizado) {
        return { error: "Tenant sem Android Agent autorizado. O pagamento fica em revisão; nenhuma operação foi criada.", code: "DEVICE_NOT_ASSOCIATED", status: 409 };
    }

    const resultado = automationBridge.criarTransferenciaAprovada({
        groupId,
        customerJid: pedido.sender,
        recipientNumber: pedido.recipientNumber,
        paymentReference: pedido.paymentReference,
        paymentOperator: pedido.paymentOperator,
        megas: pedido.megas,
        pacote: pedido.productName || (pedido.megas + " MB"),
        approvedBy: reviewer
    });

    if (!resultado || resultado.error || !resultado.operation) {
        return {
            error: resultado?.error || "O Backend não confirmou a criação da operação. O pagamento permanece em revisão.",
            code: resultado?.code || "OPERATION_NOT_CREATED",
            status: 409
        };
    }

    const review = { decisao, por: reviewer, emMs: agora, motivo };
    const atualizado = salesService.atualizarEstadoPedidoAutomation(
        groupId,
        pedido.id,
        "OPERACAO_CRIADA",
        {
            operationId: resultado.operation.id,
            approvedBy: reviewer,
            approvedAtMs: agora,
            paymentReview: review
        }
    );
    if (!atualizado) {
        // A operação usa externalOrderId idempotente (groupId + referência).
        // Repetir a revisão recupera a mesma operação sem criar outra tarefa.
        return {
            error: "A operação foi criada, mas o estado comercial não foi actualizado. Repita a mesma confirmação para reconciliar pelo identificador idempotente.",
            code: "ORDER_UPDATE_PENDING",
            status: 500,
            operationId: resultado.operation.id
        };
    }

    salesService.updatePendingPayment(groupId, pedido.sender, pedido.paymentReference, {
        status: "confirmado",
        paymentReview: review
    });

    automationDb.auditar?.({
        tenantId,
        acao: "WHATSAPP_PAYMENT_CONFIRMED",
        pedidoId: pedido.id,
        operationId: resultado.operation.id,
        reviewer,
        motivo
    });
    automationDb.save();

    return {
        ok: true,
        decisao,
        pedido: atualizado,
        operacao: {
            id: resultado.operation.id,
            estado: resultado.operation.estado
        },
        idempotente: resultado.idempotente === true
    };
}

module.exports = {
    reverPedidoWhatsApp,
    encontrarPedidoDoTenant,
    validarPagamentoAssociado
};
