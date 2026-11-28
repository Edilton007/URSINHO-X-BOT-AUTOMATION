"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-storefront-preflight-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.AUTOMATION_ALLOW_EXECUTION = "true";
process.env.AUTOMATION_ALLOWED_DESTINATIONS = "841234567";
process.env.SIM_TELEMETRY_STALE_MIN = "30";
process.env.DEVICE_OFFLINE_AFTER_SEC = "120";

const db = require("../src/automation/database/automationDb");
const tenantService = require("../src/automation/services/tenantService");
const telemetry = require("../src/automation/services/simTelemetryService");
const operations = require("../src/automation/services/operationService");
const storefrontService = require("../src/automation/services/storefrontService");
const storefrontRoutes = require("../src/automation/routes/storefrontRoutes");

const app = express();
app.use(express.json());
app.use("/api/storefront", storefrontRoutes);

let server;
let baseUrl;
let sequence = 0;

test.before(async () => {
    await new Promise((resolve, reject) => {
        server = app.listen(0, "127.0.0.1", resolve);
        server.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
});

function prepararLoja({ quotaMB = 1000, quantidadeMB = 500, segundoSimMB = null } = {}) {
    sequence += 1;
    const tenant = tenantService.criarTenant({ nome: `Tenant Loja Preflight ${sequence}` });
    const device = tenantService.registrarDevice(tenant.id, `device-storefront-preflight-${sequence}`);
    const license = tenantService.gerarCodigoLicenca(30);
    assert.equal(tenantService.ativarLicenca(tenant.id, license.codigo).ok, true);
    tenantService.marcarContactoDevice(device.id);

    assert.equal(telemetry.registrarStatus(tenant.id, device.id, {
        slot: 0,
        operadora: "Vodacom Moçambique",
        internetMB: null,
        internetTransferivelMB: quotaMB,
        subscriptionId: 1000 + sequence * 10
    }).ok, true);

    if (segundoSimMB !== null) {
        assert.equal(telemetry.registrarStatus(tenant.id, device.id, {
            slot: 1,
            operadora: "Vodacom",
            internetMB: null,
            internetTransferivelMB: segundoSimMB,
            subscriptionId: 1001 + sequence * 10
        }).ok, true);
    }

    const slug = `storefront-preflight-${sequence}`;
    assert.equal(storefrontService.configurarLoja(tenant.id, {
        slug,
        nome: "Loja de Teste",
        publicado: true,
        metodosPagamento: [{
            id: "mpesa-teste",
            tipo: "MPESA",
            nome: "M-Pesa",
            conta: "841111111",
            titular: "Loja de Teste",
            ativo: true
        }]
    }).error, undefined);

    const product = storefrontService.criarProduto(tenant.id, {
        nome: `${quantidadeMB} MB Teste`,
        precoMT: 20,
        quantidadeMB,
        categoria: "MENSAL",
        ativo: true
    });
    assert.equal(product.error, undefined);

    return { tenant, device, slug, product: product.produto };
}

async function criarPedido(fixture, key, extra = {}) {
    return fetch(`${baseUrl}/api/storefront/${fixture.slug}/orders`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-idempotency-key": key
        },
        body: JSON.stringify({
            nome: "Cliente Teste",
            telefone: "841234567",
            paymentMethodId: "mpesa-teste",
            items: [{ productId: fixture.product.id, quantity: 1 }],
            ...extra
        })
    });
}

test("checkout público só cria pedido depois de confirmar capacidade e método de pagamento", async () => {
    const fixture = prepararLoja({ quotaMB: 1000, quantidadeMB: 500 });
    const response = await criarPedido(fixture, "storefront-preflight-valid-001");

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.pedido.pagamentoEstado, "PENDENTE_VERIFICACAO");
    assert.equal(body.pedido.pagamentoMetodo.id, "mpesa-teste");
    assert.equal(Object.values(db.pendingTasks).filter(task => task.tenantId === fixture.tenant.id).length, 0);
});

test("checkout público não cria pedido nem apresenta pagamento quando a quota é insuficiente", async () => {
    const fixture = prepararLoja({ quotaMB: 200, quantidadeMB: 500 });
    const ordersBefore = Object.keys(db.storeOrders).length;

    const response = await criarPedido(fixture, "storefront-preflight-insufficient-001");
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, "SIM_MENSAL_NAO_ELEGIVEL");
    assert.match(body.error, /quota mensal transferível livre/);
    assert.equal(Object.keys(db.storeOrders).length, ordersBefore);
    assert.equal(Object.values(db.pendingTasks).length, 0);
});

test("pré-verificação distribui pedido grande por dois SIMs sem ultrapassar 10 GB por parte", () => {
    const fixture = prepararLoja({ quotaMB: 7500, quantidadeMB: 7500, segundoSimMB: 7500 });
    const result = operations.preverDisponibilidadePedido(
        fixture.tenant.id,
        fixture.device.id,
        15000,
        "841234567"
    );

    assert.equal(result.disponivel, true);
    assert.equal(result.totalPartes, 2);
});

test("pré-verificação recusa pedido grande quando só um SIM não cobre todas as partes", () => {
    const fixture = prepararLoja({ quotaMB: 10000, quantidadeMB: 15000 });
    const result = operations.preverDisponibilidadePedido(
        fixture.tenant.id,
        fixture.device.id,
        15000,
        "841234567"
    );

    assert.equal(result.disponivel, false);
    assert.equal(result.codigo, "SIM_MENSAL_NAO_ELEGIVEL");
});

test("retry idempotente devolve o pedido registado mesmo que a capacidade já tenha mudado", async () => {
    const fixture = prepararLoja({ quotaMB: 1000, quantidadeMB: 500 });
    const key = "storefront-preflight-idempotent-001";
    const first = await criarPedido(fixture, key);
    assert.equal(first.status, 201);
    const firstBody = await first.json();

    const sim = Object.values(db.sims).find(item => item.deviceId === fixture.device.id);
    sim.internetTransferivelAtualizadoEmMs = Date.now() - 31 * 60 * 1000;
    tenantService.marcarContactoDevice(fixture.device.id);

    const repeated = await criarPedido(fixture, key);
    assert.equal(repeated.status, 200);
    const repeatedBody = await repeated.json();
    assert.equal(repeatedBody.idempotente, true);
    assert.equal(repeatedBody.pedido.id, firstBody.pedido.id);
    assert.equal(Object.values(db.storeOrders).filter(order => order.tenantId === fixture.tenant.id).length, 1);
});

test("checkout não aceita destino ou produto sem capacidade operacional", async () => {
    const fixture = prepararLoja({ quotaMB: 1000, quantidadeMB: 500 });
    const invalid = await criarPedido(fixture, "storefront-preflight-invalid-001", {
        telefone: "861234567"
    });
    assert.equal(invalid.status, 409);
    const body = await invalid.json();
    assert.equal(body.code, "PEDIDO_INVALIDO");
    assert.equal(Object.values(db.storeOrders).filter(order => order.tenantId === fixture.tenant.id).length, 0);
});
