"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-allowlist-test-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
// Só dentro deste processo de teste. A configuração do repositório e do servidor
// não muda, e nenhum USSD existe aqui: a execução é a máquina de estados do Backend.
process.env.AUTOMATION_ALLOW_EXECUTION = "true";

const db = require("../src/automation/database/automationDb");
const tenants = require("../src/automation/services/tenantService");
const telemetry = require("../src/automation/services/simTelemetryService");
const operations = require("../src/automation/services/operationService");

const TESTE = "857286555";
const OUTRO = "841112223";

test.after(() => {
  delete process.env.AUTOMATION_ALLOWED_DESTINATIONS;
  fs.rmSync(temp, { recursive: true, force: true });
});
test.beforeEach(() => {
  delete process.env.AUTOMATION_ALLOWED_DESTINATIONS;
  process.env.AUTOMATION_ALLOW_EXECUTION = "true";
});

let n = 0;
function preparar() {
  n += 1;
  const tenant = tenants.criarTenant({ nome: `Tenant Lista ${n}` });
  const licenca = tenants.gerarCodigoLicenca(30);
  tenants.ativarLicenca(tenant.id, licenca.codigo);
  const device = tenants.registrarDevice(tenant.id, `device-lista-${n}`);
  const sim = telemetry.registrarStatus(tenant.id, device.id, {
    slot: 0, operadora: "Vodacom Moçambique", internetMB: 60000, saldoMT: 5, subscriptionId: 30 + n
  });
  assert.equal(sim.ok, true);
  return { tenant, device };
}

test("sem lista configurada o comportamento é o de sempre", () => {
  const { tenant, device } = preparar();
  const op = operations.criarTransferencia(tenant.id, device.id, 100, OUTRO);
  assert.equal(op.estado, "AGUARDANDO_EXECUCAO");
  assert.ok(op.taskId);
  process.env.AUTOMATION_ALLOWED_DESTINATIONS = "   ";
  const op2 = operations.criarTransferencia(tenant.id, device.id, 100, TESTE);
  assert.equal(op2.estado, "AGUARDANDO_EXECUCAO", "lista só com espaços não restringe");
});

test("com lista, só o destino permitido recebe SIM e tarefa; os outros ficam retidos com o motivo", () => {
  const { tenant, device } = preparar();
  process.env.AUTOMATION_ALLOWED_DESTINATIONS = TESTE;

  const fora = operations.criarTransferencia(tenant.id, device.id, 100, OUTRO);
  const dentro = operations.criarTransferencia(tenant.id, device.id, 100, TESTE);

  assert.equal(fora.estado, "PENDENTE");
  assert.equal(fora.taskId, null);
  assert.match(fora.motivoPendente, /lista de destinos permitidos/);
  assert.equal(dentro.estado, "AGUARDANDO_EXECUCAO");
  assert.ok(dentro.taskId);

  const visiveis = operations.tarefasPendentes(device.id).map((t) => t.opId);
  assert.deepEqual(visiveis, [dentro.id]);
});

test("o número é comparado pelos últimos 9 dígitos, com ou sem prefixo 258", () => {
  const { tenant, device } = preparar();
  process.env.AUTOMATION_ALLOWED_DESTINATIONS = ` 258${TESTE} , lixo ,`;
  assert.equal(operations.criarTransferencia(tenant.id, device.id, 100, TESTE).estado, "AGUARDANDO_EXECUCAO");
  assert.equal(operations.criarTransferencia(tenant.id, device.id, 100, `258${TESTE}`).estado, "AGUARDANDO_EXECUCAO");
  assert.equal(operations.criarTransferencia(tenant.id, device.id, 100, OUTRO).estado, "PENDENTE");
});

test("variável preenchida só com valores inválidos bloqueia tudo em vez de abrir tudo", () => {
  const { tenant, device } = preparar();
  process.env.AUTOMATION_ALLOWED_DESTINATIONS = "abc, 123";
  const op = operations.criarTransferencia(tenant.id, device.id, 100, TESTE);
  assert.equal(op.estado, "PENDENTE");
  assert.match(op.motivoPendente, /lista de destinos permitidos/);
});

test("tarefa alocada antes da lista deixa de sair para o Agent e iniciarTarefa recusa", () => {
  const { tenant, device } = preparar();
  const op = operations.criarTransferencia(tenant.id, device.id, 100, OUTRO);
  assert.equal(op.estado, "AGUARDANDO_EXECUCAO");

  process.env.AUTOMATION_ALLOWED_DESTINATIONS = TESTE;
  assert.deepEqual(operations.tarefasPendentes(device.id), []);
  const recusa = operations.iniciarTarefa(device.id, op.taskId);
  assert.equal(recusa.code, "DESTINO_NAO_PERMITIDO");
  assert.equal(db.operations[op.id].estado, "AGUARDANDO_EXECUCAO");
  assert.equal(db.operations[op.id].claimToken, undefined);

  delete process.env.AUTOMATION_ALLOWED_DESTINATIONS;
  assert.equal(operations.iniciarTarefa(device.id, op.taskId).ok, true);
});

test("operação retida é alocada quando o destino passa a estar na lista", () => {
  const { tenant, device } = preparar();
  process.env.AUTOMATION_ALLOWED_DESTINATIONS = TESTE;
  const op = operations.criarTransferencia(tenant.id, device.id, 100, OUTRO);
  assert.equal(op.estado, "PENDENTE");

  assert.equal(operations.reprocessarPendentes(tenant.id), 0);
  assert.match(db.operations[op.id].motivoPendente, /lista de destinos permitidos/);

  process.env.AUTOMATION_ALLOWED_DESTINATIONS = `${TESTE},${OUTRO}`;
  assert.equal(operations.reprocessarPendentes(tenant.id), 1);
  assert.equal(db.operations[op.id].estado, "AGUARDANDO_EXECUCAO");
});

test("fila antiga não executa ao ligar a execução quando a lista exclui o destino", () => {
  const { tenant, device } = preparar();
  process.env.AUTOMATION_ALLOW_EXECUTION = "false";
  const a = operations.criarTransferencia(tenant.id, device.id, 100, OUTRO);
  const b = operations.criarTransferencia(tenant.id, device.id, 100, OUTRO);
  assert.equal(a.estado, "PENDENTE");
  assert.match(a.motivoPendente, /AUTOMATION_ALLOW_EXECUTION=false/);

  process.env.AUTOMATION_ALLOW_EXECUTION = "true";
  process.env.AUTOMATION_ALLOWED_DESTINATIONS = TESTE;
  assert.equal(operations.reprocessarPendentes(tenant.id), 0);
  assert.equal(db.operations[a.id].estado, "PENDENTE");
  assert.equal(db.operations[b.id].estado, "PENDENTE");
  assert.deepEqual(operations.tarefasPendentes(device.id), []);
});

test("com a execução desativada a lista não altera nada: o motivo continua a ser a execução", () => {
  const { tenant, device } = preparar();
  process.env.AUTOMATION_ALLOW_EXECUTION = "false";
  process.env.AUTOMATION_ALLOWED_DESTINATIONS = TESTE;
  const op = operations.criarTransferencia(tenant.id, device.id, 100, TESTE);
  assert.equal(op.estado, "PENDENTE");
  assert.match(op.motivoPendente, /AUTOMATION_ALLOW_EXECUTION=false/);
  assert.equal(operations.reprocessarPendentes(tenant.id), 0);
});
