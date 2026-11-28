"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-whatsapp-command-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.AUTOMATION_ORDERS_FILE = path.join(temp, "automationOrders.json");
process.env.SALES_DB_FILE = path.join(temp, "sales.json");
process.env.AUTOMATION_ALLOW_EXECUTION = "true";
process.env.AUTOMATION_ALLOWED_DESTINATIONS = "841234567";
process.env.SIM_TELEMETRY_STALE_MIN = "30";

const db = require("../src/automation/database/automationDb");
const tenants = require("../src/automation/services/tenantService");
const identity = require("../src/automation/services/customerIdentityService");
const telemetry = require("../src/automation/services/simTelemetryService");
const sales = require("../src/services/salesService");
const storefront = require("../src/automation/services/storefrontService");
const command = require("../src/commands/main/disponibilidade");

test.after(() => {
    fs.rmSync(temp, { recursive: true, force: true });
});

let commandSequence = 0;

async function preparar({ quotaMensal }) {
    commandSequence += 1;
    const tenant = tenants.criarTenant({ nome: "Tenant Comando WhatsApp " + commandSequence });
    const device = tenants.registrarDevice(tenant.id, "device-command-" + commandSequence);
    const license = tenants.gerarCodigoLicenca(30);
    tenants.ativarLicenca(tenant.id, license.codigo);
    tenants.marcarContactoDevice(device.id);

    const pairing = identity.criarCodigoAssociacaoGrupo(tenant.id);
    const groupId = "123456789-123456789" + (20 + commandSequence) + "@g.us";
    identity.associarGrupoPorCodigo(groupId, "Grupo Cliente", pairing.codigo);

    telemetry.registrarStatus(tenant.id, device.id, {
        slot: 0,
        operadora: "Vodacom Moçambique",
        internetMB: 4000,
        ...(quotaMensal ? { internetTransferivelMB: 2000 } : {}),
        subscriptionId: quotaMensal ? 111 : 112
    });

    sales.setSalesEnabled(groupId, true);
    sales.setPayment(groupId, "mpesa", "841111111", "Conta Loja");
    sales.setVendaIATabela(groupId, "1 GB = 25 MT");

    return { tenant, device, groupId };
}

async function executar(groupId, args) {
    let resposta = "";
    const ctx = {
        isGroup: true,
        chat: groupId,
        args,
        prefix: "!",
        sender: "258844444444@s.whatsapp.net",
        reply: async (message) => { resposta = String(message); return resposta; }
    };
    await command.run(null, null, ctx);
    return resposta;
}

test("comando só mostra pagamentos depois da pré-verificação operacional positiva", async () => {
    const { groupId } = await preparar({ quotaMensal: false });
    const before = Object.keys(db.operations).length;

    const resposta = await executar(groupId, ["1gb", "841234567"]);

    assert.match(resposta, /PEDIDO NÃO AUTORIZADO PARA PAGAMENTO/);
    assert.match(resposta, /Não efectues o pagamento ainda/);
    assert.doesNotMatch(resposta, /M-Pesa:/);
    assert.equal(Object.keys(db.operations).length, before);
});

test("comando apresenta preço e método Tenant depois de pré-verificação positiva", async () => {
    const { tenant, groupId } = await preparar({ quotaMensal: true });
    storefront.configurarLoja(tenant.id, {
        slug: "tenant-command-main",
        nome: "Loja Principal",
        publicado: true,
        metodosPagamento: [
            { id: "tenant-mpesa", tipo: "MPESA", nome: "M-Pesa Tenant", conta: "841222222", titular: "Titular Tenant" }
        ]
    });
    storefront.criarProduto(tenant.id, {
        nome: "Pacote 1 GB",
        precoMT: 25,
        quantidadeMB: 1024,
        ativo: true
    });

    const before = Object.keys(db.operations).length;
    const resposta = await executar(groupId, ["1gb", "841234567"]);

    assert.match(resposta, /PEDIDO PRÉ-VALIDADO/);
    assert.match(resposta, /Pacote 1 GB/);
    assert.match(resposta, /25\.00 MT/);
    assert.match(resposta, /M-Pesa Tenant: 841222222/);
    assert.match(resposta, /expira em 30 minutos/);
    assert.equal(Object.keys(db.operations).length, before);
});

test("configuração de pagamento do Tenant substitui contas legadas do grupo", async () => {
    const { tenant, groupId } = await preparar({ quotaMensal: true });

    const store = storefront.configurarLoja(tenant.id, {
        slug: "tenant-checkout-source",
        nome: "Loja Tenant",
        publicado: true,
        metodosPagamento: [
            { id: "tenant-mpesa", tipo: "MPESA", nome: "M-Pesa Tenant", conta: "841222222", titular: "Titular Tenant" }
        ]
    });
    assert.equal(store.ok, true);

    const product = storefront.criarProduto(tenant.id, {
        nome: "Pacote mensal 1 GB",
        precoMT: 32.5,
        quantidadeMB: 1024,
        ativo: true
    });
    assert.equal(product.error, undefined);

    const resposta = await executar(groupId, ["1gb", "841234567"]);

    assert.match(resposta, /Pacote mensal 1 GB/);
    assert.match(resposta, /32\.50 MT/);
    assert.match(resposta, /841222222/);
    assert.doesNotMatch(resposta, /841111111/);
});

test("comando rejeita pacote, número ou contexto inválido", async () => {
    const { groupId } = await preparar({ quotaMensal: true });

    const pacote = await executar(groupId, ["20gb", "841234567"]);
    assert.match(pacote, /Formato:/);

    const numero = await executar(groupId, ["1gb", "861234567"]);
    assert.match(numero, /Formato:/);
});
