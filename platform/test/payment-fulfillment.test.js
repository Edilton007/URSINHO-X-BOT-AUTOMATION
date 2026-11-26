"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-payment-fulfillment-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.AUTOMATION_ALLOW_EXECUTION = "false";
process.env.AUTOMATION_ALLOWED_DESTINATIONS = "841234567";

const db = require("../src/automation/database/automationDb");
const tenantService = require("../src/automation/services/tenantService");
const storefrontService = require("../src/automation/services/storefrontService");
const fulfillmentService = require("../src/automation/services/orderFulfillmentService");

test.after(() => {
    fs.rmSync(temp, { recursive: true, force: true });
});

let sequenciaTeste = 0;

function criarPedidoDeTeste() {
    sequenciaTeste += 1;
    const tenant = tenantService.criarTenant({ nome: `Tenant Pagamentos ${sequenciaTeste}` });
    const device = tenantService.registrarDevice(tenant.id, `device-payment-test-${sequenciaTeste}`);
    assert.equal(device.error, undefined);

    const license = tenantService.gerarCodigoLicenca(30);
    assert.equal(license.error, undefined);
    assert.equal(tenantService.ativarLicenca(tenant.id, license.codigo).ok, true);

    const lojaResult = storefrontService.configurarLoja(tenant.id, {
        slug: "payment-fulfillment-test",
        publicado: true,
        metodosPagamento: [
            { id: "mpesa-principal", tipo: "MPESA", conta: "841111111", titular: "Tenant" }
        ]
    });
    assert.equal(lojaResult.error, undefined);

    const produtoResult = storefrontService.criarProduto(tenant.id, {
        nome: "Pacote mensal de teste",
        precoMT: 50,
        quantidadeMB: 250,
        ativo: true
    });
    assert.equal(produtoResult.error, undefined);

    const pedidoResult = storefrontService.criarPedidoPublico(
        "payment-fulfillment-test",
        {
            nome: "Cliente Teste",
            telefone: "+258 84 123 4567",
            items: [{ productId: produtoResult.produto.id, quantity: 1 }],
            paymentMethodId: "mpesa-principal"
        },
        "payment-fulfillment-key-01"
    );
    assert.equal(pedidoResult.error, undefined);

    return { tenant, order: pedidoResult.pedido };
}

test("pedido sem pagamento confirmado não cria operação telecom", () => {
    const { tenant, order } = criarPedidoDeTeste();
    const antes = Object.keys(db.operations).length;

    const result = fulfillmentService.cumprirPedidoPago(order.id, tenant.id);

    assert.equal(result.error, "A transferência só pode ser criada depois da confirmação do pagamento.");
    assert.equal(result.code, "PAYMENT_NOT_CONFIRMED");
    assert.equal(result.status, 402);
    assert.equal(Object.keys(db.operations).length, antes);
});

test("pagamento confirmado cria uma única operação e pedidos repetidos são idempotentes", () => {
    const { tenant, order } = criarPedidoDeTeste();
    const payment = storefrontService.resolverPagamento(
        order.id,
        "CONFIRMADO",
        "Comprovativo verificado",
        "TX-TEST-001",
        "admin"
    );
    assert.equal(payment.error, undefined);
    assert.equal(payment.pedido.pagamentoEstado, "CONFIRMADO_MANUALMENTE");

    const antes = Object.keys(db.operations).length;
    const result = fulfillmentService.cumprirPedidoPago(order.id, tenant.id);

    assert.equal(result.ok, true);
    assert.equal(result.idempotente, false);
    assert.equal(result.fulfillmentStatus, "AGUARDANDO_RECURSOS");
    assert.ok(result.operationId);
    assert.equal(Object.keys(db.operations).length, antes + 1);

    const repetido = fulfillmentService.cumprirPedidoPago(order.id, tenant.id);
    assert.equal(repetido.ok, true);
    assert.equal(repetido.idempotente, true);
    assert.equal(repetido.operationId, result.operationId);
    assert.equal(Object.keys(db.operations).length, antes + 1);
});

test("destino fora do padrão Vodacom 84/85 não é convertido em operação", () => {
    const { tenant, order } = criarPedidoDeTeste();
    storefrontService.resolverPagamento(order.id, "CONFIRMADO", "Comprovativo verificado", "TX-TEST-002", "admin");
    order.telefone = "861234567";

    const antes = Object.keys(db.operations).length;
    const result = fulfillmentService.cumprirPedidoPago(order.id, tenant.id);

    assert.equal(result.code, "INVALID_VODACOM_DESTINATION");
    assert.equal(Object.keys(db.operations).length, antes);
});
