"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-whatsapp-preflight-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.AUTOMATION_ORDERS_FILE = path.join(temp, "automationOrders.json");
process.env.AUTOMATION_ALLOW_EXECUTION = "true";
process.env.AUTOMATION_ALLOWED_DESTINATIONS = "841234567";
process.env.SIM_TELEMETRY_STALE_MIN = "30";

const tenants = require("../src/automation/services/tenantService");
const identity = require("../src/automation/services/customerIdentityService");
const telemetry = require("../src/automation/services/simTelemetryService");
const bridge = require("../src/services/automationBridgeService");

test.after(() => {
    fs.rmSync(temp, { recursive: true, force: true });
});

let grupoSequence = 0;

function prepararGrupo() {
    grupoSequence += 1;
    const tenant = tenants.criarTenant({ nome: "Tenant Grupo WhatsApp " + grupoSequence });
    const device = tenants.registrarDevice(tenant.id, "device-whatsapp-preflight-" + grupoSequence);
    const license = tenants.gerarCodigoLicenca(30);
    assert.equal(tenants.ativarLicenca(tenant.id, license.codigo).ok, true);
    tenants.marcarContactoDevice(device.id);

    const pairing = identity.criarCodigoAssociacaoGrupo(tenant.id);
    assert.equal(pairing.ok, true);
    const groupId = "123456789-123456789" + grupoSequence + "@g.us";
    const linked = identity.associarGrupoPorCodigo(groupId, "Grupo Teste", pairing.codigo);
    assert.equal(linked.ok, true);

    return { tenant, device, groupId };
}

test("grupo não autoriza pagamento sem quota mensal transferível comprovada", () => {
    const { device, groupId } = prepararGrupo();

    assert.equal(
        telemetry.registrarStatus(device.tenantId, device.id, {
            slot: 0,
            operadora: "Vodacom Moçambique",
            internetMB: 3000,
            subscriptionId: 101
        }).ok,
        true
    );

    const result = bridge.preverDisponibilidadePedido({
        groupId,
        recipientNumber: "841234567",
        megas: 500
    });

    assert.equal(result.disponivel, false);
    assert.equal(result.codigo, "SIM_MENSAL_NAO_ELEGIVEL");
});

test("grupo só recebe autorização quando Agent, destino e quota mensal passam", () => {
    const { device, groupId } = prepararGrupo();

    assert.equal(
        telemetry.registrarStatus(device.tenantId, device.id, {
            slot: 0,
            operadora: "Vodacom Moçambique",
            internetMB: 3000,
            internetTransferivelMB: 1000,
            subscriptionId: 102
        }).ok,
        true
    );

    const result = bridge.preverDisponibilidadePedido({
        groupId,
        recipientNumber: "841234567",
        megas: 500
    });

    assert.equal(result.disponivel, true);
    assert.equal(result.codigo, "CAPACIDADE_CONFIRMADA");

    const blockedRecipient = bridge.preverDisponibilidadePedido({
        groupId,
        recipientNumber: "851234567",
        megas: 500
    });
    assert.equal(blockedRecipient.disponivel, false);
    assert.equal(blockedRecipient.codigo, "DESTINO_NAO_AUTORIZADO");
});

test("preflight rejeita destino fora dos prefixos Vodacom antes do pagamento", () => {
    const { device, groupId } = prepararGrupo();

    assert.equal(
        telemetry.registrarStatus(device.tenantId, device.id, {
            slot: 0,
            operadora: "Vodacom Moçambique",
            internetMB: 3000,
            internetTransferivelMB: 1000,
            subscriptionId: 103
        }).ok,
        true
    );

    const result = bridge.preverDisponibilidadePedido({
        groupId,
        recipientNumber: "861234567",
        megas: 500
    });

    assert.equal(result.disponivel, false);
    assert.equal(result.codigo, "REQUEST_INVALID");
});

test("preflight aceita destino 84/85 com prefixo internacional +258", () => {
    const { device, groupId } = prepararGrupo();

    assert.equal(
        telemetry.registrarStatus(device.tenantId, device.id, {
            slot: 0,
            operadora: "Vodacom Moçambique",
            internetMB: 3000,
            internetTransferivelMB: 1000,
            subscriptionId: 104
        }).ok,
        true
    );

    const result = bridge.preverDisponibilidadePedido({
        groupId,
        recipientNumber: "+258 84 123 4567",
        megas: 500
    });

    assert.equal(result.disponivel, true);
    assert.equal(result.codigo, "CAPACIDADE_CONFIRMADA");
});

test("grupo sem pairing ativo não pode usar preflight de outro tenant", () => {
    const result = bridge.preverDisponibilidadePedido({
        groupId: "987654321-9876543210@g.us",
        recipientNumber: "841234567",
        megas: 500
    });
    assert.equal(result.disponivel, false);
    assert.equal(result.codigo, "GROUP_NOT_LINKED");
});
