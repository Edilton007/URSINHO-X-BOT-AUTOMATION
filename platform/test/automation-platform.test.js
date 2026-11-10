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


test("métodos de pagamento pertencem ao tenant, são publicados sem segredos e ficam congelados no pedido", () => {
  const a = tenants.criarTenant({ nome: "Tenant Pagamentos A" });
  const b = tenants.criarTenant({ nome: "Tenant Pagamentos B" });
  const configA = store.configurarLoja(a.id, {
    slug: "pagamentos-a", publicado: true,
    metodosPagamento: [{
      id: "mpesa-a", tipo: "MPESA", nome: "M-Pesa da Loja A",
      conta: "841234567", titular: "Loja A", instrucoes: "Use a referência do pedido."
    }]
  });
  assert.equal(configA.ok, true);
  assert.equal(store.configurarLoja(b.id, { slug: "pagamentos-b", publicado: true, metodosPagamento: [] }).ok, true);

  const productA = store.criarProduto(a.id, { nome: "1 GB", precoMT: 100 }).produto;
  const publicCatalog = store.catalogoPublico("pagamentos-a");
  assert.equal(publicCatalog.loja.metodosPagamento.length, 1);
  assert.equal(publicCatalog.loja.metodosPagamento[0].conta, "841234567");
  assert.equal(Object.hasOwn(publicCatalog.loja.metodosPagamento[0], "apiKey"), false);

  const payload = {
    nome: "Cliente A", telefone: "258841234567",
    paymentMethodId: "mpesa-a",
    items: [{ productId: productA.id, quantity: 1 }]
  };
  const created = store.criarPedidoPublico("pagamentos-a", payload, "tenant-payment-001");
  assert.equal(created.ok, true);
  assert.equal(created.pedido.pagamentoMetodo.id, "mpesa-a");
  assert.equal(created.pedido.pagamentoMetodo.conta, "841234567");

  assert.equal(store.criarPedidoPublico("pagamentos-a", { ...payload, paymentMethodId: "metodo-de-b" }, "tenant-payment-002").error,
    "Método de pagamento indisponível para esta loja.");
  assert.equal(store.configurarLoja(a.id, { metodosPagamento: [{ id: "x", tipo: "MPESA", conta: "123" }] }).error,
    "Cada método precisa de um número ou conta válida.");

  store.configurarLoja(a.id, { metodosPagamento: [{ id: "mpesa-a", tipo: "MPESA", nome: "Conta atualizada", conta: "849999999" }] });
  assert.equal(store.listarPedidos(a.id).find(o => o.id === created.pedido.id).pagamentoMetodo.conta, "841234567");
  assert.deepEqual(store.listarPedidos(b.id), []);
});


test("identidade WhatsApp é global, relações são isoladas por Tenant e grupo exige pairing", () => {
  const identity = require("../src/automation/services/customerIdentityService");
  const a = tenants.criarTenant({ nome: "Tenant Grupo A" });
  const b = tenants.criarTenant({ nome: "Tenant Grupo B" });

  const codeA = identity.criarCodigoAssociacaoGrupo(a.id);
  const codeB = identity.criarCodigoAssociacaoGrupo(b.id);
  assert.equal(codeA.ok, true);
  assert.equal(codeB.ok, true);

  const groupA = "120363000000001-1234567890@g.us";
  const groupB = "120363000000002-1234567890@g.us";
  assert.equal(identity.associarGrupo(a.id, groupA, "Grupo A", codeA.codigo).ok, true);
  assert.equal(identity.associarGrupo(b.id, groupA, "Tentativa cruzada", codeB.codigo).error,
    "Este grupo já está associado a outra loja.");
  assert.equal(identity.associarGrupo(b.id, groupB, "Grupo B", codeB.codigo).ok, true);

  const jid = `25884${String(Date.now()).slice(-8)}@s.whatsapp.net`;
  assert.equal(identity.atualizarMembroGrupo(groupA, jid, "Cliente", true).tenantId, a.id);
  assert.equal(identity.atualizarMembroGrupo(groupB, jid, "Cliente", true).tenantId, b.id);

  const relations = identity.listarTenantsDoCliente(jid);
  assert.equal(relations.length, 2);
  assert.deepEqual(new Set(relations.map(r => r.tenantId)), new Set([a.id, b.id]));

  const ambiguous = identity.resolverTenantPrivado(jid);
  assert.equal(ambiguous.code, "TENANT_SELECTION_REQUIRED");
  assert.equal(identity.resolverTenantPrivado(jid, b.id).tenantId, b.id);

  identity.atualizarMembroGrupo(groupA, jid, "Cliente", false);
  const afterLeave = identity.resolverTenantPrivado(jid);
  assert.equal(afterLeave.code, "TENANT_SELECTION_REQUIRED");
  assert.equal(identity.listarTenantsDoCliente(jid).find(r => r.tenantId === a.id).estado,
    "RELACAO_COMERCIAL");

  assert.equal(identity.associarGrupo(a.id, "invalid@g.us", "Inválido", "BADCODE").error,
    "Identificador de grupo WhatsApp inválido.");
});

