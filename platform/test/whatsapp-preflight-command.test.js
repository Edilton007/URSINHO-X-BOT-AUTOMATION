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
const command = require("../src/commands/main/disponibilidade");

test.after(() => {
    fs.rmSync(temp, { recursive: true, force: true });
});

async function preparar({ quotaMensal }) {
    const tenant = tenants.criarTenant({ nome: "Tenant Comando WhatsApp" });
    const device = tenants.registrarDevice(tenant.id, "device-command-" + (quotaMensal ? "yes" : "no"));
    const license = tenants.gerarCodigoLicenca(30);
    tenants.ativarLicenca(tenant.id, license.codigo);
    tenants.marcarContactoDevice(device.id);

    const pairing = identity.criarCodigoAssociacaoGrupo(tenant.id);
    const groupId = quotaMensal
        ? "123456789-1234567891@g.us"
        : "123456789-1234567892@g.us";
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

test("comando apresenta tabela e método M-Pesa apenas com capacidade confirmada", async () => {
    const { groupId } = await preparar({ quotaMensal: true });
    const before = Object.keys(db.operations).length;

    const resposta = await executar(groupId, ["1gb", "841234567"]);

    assert.match(resposta, /CAPACIDADE OPERACIONAL CONFIRMADA/);
    assert.match(resposta, /1 GB = 25 MT/);
    assert.match(resposta, /M-Pesa: 841111111/);
    assert.match(resposta, /verificação administrativa/);
    assert.equal(Object.keys(db.operations).length, before);
});

test("comando rejeita pacote, número ou contexto inválido", async () => {
    const { groupId } = await preparar({ quotaMensal: true });

    const pacote = await executar(groupId, ["20gb", "841234567"]);
    assert.match(pacote, /Formato:/);

    const numero = await executar(groupId, ["1gb", "861234567"]);
    assert.match(numero, /Formato:/);
});
