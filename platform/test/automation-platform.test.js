"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-automation-test-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.AUTOMATION_ALLOW_EXECUTION = "false";

const db = require("../src/automation/database/automationDb");
const tenants = require("../src/automation/services/tenantService");
const store = require("../src/automation/services/storefrontService");
const telemetry = require("../src/automation/services/simTelemetryService");
const operations = require("../src/automation/services/operationService");

test("credenciais de tenant e device são guardadas em hash e autenticam separadamente", () => {
  const tenant = tenants.criarTenant({ nome: "Loja Teste A" });
  assert.ok(tenant.apiKey);
  assert.ok(db.tenants[tenant.id].apiKeyHash);
  assert.equal(Object.hasOwn(db.tenants[tenant.id], "apiKey"), false);
  assert.equal(tenants.autenticarTenant(tenant.id, tenant.apiKey), true);
  assert.equal(tenants.autenticarTenant(tenant.id, "chave-errada"), false);

  const device = tenants.registrarDevice(tenant.id, "device-test-a");
  assert.ok(device.apiKey);
  assert.ok(db.devices[device.id].apiKeyHash);
  assert.equal(Object.hasOwn(db.devices[device.id], "apiKey"), false);
  assert.equal(tenants.autenticarDevice(device.id, device.apiKey), true);
  assert.equal(tenants.autenticarDevice(device.id, tenant.apiKey), false);
  db.devices[device.id].autorizado = false;
  db.save();
  const rotated = tenants.registrarDevice(tenant.id, device.id);
  assert.equal(rotated.autorizado, false);
  assert.equal(tenants.autenticarDevice(device.id, rotated.apiKey), false);
  db.tenants[tenant.id].ativo = false;
  db.save();
  assert.equal(tenants.autenticarDevice(device.id, device.apiKey), false);
});

test("licenças rejeitam duração inválida, vinculam-se a um tenant e não podem ser reutilizadas", () => {
  assert.match(tenants.gerarCodigoLicenca(0).error, /entre 1 e 3650/);
  const a = tenants.criarTenant({ nome: "Tenant Licença A" });
  const b = tenants.criarTenant({ nome: "Tenant Licença B" });
  const license = tenants.gerarCodigoLicenca(30);
  assert.ok(license.codigo);
  assert.equal(tenants.ativarLicenca(a.id, license.codigo).ok, true);
  assert.match(tenants.ativarLicenca(b.id, license.codigo).error, /já foi utilizado/);
  assert.equal(tenants.getLicenca(a.id).estado, "ATIVA");
  assert.match(tenants.ativarLicenca(a.id, license.codigo).error, /já foi utilizado/);

  const oldExpiry = tenants.getLicenca(a.id).expiraEmMs;
  const renewal = tenants.gerarCodigoLicenca(15);
  assert.equal(tenants.ativarLicenca(a.id, renewal.codigo).ok, true);
  assert.equal(db.licenseCodes[license.codigo].estado, "SUBSTITUIDA");
  assert.ok(tenants.getLicenca(a.id).expiraEmMs >= oldExpiry + 14 * 24 * 60 * 60 * 1000);
});

test("loja aplica isolamento, catálogo só publica produtos ativos e pedido fica pendente de pagamento", () => {
  const a = tenants.criarTenant({ nome: "Tenant Loja A" });
  const b = tenants.criarTenant({ nome: "Tenant Loja B" });
  assert.equal(store.configurarLoja(a.id, { slug: "loja-a", publicado: true, nome: "Loja A", mpesa: "841234567" }).ok, true);
  assert.equal(store.configurarLoja(b.id, { slug: "loja-a", publicado: true }).error.includes("já está"), true);

  const active = store.criarProduto(a.id, { nome: "Pacote 1 GB", precoMT: 100, ativo: true });
  const inactive = store.criarProduto(a.id, { nome: "Pacote oculto", precoMT: 200, ativo: false });
  assert.equal(store.atualizarProduto(b.id, active.produto.id, { precoMT: 1 }).error, "Produto não encontrado.");
  assert.deepEqual(store.listarProdutos(b.id), []);
  const catalog = store.catalogoPublico("loja-a");
  assert.equal(catalog.produtos.length, 1);
  assert.equal(catalog.produtos[0].id, active.produto.id);
  assert.notEqual(catalog.produtos[0].id, inactive.produto.id);

  const payload = { nome: "Cliente Teste", telefone: "258841234567", items: [{ productId: active.produto.id, quantity: 2 }] };
  const first = store.criarPedidoPublico("loja-a", payload, "pedido-test-001");
  assert.equal(first.ok, true);
  assert.equal(first.pedido.totalMT, 200);
  assert.equal(first.pedido.tenantId, a.id);
  assert.equal(first.pedido.estado, "AGUARDANDO_PAGAMENTO");
  assert.equal(first.pedido.pagamentoEstado, "PENDENTE_VERIFICACAO");

  const second = store.criarPedidoPublico("loja-a", payload, "pedido-test-001");
  assert.equal(second.idempotente, true);
  assert.equal(second.pedido.id, first.pedido.id);
  const conflict = store.criarPedidoPublico("loja-a", { ...payload, nome: "Outro Cliente" }, "pedido-test-001");
  assert.equal(conflict.code, "IDEMPOTENCY_CONFLICT");
});

