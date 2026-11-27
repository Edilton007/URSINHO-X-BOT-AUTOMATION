"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-wa-payment-review-"));
process.env.SALES_DB_FILE = path.join(temp, "sales.json");
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.AUTOMATION_ORDERS_FILE = path.join(temp, "automationOrders.json");
process.env.AUTOMATION_ALLOW_EXECUTION = "true";
process.env.AUTOMATION_ALLOWED_DESTINATIONS = "841234567";
process.env.DEVICE_OFFLINE_AFTER_SEC = "120";
process.env.SIM_TELEMETRY_STALE_MIN = "30";

const db = require("../src/automation/database/automationDb");
const tenantService = require("../src/automation/services/tenantService");
const identity = require("../src/automation/services/customerIdentityService");
const telemetry = require("../src/automation/services/simTelemetryService");
const sales = require("../src/services/salesService");
const reviewService = require("../src/automation/services/whatsappPaymentReviewService");

test.after(() => {
    fs.rmSync(temp, { recursive: true, force: true });
});

let groupCounter = 0;

function prepararTenantComPedido(nome) {
    groupCounter += 1;
    const tenant = tenantService.criarTenant({ nome });
    assert.ok(tenant.id);
    const device = tenantService.registrarDevice(tenant.id, `device-payment-review-${groupCounter}`);
    assert.ok(device.id);

    const license = tenantService.gerarCodigoLicenca(30);
    assert.ok(license.codigo);
    assert.equal(tenantService.ativarLicenca(tenant.id, license.codigo).ok, true);

    const groupId = `123456789-12345678${groupCounter}@g.us`;
    const pairing = identity.criarCodigoAssociacaoGrupo(tenant.id);
    assert.ok(pairing.codigo);
    assert.equal(identity.associarGrupoPorCodigo(groupId, `Grupo Teste ${groupCounter}`, pairing.codigo).ok, true);

    tenantService.marcarContactoDevice(device.id);
    const sim = telemetry.registrarStatus(tenant.id, device.id, {
        slot: 0,
        operadora: "Vodacom Moçambique",
        internetMB: 4096,
        internetTransferivelMB: 4096,
        saldoMT: null,
        subscriptionId: 700 + groupCounter
    });
    assert.equal(sim.ok, true);
    tenantService.marcarContactoDevice(device.id);
    assert.equal(tenantService.getDeviceDoTenant(tenant.id).online, true);

    const sender = `25884444444${groupCounter}@s.whatsapp.net`;
    const created = sales.criarPedidoAutomationPendente(groupId, {
        sender,
        recipientNumber: "841234567",
        megas: 500,
        expectedAmount: 25,
        productId: `PROD-${groupCounter}`,
        productName: "Pacote 500 MB",
        productCategory: "MENSAL",
        validityDays: 30,
        paymentMethods: [
            {
                id: "PAY-MPESA",
                tipo: "MPESA",
                conta: "841222222",
                titular: "Titular M-Pesa",
                ativo: true
            }
        ]
    });
    assert.equal(created.ok, true);

    const proof = sales.associarComprovativoAoPedidoAutomation(groupId, sender, {
        reference: `TX-REVIEW-${groupCounter}`,
        operator: "mpesa",
        amount: 25,
        destination: "841222222",
        destinationName: "Titular M-Pesa"
    });
    assert.equal(proof.ok, true);
    assert.equal(proof.pedido.estado, "COMPROVATIVO_RECEBIDO");

    const pending = sales.savePendingPayment(groupId, {
        reference: proof.pedido.paymentReference,
        sender,
        pushName: "Cliente de teste",
        operator: "mpesa",
        amount: 25,
        dateTime: new Date().toISOString(),
        destination: "841222222",
        destinationName: "Titular M-Pesa",
        recipientNumber: proof.pedido.recipientNumber,
        preflightOrderId: proof.pedido.id,
        expectedMegas: proof.pedido.megas,
        expectedAmount: proof.pedido.expectedAmount,
        status: "numero_recebido"
    });
    assert.equal(pending.status, "numero_recebido");

    return { tenant, device, groupId, sender, pedido: proof.pedido };
}

test("Tenant pode confirmar manualmente comprovativo e cria uma única operação idempotente", () => {
    const { tenant, pedido, groupId, sender } = prepararTenantComPedido("Tenant aprovação manual");

    const result = reviewService.reverPedidoWhatsApp(
        tenant.id,
        pedido.id,
        "CONFIRMAR",
        "Valor confirmado no histórico real do M-Pesa."
    );

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.decisao, "CONFIRMAR");
    assert.ok(result.operacao.id);
    assert.equal(result.operacao.estado, "AGUARDANDO_EXECUCAO");
    assert.equal(result.pedido.estado, "OPERACAO_CRIADA");
    assert.equal(result.pedido.operationId, result.operacao.id);

    const operationList = require("../src/automation/services/operationService").listarOperacoes(tenant.id);
    assert.equal(operationList.length, 1);
    assert.equal(operationList[0].paymentReference, pedido.paymentReference);
    assert.equal(operationList[0].destino, "841234567");
    assert.equal(operationList[0].megas, 500);

    const audit = db.auditoria.find(item =>
        item.acao === "WHATSAPP_PAYMENT_CONFIRMED" && item.pedidoId === pedido.id
    );
    assert.ok(audit);
    assert.equal(audit.por, "TENANT:" + tenant.id);

    const pending = sales.getPendingPayment(groupId, sender, pedido.paymentReference);
    assert.equal(pending.status, "confirmado");

    const repeated = reviewService.reverPedidoWhatsApp(
        tenant.id,
        pedido.id,
        "CONFIRMAR",
        "Verificação repetida após timeout de resposta."
    );
    assert.equal(repeated.ok, true, JSON.stringify(repeated));
    assert.equal(repeated.idempotente, true);
    assert.equal(repeated.operacao.id, result.operacao.id);
    assert.equal(require("../src/automation/services/operationService").listarOperacoes(tenant.id).length, 1);
});

