"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-flows-test-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
// Só dentro deste processo de teste: o estado do servidor e a configuração do
// repositório não mudam, e a "execução" aqui é a máquina de estados do Backend
// a receber evidências simuladas. Nenhum USSD existe neste ambiente.
process.env.AUTOMATION_ALLOW_EXECUTION = "true";

const db = require("../src/automation/database/automationDb");
const tenants = require("../src/automation/services/tenantService");
const telemetry = require("../src/automation/services/simTelemetryService");
const operations = require("../src/automation/services/operationService");

test.after(() => {
  fs.rmSync(temp, { recursive: true, force: true });
});

let contador = 0;

function prepararPedido(megas = 30720) {
  contador += 1;
  const tenant = tenants.criarTenant({ nome: `Tenant Fluxo ${contador}` });
  const licenca = tenants.gerarCodigoLicenca(30);
  tenants.ativarLicenca(tenant.id, licenca.codigo);
  const device = tenants.registrarDevice(tenant.id, `device-fluxo-${contador}`);
  const status = telemetry.registrarStatus(tenant.id, device.id, {
    slot: 0, operadora: "Vodacom Moçambique", internetMB: 60000, saldoMT: 50, subscriptionId: 10 + contador
  });
  assert.equal(status.ok, true);

  const criado = operations.criarPedido(tenant.id, device.id, megas, `25884${String(1000000 + contador)}`);
  assert.ok(criado.pedido, JSON.stringify(criado));
  const pedido = db.pedidos[criado.pedido.id];
  const partes = pedido.subOps.map((id) => db.operations[id]);
  return { tenant, device, pedido, partes };
}

/** Reclama a tarefa e entrega evidência pelo fluxo real do Backend. */
function executarParte(device, parte, evidencia) {
  const inicio = operations.iniciarTarefa(device.id, parte.taskId);
  assert.equal(inicio.ok, true, JSON.stringify(inicio));
  return operations.registrarResultado(parte.taskId, {
    deviceId: device.id,
    claimToken: inicio.claimToken,
    simId: inicio.simId,
    simSlot: inicio.simSlot,
    subscriptionId: inicio.subscriptionId,
    ...evidencia
  });
}

const EVIDENCIA_FALHA_CONFIRMADA = { saldoAntesMB: 50000, saldoDepoisMB: 50000, sucessoRedeReportado: false };
const EVIDENCIA_AMBIGUA = { saldoAntesMB: null, saldoDepoisMB: null, sucessoRedeReportado: null };

function canceladas(pedidoId) {
  return db.auditoria.filter((a) => a.acao === "SUBOPERACAO_CANCELADA" && a.pedidoId === pedidoId);
}

test("falha comprovada pelo fluxo real de registrarResultado cancela as partes seguintes", () => {
  const { tenant, pedido, partes, device } = prepararPedido();
  const [p1, p2, p3] = partes;

  const resultado = executarParte(device, p1, EVIDENCIA_FALHA_CONFIRMADA);

  assert.equal(resultado.ok, true, JSON.stringify(resultado));
  assert.equal(resultado.estado, "FALHOU");
  assert.equal(p1.estado, "FALHOU");
  assert.equal(p2.estado, "FALHOU");
  assert.equal(p3.estado, "FALHOU");
  assert.match(p2.motivoFalha, /parte 1 deste pedido falhou/);
  assert.equal(p2.taskId, null);
  assert.equal(p3.taskId, null);
  assert.equal(Object.values(db.pendingTasks).filter((t) => t.tenantId === tenant.id).length, 0);
  assert.equal(canceladas(pedido.id).length, 2);
  assert.ok(canceladas(pedido.id).every((a) => a.tenantId === tenant.id));
  assert.equal(operations.listarPedidos(tenant.id)[0].estado, "FALHOU");

  // Falha não consome o limite diário do SIM.
  const sim = Object.values(db.sims).find((s) => s.deviceId === device.id);
  assert.equal(sim.transferenciasHoje || 0, 0);
});

test("evidência ambígua deixa a parte em PENDENTE_REVISAO e não cancela as seguintes", () => {
  const { tenant, pedido, partes, device } = prepararPedido();
  const [p1, p2, p3] = partes;

  const resultado = executarParte(device, p1, EVIDENCIA_AMBIGUA);

  assert.equal(resultado.estado, "PENDENTE_REVISAO");
  for (let i = 0; i < 3; i++) operations.reprocessarPendentes(tenant.id);
  operations.reprocessarPendentes();

  assert.equal(p1.estado, "PENDENTE_REVISAO");
  assert.equal(p2.estado, "PENDENTE");
  assert.equal(p3.estado, "PENDENTE");
  assert.equal(canceladas(pedido.id).length, 0);
});