test("pagamento não é confirmado automaticamente e exige revisão administrativa registada", () => {
  const tenant = tenants.criarTenant({ nome: "Tenant Pagamento" });
  store.configurarLoja(tenant.id, { slug: "loja-pagamento", publicado: true });
  const product = store.criarProduto(tenant.id, { nome: "Produto", precoMT: 50 }).produto;
  const order = store.criarPedidoPublico("loja-pagamento", {
    nome: "Cliente", telefone: "258841234567", items: [{ productId: product.id, quantity: 1 }]
  }, "payment-001").pedido;
  assert.equal(order.pagamentoEstado, "PENDENTE_VERIFICACAO");
  assert.match(store.resolverPagamento(order.id, "CONFIRMADO", "", "MPESA-1").error, /mínimo 5/);
  const reviewed = store.resolverPagamento(order.id, "CONFIRMADO", "Comprovado manualmente", "MPESA-1", "admin");
  assert.equal(reviewed.ok, true);
  assert.equal(reviewed.pedido.pagamentoEstado, "CONFIRMADO_MANUALMENTE");
  assert.equal(reviewed.pedido.estado, "PAGO");
  assert.equal(reviewed.pedido.revisaoPagamento.por, "admin");
});

test.after(() => {
  fs.rmSync(temp, { recursive: true, force: true });
});


test("telemetria aceita apenas nomes conhecidos da Vodacom e rejeita correspondências parciais", () => {
  const tenant = tenants.criarTenant({ nome: "Tenant Operadora" });
  const device = tenants.registrarDevice(tenant.id, "device-operadora-test");

  const rejeitado = telemetry.registrarStatus(tenant.id, device.id, {
    slot: 0, operadora: "NotVodacom", internetMB: 500, subscriptionId: 71
  });
  assert.match(rejeitado.error, /Operadora não suportada/);

  const rejeitadoFake = telemetry.registrarStatus(tenant.id, device.id, {
    slot: 1, operadora: "Vodacom Fake", internetMB: 500, subscriptionId: 72
  });
  assert.match(rejeitadoFake.error, /Operadora não suportada/);

  const aceite = telemetry.registrarStatus(tenant.id, device.id, {
    slot: 0, operadora: "Vodacom Moçambique", internetMB: 500, subscriptionId: 73
  });
  assert.equal(aceite.ok, true);
});

test("fluxo Backend escolhe SIM, cria tarefa, reclama uma vez e só conclui com evidência compatível", () => {
  process.env.AUTOMATION_ALLOW_EXECUTION = "true";
  const tenant = tenants.criarTenant({ nome: "Tenant Operação" });
  const license = tenants.gerarCodigoLicenca(30);
  tenants.ativarLicenca(tenant.id, license.codigo);
  const device = tenants.registrarDevice(tenant.id, "device-operation-test");

  const sim = telemetry.registrarStatus(tenant.id, device.id, {
    slot: 0, operadora: "Vodacom Moçambique", internetMB: 1200,
    saldoMT: 50, subscriptionId: 17
  });
  assert.equal(sim.ok, true);

  const op = operations.criarTransferencia(tenant.id, device.id, 100, "258841234567", {
    externalOrderId: "ext-operation-001"
  });
  assert.equal(op.estado, "AGUARDANDO_EXECUCAO");
  assert.equal(op.simSlot, 0);
  assert.equal(op.subscriptionId, 17);

  const [task] = operations.tarefasPendentes(device.id);
  assert.ok(task);
  const claim = operations.iniciarTarefa(device.id, task.id);
  assert.equal(claim.ok, true);
  assert.equal(claim.simSlot, 0);
  assert.equal(claim.subscriptionId, 17);
  assert.equal(operations.iniciarTarefa(device.id, task.id).code, "TASK_ALREADY_CLAIMED");

  const rejectedWrongSim = operations.registrarResultado(task.id, {
    deviceId: device.id, claimToken: claim.claimToken,
    simId: task.simId, simSlot: 1, subscriptionId: 17,
    saldoAntesMB: 1200, saldoDepoisMB: 1100,
    sucessoRedeReportado: true, logBruto: "Transferencia efetuada com sucesso"
  });
  assert.equal(rejectedWrongSim.code, "SIM_SLOT_MISMATCH");

  const result = operations.registrarResultado(task.id, {
    deviceId: device.id, claimToken: claim.claimToken,
    simId: task.simId, simSlot: 0, subscriptionId: 17,
    saldoAntesMB: 1200, saldoDepoisMB: 1100,
    sucessoRedeReportado: true, logBruto: "Transferencia efetuada com sucesso"
  });
  assert.equal(result.estado, "CONCLUIDA");
  assert.equal(db.operations[op.id].estado, "CONCLUIDA");
  assert.equal(db.operations[op.id].diferencaObservadaMB, 100);
  process.env.AUTOMATION_ALLOW_EXECUTION = "false";
});