test("Tenant pode rejeitar comprovativo sem criar operação e a decisão fica irreversível", () => {
    const { tenant, pedido, groupId, sender } = prepararTenantComPedido("Tenant rejeição manual");

    const rejected = reviewService.reverPedidoWhatsApp(
        tenant.id,
        pedido.id,
        "REJEITAR",
        "Transação não encontrada na conta de recebimento."
    );

    assert.equal(rejected.ok, true, JSON.stringify(rejected));
    assert.equal(rejected.pedido.estado, "PAGAMENTO_REJEITADO");
    assert.equal(require("../src/automation/services/operationService").listarOperacoes(tenant.id).length, 0);
    assert.equal(Object.values(db.pendingTasks).filter(task => task.tenantId === tenant.id).length, 0);

    const pending = sales.getPendingPayment(groupId, sender, pedido.paymentReference);
    assert.equal(pending.status, "rejeitado");

    const repeated = reviewService.reverPedidoWhatsApp(
        tenant.id,
        pedido.id,
        "CONFIRMAR",
        "Tentativa de alterar decisão rejeitada."
    );
    assert.equal(repeated.code, "PAYMENT_ALREADY_REJECTED");
    assert.equal(require("../src/automation/services/operationService").listarOperacoes(tenant.id).length, 0);
});

test("permite rejeitar comprovativo com valor divergente, mas bloqueia a sua confirmação", () => {
    const { tenant, pedido, groupId, sender } = prepararTenantComPedido("Tenant comprovativo divergente");

    sales.removePendingPayment(groupId, sender, pedido.paymentReference);
    sales.atualizarEstadoPedidoAutomation(
        groupId,
        pedido.id,
        "VALOR_DIVERGENTE",
        {
            paymentReference: "TX-DIVERGENTE-VALOR",
            paymentOperator: "mpesa",
            detectedAmount: 20,
            proofReceivedAtMs: Date.now()
        }
    );

    const confirmation = reviewService.reverPedidoWhatsApp(
        tenant.id,
        pedido.id,
        "CONFIRMAR",
        "Valor conferido no histórico."
    );
    assert.equal(confirmation.code, "PROOF_NOT_VALID_FOR_CONFIRMATION");
    assert.equal(require("../src/automation/services/operationService").listarOperacoes(tenant.id).length, 0);

    const rejection = reviewService.reverPedidoWhatsApp(
        tenant.id,
        pedido.id,
        "REJEITAR",
        "O valor recebido não coincide com o valor do pedido."
    );
    assert.equal(rejection.ok, true, JSON.stringify(rejection));
    assert.equal(rejection.pedido.estado, "PAGAMENTO_REJEITADO");
    assert.equal(require("../src/automation/services/operationService").listarOperacoes(tenant.id).length, 0);

    const audit = db.auditoria.find(item =>
        item.acao === "WHATSAPP_PAYMENT_REJECTED" && item.pedidoId === pedido.id
    );
    assert.ok(audit);
    assert.equal(audit.por, "TENANT:" + tenant.id);
});

test("Tenant diferente não consegue consultar nem rever pedido de outro Tenant", () => {
    const owner = prepararTenantComPedido("Tenant proprietário do pedido");
    const intruder = tenantService.criarTenant({ nome: "Tenant sem associação" });
    const result = reviewService.reverPedidoWhatsApp(
        intruder.id,
        owner.pedido.id,
        "CONFIRMAR",
        "Tentativa cruzada não autorizada."
    );

    assert.equal(result.code, "ORDER_NOT_FOUND");
    assert.equal(require("../src/automation/services/operationService").listarOperacoes(owner.tenant.id).length, 0);
});

test("recusa a confirmação quando o Device autorizado está ausente", () => {
    const { tenant, pedido } = prepararTenantComPedido("Tenant sem Device activo");
    db.devices[tenantService.getDeviceDoTenant(tenant.id).id].autorizado = false;
    db.save();

    const result = reviewService.reverPedidoWhatsApp(
        tenant.id,
        pedido.id,
        "CONFIRMAR",
        "Pagamento consultado e confirmado externamente."
    );

    assert.equal(result.code, "DEVICE_NOT_ASSOCIATED");
    assert.equal(sales.obterPedidoAutomationPorId(
        pedido.groupId,
        pedido.id
    ).estado, "COMPROVATIVO_RECEBIDO");
    assert.equal(require("../src/automation/services/operationService").listarOperacoes(tenant.id).length, 0);
});
