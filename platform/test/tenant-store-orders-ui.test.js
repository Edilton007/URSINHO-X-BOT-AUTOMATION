"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(
    path.join(__dirname, "..", "automation", "painel", "index.html"),
    "utf8"
);

test("Tenant carrega e apresenta pedidos da Loja na área Pedidos", () => {
    assert.match(html, /id="storeOrdersCount"/);
    assert.match(html, /id="storeOrdersList"/);
    assert.match(html, /function renderStoreOrders\(\)/);
    assert.match(html, /\/store-orders/);
    assert.match(html, /Destino Vodacom/);
});

test("Tenant disponibiliza revisão de pagamentos e histórico na área Pagamentos", () => {
    assert.match(html, /id="storePaymentsCount"/);
    assert.match(html, /id="storePaymentsList"/);
    assert.match(html, /function renderStorePayments\(\)/);
    assert.match(html, /function reviewStoreOrderPayment\(orderId,decision\)/);
    assert.match(html, /data-review-store-order/);
    assert.match(html, /\/store-orders\/.*\/payment-review/);
    assert.match(html, /O pedido, por si só, não prova o pagamento/);
});

test("painel Tenant conserva sintaxe JavaScript válida após integrar pedidos públicos", () => {
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1);
    assert.doesNotThrow(() => new vm.Script(scripts[0][1], {
        filename: "automation/painel/index.html"
    }));
});