test("lease expirado (PENDENTE_REVISAO real) não cancela as partes seguintes", () => {
  const { tenant, pedido, partes, device } = prepararPedido();
  const [p1, p2, p3] = partes;

  const inicio = operations.iniciarTarefa(device.id, p1.taskId);
  assert.equal(inicio.ok, true, JSON.stringify(inicio));
  assert.equal(p1.estado, "EXECUTANDO");

  operations.reconciliarLeasesExpirados(Date.now() + operations.LEASE_DURACAO_MS + 1000);
  operations.reprocessarPendentes(tenant.id);

  assert.equal(p1.estado, "PENDENTE_REVISAO");
  assert.equal(p1.motivoPendenteRevisao, "LEASE_EXPIRADO_SEM_EVIDENCIA");
  assert.equal(p2.estado, "PENDENTE");
  assert.equal(p3.estado, "PENDENTE");
  assert.equal(canceladas(pedido.id).length, 0);
});

test("resolverRevisao FALHOU pelo fluxo real cancela as seguintes e repetir chamadas não duplica auditoria", () => {
  const { tenant, pedido, partes, device } = prepararPedido();
  const [p1, p2, p3] = partes;

  executarParte(device, p1, EVIDENCIA_AMBIGUA);
  assert.equal(p1.estado, "PENDENTE_REVISAO");
  assert.equal(canceladas(pedido.id).length, 0);

  const resolvido = operations.resolverRevisao(
    tenant.id, p1.id, { decisao: "FALHOU", motivo: "verificado sem entrega no destino" }, "tenant"
  );
  assert.equal(resolvido.ok, true, JSON.stringify(resolvido));

  assert.equal(p1.estado, "FALHOU");
  assert.equal(p2.estado, "FALHOU");
  assert.equal(p3.estado, "FALHOU");
  assert.equal(canceladas(pedido.id).length, 2);

  const totalAuditoria = db.auditoria.length;
  for (let i = 0; i < 3; i++) operations.reprocessarPendentes(tenant.id);
  operations.reprocessarPendentes();
  const repetida = operations.resolverRevisao(
    tenant.id, p1.id, { decisao: "FALHOU", motivo: "segunda tentativa" }, "tenant"
  );

  assert.equal(repetida.code, "NAO_ESTA_EM_REVISAO");
  assert.equal(canceladas(pedido.id).length, 2);
  assert.equal(db.auditoria.length, totalAuditoria, "nenhuma entrada de auditoria nova");
});

test("resolverRevisao CONFIRMAR (admin) não cancela e a parte 2 recebe SIM e tarefa", () => {
  const { tenant, pedido, partes, device } = prepararPedido();
  const [p1, p2, p3] = partes;

  executarParte(device, p1, EVIDENCIA_AMBIGUA);
  assert.equal(p1.estado, "PENDENTE_REVISAO");

  const resolvido = operations.resolverRevisao(
    tenant.id, p1.id, { decisao: "CONFIRMAR", motivo: "entrega confirmada pelo cliente" }, "admin"
  );
  assert.equal(resolvido.ok, true, JSON.stringify(resolvido));

  assert.equal(p1.estado, "CONCLUIDA");
  assert.equal(p2.estado, "AGUARDANDO_EXECUCAO");
  assert.ok(p2.taskId);
  assert.equal(p3.estado, "PENDENTE");
  assert.equal(canceladas(pedido.id).length, 0);
});

test("chamadas repetidas com a execução desativada não duplicam a auditoria", () => {
  const { tenant, pedido, partes, device } = prepararPedido();
  const [p1, p2] = partes;

  executarParte(device, p1, EVIDENCIA_FALHA_CONFIRMADA);
  assert.equal(p2.estado, "FALHOU");
  const totalAuditoria = db.auditoria.length;

  process.env.AUTOMATION_ALLOW_EXECUTION = "false";
  try {
    for (let i = 0; i < 3; i++) {
      assert.equal(operations.reprocessarPendentes(tenant.id), 0);
      assert.equal(operations.reprocessarPendentes(), 0);
    }
  } finally {
    process.env.AUTOMATION_ALLOW_EXECUTION = "true";
  }

  assert.equal(canceladas(pedido.id).length, 2);
  assert.equal(db.auditoria.length, totalAuditoria);
});