test("sessão privada de seleção de loja expira e não aceita escolha numérica antiga", async () => {
  const identity = require("../src/automation/services/customerIdentityService");
  const privateChat = require("../src/automation/services/tenantPrivateChatService");
  const a = tenants.criarTenant({ nome: "Loja TTL A" });
  const b = tenants.criarTenant({ nome: "Loja TTL B" });
  const groupA = "120363000000021-1234567890@g.us";
  const groupB = "120363000000022-1234567890@g.us";
  const ca = identity.criarCodigoAssociacaoGrupo(a.id);
  const cb = identity.criarCodigoAssociacaoGrupo(b.id);
  identity.associarGrupo(a.id, groupA, "A", ca.codigo);
  identity.associarGrupo(b.id, groupB, "B", cb.codigo);
  const jid = "258849876543@s.whatsapp.net";
  identity.atualizarMembroGrupo(groupA, jid, "Cliente", true);
  identity.atualizarMembroGrupo(groupB, jid, "Cliente", true);
  const sent = [];
  const sock = { sendMessage: async (...args) => sent.push(args) };
  const message = { key: { remoteJid: jid } };

  await privateChat.handle(sock, message, jid, "lojas");
  const key = "WPS-" + require("node:crypto").createHash("sha256").update(jid).digest("hex").slice(0, 32);
  db.system.whatsappPrivateSessions[key].atualizadoEmMs = Date.now() - 21 * 60 * 1000;
  db.save();

  assert.equal(await privateChat.handle(sock, message, jid, "2"), true);
  assert.match(sent.at(-1)[1].text, /Responde com o número/);
  assert.equal(db.system.whatsappPrivateSessions[key].estado, "SELECIONAR_LOJA");
});


test("produto conserva quantidade em MB no catálogo e no snapshot do pedido", () => {
  const tenant = tenants.criarTenant({ nome: "Tenant MB" });
  store.configurarLoja(tenant.id, { slug: "loja-mb", publicado: true });
  const invalid = store.criarProduto(tenant.id, { nome: "Pacote inválido", precoMT: 10, quantidadeMB: 0 });
  assert.equal(invalid.error, "Quantidade em MB inválida.");
  const product = store.criarProduto(tenant.id, { nome: "1 GB", precoMT: 100, quantidadeMB: 1024 }).produto;
  assert.equal(store.catalogoPublico("loja-mb").produtos[0].quantidadeMB, 1024);
  const order = store.criarPedidoPublico("loja-mb", {
    nome: "Cliente MB", telefone: "258841234567",
    items: [{ productId: product.id, quantity: 1 }]
  }, "order-mb-0001").pedido;
  assert.equal(order.items[0].quantidadeMB, 1024);
  store.atualizarProduto(tenant.id, product.id, { quantidadeMB: 2048 });
  assert.equal(store.listarPedidos(tenant.id)[0].items[0].quantidadeMB, 1024);
});

test("inventário de licenças permite lote e revoga apenas códigos por ativar", () => {
  const tenant = tenants.criarTenant({ nome: "Tenant Licenças Admin" });
  const first = tenants.gerarCodigoLicenca(10);
  const second = tenants.gerarCodigoLicenca(20);
  assert.equal(tenants.listarCodigosLicenca().length >= 2, true);
  assert.equal(tenants.revogarCodigoLicenca(first.codigo).ok, true);
  assert.equal(tenants.ativarLicenca(tenant.id, first.codigo).error.includes("revogado"), true);
  assert.equal(tenants.ativarLicenca(tenant.id, second.codigo).ok, true);
  assert.equal(tenants.revogarCodigoLicenca(second.codigo).status, 409);
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


test("chat privado escolhe Tenant sem misturar lojas e apresenta apenas o catálogo selecionado", async () => {
  const identity = require("../src/automation/services/customerIdentityService");
  const privateChat = require("../src/automation/services/tenantPrivateChatService");
  const a = tenants.criarTenant({ nome: "Loja Privada A" });
  const b = tenants.criarTenant({ nome: "Loja Privada B" });
  store.configurarLoja(a.id, {
    slug: "privada-a", publicado: true,
    metodosPagamento: [{ id: "mp-a", tipo: "MPESA", conta: "841111111", nome: "M-Pesa A" }]
  });
  store.configurarLoja(b.id, { slug: "privada-b", nome: "Loja Privada B", publicado: true });
  store.criarProduto(a.id, { nome: "Pacote A", precoMT: 80 });
  store.criarProduto(b.id, { nome: "Pacote B", precoMT: 120 });

  const groupA = "120363000000011-1234567890@g.us";
  const groupB = "120363000000012-1234567890@g.us";
  const codeA = identity.criarCodigoAssociacaoGrupo(a.id);
  const codeB = identity.criarCodigoAssociacaoGrupo(b.id);
  identity.associarGrupo(a.id, groupA, "Grupo A", codeA.codigo);
  identity.associarGrupo(b.id, groupB, "Grupo B", codeB.codigo);
  const jid = "258841234567@s.whatsapp.net";
  identity.atualizarMembroGrupo(groupA, jid, "Cliente", true);
  identity.atualizarMembroGrupo(groupB, jid, "Cliente", true);

  const sent = [];
  const sock = { sendMessage: async (...args) => sent.push(args) };
  const message = { key: { remoteJid: jid } };

  assert.equal(await privateChat.handle(sock, message, jid, "catalogo"), true);
  assert.match(sent.at(-1)[1].text, /Loja Privada A/);
  assert.match(sent.at(-1)[1].text, /Loja Privada B/);
  assert.match(sent.at(-1)[1].text, /Responde com o número/);

  assert.equal(await privateChat.handle(sock, message, jid, "2"), true);
  assert.match(sent.at(-1)[1].text, /Loja selecionada:/);
  assert.equal(await privateChat.handle(sock, message, jid, "catalogo"), true);
  assert.match(sent.at(-1)[1].text, /Pacote B/);
  assert.doesNotMatch(sent.at(-1)[1].text, /Pacote A/);

  assert.equal(await privateChat.handle(sock, message, jid, "lojas"), true);
  assert.match(sent.at(-1)[1].text, /Loja Privada A/);
  assert.match(sent.at(-1)[1].text, /Loja Privada B/);
});
