"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-order-binding-"));
process.env.SALES_DB_FILE = path.join(temp, "sales.json");

const sales = require("../src/services/salesService");

test.after(() => {
    fs.rmSync(temp, { recursive: true, force: true });
});

function criarPedido(groupId, sender) {
    return sales.criarPedidoAutomationPendente(groupId, {
        sender,
        recipientNumber: "841234567",
        megas: 1024,
        expectedAmount: 25.5,
        productId: "PROD-1",
        productName: "Pacote 1 GB",
        productCategory: "MENSAL",
        validityDays: 30,
        paymentMethods: [
            { id: "PAY-MPESA", tipo: "MPESA", conta: "841222222", titular: "Titular M-Pesa" },
            { id: "PAY-EMOLA", tipo: "EMOLA", conta: "841333333", titular: "Titular e-Mola" }
        ]
    });
}

test("pré-pedido guarda cliente, destino, pacote, preço e métodos de pagamento", () => {
    const result = criarPedido("123456789-1234567890@g.us", "258844444444@s.whatsapp.net");
    assert.equal(result.ok, true);
    assert.equal(result.pedido.recipientNumber, "841234567");
    assert.equal(result.pedido.megas, 1024);
    assert.equal(result.pedido.expectedAmount, 25.5);
    assert.equal(result.pedido.paymentMethods.length, 2);
    assert.equal(result.pedido.estado, "AGUARDANDO_PAGAMENTO");
    assert.ok(result.pedido.expiraEmMs > result.pedido.criadoEmMs);
});

test("lista apenas pedidos dos grupos autorizados e devolve campos comerciais seguros", () => {
    const tenantGroup = "123456789-1234567896@g.us";
    const otherGroup = "123456789-1234567897@g.us";
    const tenantOrder = criarPedido(tenantGroup, "258844444450@s.whatsapp.net");
    const otherOrder = criarPedido(otherGroup, "258844444451@s.whatsapp.net");
    assert.equal(tenantOrder.ok, true);
    assert.equal(otherOrder.ok, true);

    const listed = sales.listarPedidosAutomationPorGrupos([tenantGroup]);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, tenantOrder.pedido.id);
    assert.equal(listed[0].groupId, tenantGroup);
    assert.equal(listed[0].productCategory, "MENSAL");
    assert.equal(listed[0].validityDays, 30);
    assert.equal(Object.prototype.hasOwnProperty.call(listed[0], "paymentMethods"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(listed[0], "apiKey"), false);

    assert.equal(sales.listarPedidosAutomationPorGrupos([otherGroup])[0].id, otherOrder.pedido.id);
    assert.deepEqual(sales.listarPedidosAutomationPorGrupos(["not-a-group@g.us"]), []);
});

test("associa comprovativo apenas com valor exacto e método oferecido", () => {
    const groupId = "123456789-1234567891@g.us";
    const sender = "258844444445@s.whatsapp.net";
    const created = criarPedido(groupId, sender);
    assert.equal(created.ok, true);

    const wrongMethod = sales.associarComprovativoAoPedidoAutomation(groupId, sender, {
        reference: "TX-WRONG-METHOD",
        operator: "bim",
        amount: 25.5
    });
    assert.equal(wrongMethod.code, "PAYMENT_METHOD_MISMATCH");

    // O comprovativo divergente já marca esse pedido para revisão, por isso
    // cria-se uma nova pré-encomenda para o próximo cenário de confirmação.
    const created2 = criarPedido(groupId, sender);
    assert.equal(created2.ok, true);

    const wrongAmount = sales.associarComprovativoAoPedidoAutomation(groupId, sender, {
        reference: "TX-WRONG-AMOUNT",
        operator: "mpesa",
        amount: 20,
        destination: "841222222",
        destinationName: "Titular M-Pesa"
    });
    assert.equal(wrongAmount.code, "PAYMENT_AMOUNT_MISMATCH");
});

test("associa apenas comprovativo enviado para a conta e titular apresentados no pedido", () => {
    const groupId = "123456789-1234567893@g.us";
    const sender = "258844444447@s.whatsapp.net";
    const created = criarPedido(groupId, sender);
    assert.equal(created.ok, true);

    const result = sales.associarComprovativoAoPedidoAutomation(groupId, sender, {
        reference: "TX-EXACT-ACCOUNT",
        operator: "mpesa",
        amount: 25.5,
        destination: "841222222",
        destinationName: "Titular M-Pesa"
    });

    assert.equal(result.ok, true);
    assert.equal(result.pedido.estado, "COMPROVATIVO_RECEBIDO");
    assert.equal(result.pedido.recipientNumber, "841234567");
});

test("recusa comprovativo de método correcto mas conta diferente da conta apresentada", () => {
    const groupId = "123456789-1234567894@g.us";
    const sender = "258844444448@s.whatsapp.net";
    const created = criarPedido(groupId, sender);
    assert.equal(created.ok, true);

    const result = sales.associarComprovativoAoPedidoAutomation(groupId, sender, {
        reference: "TX-WRONG-ACCOUNT",
        operator: "mpesa",
        amount: 25.5,
        destination: "841999999",
        destinationName: "Titular M-Pesa"
    });

    assert.equal(result.code, "PAYMENT_METHOD_MISMATCH");
});


test("associa conta de pagamento com indicativo +258 à conta local apresentada no checkout", () => {
    const groupId = "123456789-1234567895@g.us";
    const sender = "258844444449@s.whatsapp.net";
    const result = sales.criarPedidoAutomationPendente(groupId, {
        sender,
        recipientNumber: "841234567",
        megas: 1024,
        expectedAmount: 25.5,
        productId: "PROD-258",
        productName: "Pacote 1 GB",
        paymentMethods: [
            { id: "PAY-MPESA-258", tipo: "MPESA", conta: "+258 84 122 2222", titular: "Titular M-Pesa" }
        ]
    });
    assert.equal(result.ok, true);

    const proof = sales.associarComprovativoAoPedidoAutomation(groupId, sender, {
        reference: "TX-258-ACCOUNT",
        operator: "mpesa",
        amount: 25.5,
        destination: "841222222",
        destinationName: "Titular M-Pesa"
    });

    assert.equal(proof.ok, true);
    assert.equal(proof.pedido.estado, "COMPROVATIVO_RECEBIDO");
});

test("expiração bloqueia a associação tardia do comprovativo", () => {
    const groupId = "123456789-1234567892@g.us";
    const sender = "258844444446@s.whatsapp.net";
    const created = criarPedido(groupId, sender);
    assert.equal(created.ok, true);

    const db = sales.loadSales();
    const item = db.groups[groupId].pendingAutomationOrders.find(x => x.id === created.pedido.id);
    item.expiraEmMs = Date.now() - 1;
    sales.saveSales(db);

    const result = sales.associarComprovativoAoPedidoAutomation(groupId, sender, {
        reference: "TX-EXPIRED",
        operator: "mpesa",
        amount: 25.5
    });
    assert.equal(result.code, "PREFLIGHT_ORDER_EXPIRED");
});
