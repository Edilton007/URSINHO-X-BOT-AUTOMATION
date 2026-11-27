"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-device-recheck-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.AUTOMATION_ALLOW_EXECUTION = "true";
process.env.AUTOMATION_ALLOWED_DESTINATIONS = "841234567";
process.env.DEVICE_OFFLINE_AFTER_SEC = "120";
process.env.SIM_TELEMETRY_STALE_MIN = "30";

const db = require("../src/automation/database/automationDb");
const tenantService = require("../src/automation/services/tenantService");
const telemetry = require("../src/automation/services/simTelemetryService");
const operations = require("../src/automation/services/operationService");

test.after(() => {
    fs.rmSync(temp, { recursive: true, force: true });
});

function prepararTenantOnline(nome, deviceId) {
    const tenant = tenantService.criarTenant({ nome });
    const device = tenantService.registrarDevice(tenant.id, deviceId);
    const license = tenantService.gerarCodigoLicenca(30);
    assert.equal(tenantService.ativarLicenca(tenant.id, license.codigo).ok, true);
    tenantService.marcarContactoDevice(device.id);

    const status = telemetry.registrarStatus(tenant.id, device.id, {
        slot: 0,
        operadora: "Vodacom Moçambique",
        internetMB: 2048,
        internetTransferivelMB: 1024,
        saldoMT: null,
        subscriptionId: 701
    });
    assert.equal(status.ok, true);

    return { tenant, device };
}

test("revalida Agent depois do pagamento e mantém operação sem tarefa enquanto offline", () => {
    const { tenant, device } = prepararTenantOnline(
        "Tenant recheck offline",
        "device-recheck-offline"
    );

    const preflight = operations.preverDisponibilidade(
        tenant.id,
        device.id,
        500,
        "841234567"
    );
    assert.equal(preflight.disponivel, true);

    // Simula a perda de ligação depois do preflight e antes da autorização paga.
    db.devices[device.id].ultimoContactoMs = Date.now() - (5 * 60 * 1000);
    db.save();

    const operation = operations.criarTransferencia(
        tenant.id,
        device.id,
        500,
        "841234567",
        {
            externalOrderId: "POST-PAYMENT-DEVICE-OFFLINE-001",
            paymentReference: "TX-RECHECK-001",
            origem: "TESTE_AUTOMATIZADO"
        }
    );

    assert.equal(operation.error, undefined);
    assert.equal(operation.estado, "PENDENTE");
    assert.match(operation.motivoPendente, /Android Agent offline/);
    assert.equal(operation.taskId, null);
    assert.equal(Object.keys(db.pendingTasks).length, 0);

    // O reprocessamento automático não pode criar tarefas com heartbeat expirado.
    assert.equal(operations.reprocessarPendentes(tenant.id), 0);
    assert.equal(Object.keys(db.pendingTasks).length, 0);

    // Um novo contacto autenticado permite reavaliar a capacidade e alocar a tarefa.
    tenantService.marcarContactoDevice(device.id);
    assert.equal(operations.reprocessarPendentes(tenant.id), 1);

    const tarefas = Object.values(db.pendingTasks).filter(task => task.opId === operation.id);
    assert.equal(tarefas.length, 1);
    assert.equal(tarefas[0].deviceId, device.id);
    assert.equal(tarefas[0].simSlot, 0);
    assert.equal(tarefas[0].subscriptionId, 701);
    assert.equal(db.operations[operation.id].estado, "AGUARDANDO_EXECUCAO");
});

test("bloqueia operação quando o Device informado já não é o Device actual do Tenant", () => {
    const { tenant, device } = prepararTenantOnline(
        "Tenant recheck device antigo",
        "device-recheck-old"
    );

    db.tenants[tenant.id].deviceId = "device-recheck-replacement";
    db.save();

    const operation = operations.criarTransferencia(
        tenant.id,
        device.id,
        500,
        "841234567",
        { externalOrderId: "POST-PAYMENT-DEVICE-OLD-001" }
    );

    assert.match(operation.error, /actualmente associado/);
    assert.equal(Object.keys(db.operations).length, 0);
    assert.equal(Object.keys(db.pendingTasks).length, 0);
});
