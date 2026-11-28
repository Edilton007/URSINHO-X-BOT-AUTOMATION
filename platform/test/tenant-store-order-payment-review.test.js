"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-tenant-store-payment-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.SALES_DB_FILE = path.join(temp, "sales.json");
process.env.AUTOMATION_ORDERS_FILE = path.join(temp, "automationOrders.json");
process.env.AUTOMATION_ALLOW_EXECUTION = "true";
process.env.AUTOMATION_ALLOWED_DESTINATIONS = "841234567";
process.env.DEVICE_OFFLINE_AFTER_SEC = "120";

const db = require("../src/automation/database/automationDb");
const tenantService = require("../src/automation/services/tenantService");
const telemetry = require("../src/automation/services/simTelemetryService");
const storefrontService = require("../src/automation/services/storefrontService");
const tenantRoutes = require("../src/automation/routes/tenantRoutes");

const app = express();
app.use(express.json());
app.use("/automation/tenants", tenantRoutes);

let server;
let baseUrl;
let sequence = 0;

test.before(async () => {
    server = await new Promise((resolve, reject) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
        listener.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
});

function criarFixture({ quotaMB = 2000 } = {}) {
    sequence += 1;
    const tenant = tenantService.criarTenant({ nome: `Tenant Loja Review ${sequence}` });
    const device = tenantService.registrarDevice(tenant.id, `device-store-review-${sequence}`);
    const license = tenantService.gerarCodigoLicenca(30);
    assert.equal(tenantService.ativarLicenca(tenant.id, license.codigo).ok, true);
    tenantService.marcarContactoDevice(device.id);

    assert.equal(telemetry.registrarStatus(tenant.id, device.id, {
        slot: 0,
        operadora: "Vodacom Moçambique",
        internetMB: null,
        internetTransferivelMB: quotaMB,
        subscriptionId: 5000 + sequence
    }).ok, true);

    const slug = `tenant-store-review-${sequence}`;
    assert.equal(storefrontService.configurarLoja(tenant.id, {
        slug,
        publicado: true,
        metodosPagamento: [{
            id: "mpesa-review",
            tipo: "MPESA",
            nome: "M-Pesa",
            conta: "841111111",
            titular: "Tenant Review",
            ativo: true
        }]
    }).error, undefined);

    const product = storefrontService.criarProduto(tenant.id, {
        nome: "Pacote de 500 MB",
        precoMT: 25,
        quantidadeMB: 500,
        categoria: "MENSAL",
        ativo: true
    });
    assert.equal(product.error, undefined);

    const result = storefrontService.criarPedidoPublico(
        slug,
        {
            nome: "Cliente Loja",
            telefone: "861112223",
            paymentMethodId: "mpesa-review",
            items: [{ productId: product.produto.id, quantity: 1 }]
        },
        `tenant-store-review-key-${sequence}`
    );
    assert.equal(result.error, undefined);
    result.pedido.destino = "841234567";
    db.save();
    return { tenant, order: result.pedido };
}

async function rever(fixture, decision, extra = {}, tenantId = fixture.tenant.id, apiKey = fixture.tenant.apiKey) {
    return fetch(
        `${baseUrl}/automation/tenants/${encodeURIComponent(tenantId)}/store-orders/${encodeURIComponent(fixture.order.id)}/payment-review`,
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
                ...(apiKey ? { "x-api-key": apiKey } : {})
            },
            body: JSON.stringify({
                decisao: decision,
                motivo: "Transação consultada no serviço externo.",
                referencia: "TX-STORE-TEST",
                ...extra
            })
        }
    );
}

test("pedido público só pode ser confirmado pelo Tenant autenticado que o possui", async () => {
    const fixture = criarFixture();
    const response = await rever(fixture, "CONFIRMADO");
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.pedido.pagamentoEstado, "CONFIRMADO_MANUALMENTE");
    assert.equal(body.pedido.revisaoPagamento.decisao, "CONFIRMADO");
    assert.equal(body.pedido.revisaoPagamento.referencia, "TX-STORE-TEST");
    assert.equal(body.fulfillment.ok, true);
    assert.ok(body.fulfillment.operationId);

    const operation = Object.values(db.operations).find(item => item.tenantId === fixture.tenant.id);
    assert.ok(operation);
    assert.equal(operation.destino, "841234567");
    assert.equal(
        Object.values(db.pendingTasks).filter(task => task.tenantId === fixture.tenant.id).length,
        1
    );
});

test("rejeitar pagamento não cria operação e a decisão não pode ser substituída", async () => {
    const fixture = criarFixture();
    const before = Object.values(db.operations).filter(item => item.tenantId === fixture.tenant.id).length;

    const rejected = await rever(fixture, "REJEITADO");
    assert.equal(rejected.status, 200);
    const rejectedBody = await rejected.json();
    assert.equal(rejectedBody.pedido.pagamentoEstado, "REJEITADO_MANUALMENTE");
    assert.equal(rejectedBody.fulfillment, null);

    const repeated = await rever(fixture, "CONFIRMADO");
    assert.equal(repeated.status, 409);
    const repeatedBody = await repeated.json();
    assert.equal(repeatedBody.code, "ORDER_ALREADY_REVIEWED");

    assert.equal(
        Object.values(db.operations).filter(item => item.tenantId === fixture.tenant.id).length,
        before
    );
    assert.equal(
        Object.values(db.pendingTasks).filter(task => task.tenantId === fixture.tenant.id).length,
        0
    );
});

test("rota de revisão exige chave do Tenant e isola pedidos de outros Tenants", async () => {
    const owner = criarFixture();
    const other = criarFixture();

    const missingKey = await rever(owner, "CONFIRMADO", {}, owner.tenant.id, null);
    assert.equal(missingKey.status, 401);

    const wrongKey = await rever(owner, "CONFIRMADO", {}, owner.tenant.id, other.tenant.apiKey);
    assert.equal(wrongKey.status, 403);

    const foreignOrder = await rever(other, "CONFIRMADO", {}, owner.tenant.id, owner.tenant.apiKey);
    assert.equal(foreignOrder.status, 404);
    const body = await foreignOrder.json();
    assert.equal(body.code, "ORDER_NOT_FOUND");
});

test("decisões e justificações inválidas não alteram o pedido", async () => {
    const fixture = criarFixture();

    const invalidDecision = await rever(fixture, "APROVAR_TUDO");
    assert.equal(invalidDecision.status, 400);
    assert.equal((await invalidDecision.json()).code, "INVALID_PAYMENT_DECISION");

    const invalidReason = await rever(fixture, "CONFIRMADO", { motivo: "não" });
    assert.equal(invalidReason.status, 400);
    assert.equal((await invalidReason.json()).code, "REVIEW_REASON_REQUIRED");

    const order = storefrontService.listarPedidos(fixture.tenant.id).find(item => item.id === fixture.order.id);
    assert.equal(order.pagamentoEstado, "PENDENTE_VERIFICACAO");
    assert.equal(order.revisaoPagamento, null);
});
