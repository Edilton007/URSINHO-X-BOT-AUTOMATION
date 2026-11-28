"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-admin-payment-review-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.ADMIN_API_KEY = "ursinho-admin-payment-test-key";
process.env.AUTOMATION_ALLOW_EXECUTION = "false";
process.env.AUTOMATION_ALLOWED_DESTINATIONS = "";

const tenantService = require("../src/automation/services/tenantService");
const storefrontService = require("../src/automation/services/storefrontService");
const db = require("../src/automation/database/automationDb");
const adminRoutes = require("../src/automation/routes/adminRoutes");

const app = express();
app.use(express.json());
app.use("/admin", adminRoutes);

let server;
let baseUrl;

test.before(async () => {
    await new Promise((resolve, reject) => {
        server = app.listen(0, "127.0.0.1", resolve);
        server.once("error", reject);
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
});

let sequence = 0;

function criarPedido() {
    sequence += 1;
    const tenant = tenantService.criarTenant({ nome: `Tenant Pagamento Admin ${sequence}` });
    assert.equal(tenant.error, undefined);

    const device = tenantService.registrarDevice(tenant.id, `device-admin-payment-${sequence}`);
    assert.equal(device.error, undefined);

    const license = tenantService.gerarCodigoLicenca(30);
    assert.equal(license.error, undefined);
    assert.equal(tenantService.ativarLicenca(tenant.id, license.codigo).ok, true);

    const slug = `admin-payment-review-${sequence}`;
    const store = storefrontService.configurarLoja(tenant.id, {
        slug,
        publicado: true,
        metodosPagamento: [
            { id: "mpesa-admin", tipo: "MPESA", conta: "841111111", titular: "Tenant" }
        ]
    });
    assert.equal(store.error, undefined);

    const product = storefrontService.criarProduto(tenant.id, {
        nome: "Pacote 1 GB",
        precoMT: 50,
        quantidadeMB: 1024,
        categoria: "MENSAL",
        ativo: true
    });
    assert.equal(product.error, undefined);

    const created = storefrontService.criarPedidoPublico(
        slug,
        {
            nome: "Cliente de Teste",
            telefone: "841234567",
            items: [{ productId: product.produto.id, quantity: 1 }],
            paymentMethodId: "mpesa-admin"
        },
        `admin-payment-review-key-${sequence}`
    );
    assert.equal(created.error, undefined);
    return { tenant, order: created.pedido };
}

async function rever(orderId, decisao) {
    return fetch(`${baseUrl}/admin/store-orders/${encodeURIComponent(orderId)}/payment-review`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-admin-key": process.env.ADMIN_API_KEY
        },
        body: JSON.stringify({
            decisao,
            motivo: "Histórico de pagamento consultado pelo administrador.",
            referencia: "TX-ADMIN-TEST"
        })
    });
}

test("uma confirmação de pagamento não pode ser repetida nem substituída", async () => {
    const { tenant, order } = criarPedido();

    const first = await rever(order.id, "CONFIRMADO");
    assert.equal(first.status, 200);
    const firstBody = await first.json();
    assert.equal(firstBody.pedido.pagamentoEstado, "CONFIRMADO_MANUALMENTE");

    const operationCount = Object.keys(db.operations).length;
    const repeated = await rever(order.id, "CONFIRMADO");
    assert.equal(repeated.status, 409);
    const repeatedBody = await repeated.json();
    assert.equal(repeatedBody.code, "ORDER_ALREADY_REVIEWED");

    const updatedOrder = storefrontService.todosPedidos().find(item => item.id === order.id);
    assert.equal(updatedOrder.pagamentoEstado, "CONFIRMADO_MANUALMENTE");
    assert.equal(updatedOrder.revisaoPagamento.decisao, "CONFIRMADO");
    assert.equal(Object.keys(db.operations).length, operationCount);
    assert.equal(updatedOrder.tenantId, tenant.id);
});

test("um pagamento rejeitado não pode ser posteriormente confirmado pela mesma decisão", async () => {
    const { order } = criarPedido();
    const operationCount = Object.keys(db.operations).length;

    const first = await rever(order.id, "REJEITADO");
    assert.equal(first.status, 200);
    const firstBody = await first.json();
    assert.equal(firstBody.pedido.pagamentoEstado, "REJEITADO_MANUALMENTE");
    assert.equal(firstBody.fulfillment, null);

    const second = await rever(order.id, "CONFIRMADO");
    assert.equal(second.status, 409);
    const secondBody = await second.json();
    assert.equal(secondBody.code, "ORDER_ALREADY_REVIEWED");

    const updatedOrder = storefrontService.todosPedidos().find(item => item.id === order.id);
    assert.equal(updatedOrder.pagamentoEstado, "REJEITADO_MANUALMENTE");
    assert.equal(updatedOrder.revisaoPagamento.decisao, "REJEITADO");
    assert.equal(Object.keys(db.operations).length, operationCount);
});

test("decisões inválidas são recusadas sem alterar o pedido", async () => {
    const { order } = criarPedido();

    const response = await rever(order.id, "PAGO");
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, "INVALID_PAYMENT_DECISION");

    const unchanged = storefrontService.todosPedidos().find(item => item.id === order.id);
    assert.equal(unchanged.pagamentoEstado, "PENDENTE_VERIFICACAO");
    assert.equal(unchanged.revisaoPagamento, null);
});
