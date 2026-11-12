"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-orphan-test-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.AUTOMATION_ALLOW_EXECUTION = "true";

const db = require("../src/automation/database/automationDb");
const tenants = require("../src/automation/services/tenantService");
const telemetry = require("../src/automation/services/simTelemetryService");
const operations = require("../src/automation/services/operationService");

test.after(() => {
  fs.rmSync(temp, { recursive: true, force: true });
});

function prepararTenant(nome, deviceNome) {
  const tenant = tenants.criarTenant({ nome });
  const licenca = tenants.gerarCodigoLicenca(30);
  tenants.ativarLicenca(tenant.id, licenca.codigo);
  const device = tenants.registrarDevice(tenant.id, deviceNome);
  const sim = telemetry.registrarStatus(tenant.id, device.id, {
    slot: 0, operadora: "Vodacom Moçambique", internetMB: 60000, saldoMT: 50, subscriptionId: 5
  });
  assert.equal(sim.ok, true);
  return { tenant, device };
}

test("falha na parte 1 cancela as partes seguintes ainda não alocadas e o pedido fica FALHOU", () => {
  const { tenant, device } = prepararTenant("Tenant Pedido Grande", "device-pedido-grande");

  const criado = operations.criarPedido(tenant.id, device.id, 30720, "258841234567");
  assert.ok(criado.pedido, JSON.stringify(criado));
  const pedido = db.pedidos[criado.pedido.id];
  assert.equal(pedido.subOps.length, 3);

  const [p1, p2, p3] = pedido.subOps.map((id) => db.operations[id]);
  assert.ok(p1.taskId, "parte 1 deve ter tarefa");
  assert.equal(p2.estado, "PENDENTE");
  assert.equal(p3.estado, "PENDENTE");

  // Simula a falha comprovada da parte 1.
  delete db.pendingTasks[p1.taskId];
  p1.estado = "FALHOU";
  p1.taskId = null;

  operations.reprocessarPendentes(tenant.id);

  assert.equal(p2.estado, "FALHOU");
  assert.equal(p3.estado, "FALHOU");
  assert.match(p2.motivoFalha, /parte 1 deste pedido falhou/);
  assert.equal(p2.taskId, null);
  assert.equal(operations.listarPedidos(tenant.id)[0].estado, "FALHOU");
});

test("parte anterior concluída não é tocada e a seguinte à falhada é cancelada", () => {
  const { tenant, device } = prepararTenant("Tenant Pedido Parcial", "device-pedido-parcial");

  const criado = operations.criarPedido(tenant.id, device.id, 30720, "258841234568");
  const pedido = db.pedidos[criado.pedido.id];
  const [p1, p2, p3] = pedido.subOps.map((id) => db.operations[id]);

  // Parte 1 concluída, parte 2 falhou, parte 3 ainda pendente.
  delete db.pendingTasks[p1.taskId];
  p1.estado = "CONCLUIDA";
  p1.taskId = null;
  p2.estado = "FALHOU";

  operations.reprocessarPendentes(tenant.id);

  assert.equal(p1.estado, "CONCLUIDA");
  assert.equal(p2.estado, "FALHOU");
  assert.equal(p3.estado, "FALHOU");
  assert.match(p3.motivoFalha, /parte 2 deste pedido falhou/);
});

test("com execução desativada as partes órfãs também são canceladas e nenhuma tarefa é criada", () => {
  const { tenant, device } = prepararTenant("Tenant Pedido Desativado", "device-pedido-desativado");
  const criado = operations.criarPedido(tenant.id, device.id, 20480, "258841234569");
  const pedido = db.pedidos[criado.pedido.id];
  const [p1, p2] = pedido.subOps.map((id) => db.operations[id]);

  delete db.pendingTasks[p1.taskId];
  p1.estado = "FALHOU";
  p1.taskId = null;

  process.env.AUTOMATION_ALLOW_EXECUTION = "false";
  try {
    assert.equal(operations.reprocessarPendentes(tenant.id), 0);
  } finally {
    process.env.AUTOMATION_ALLOW_EXECUTION = "true";
  }
  assert.equal(p2.estado, "FALHOU");
  assert.equal(p2.taskId, null);
});
