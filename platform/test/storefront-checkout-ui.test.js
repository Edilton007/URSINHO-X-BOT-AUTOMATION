"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(
    path.join(__dirname, "..", "storefront", "index.html"),
    "utf8"
);

test("checkout público permite escolher método de pagamento", () => {
    assert.match(html, /id="paymentMethod"/);
    assert.match(html, /function renderPaymentMethods\(\)/);
    assert.match(html, /paymentMethodId/);
    assert.match(html, /Selecciona o método de pagamento/);
    assert.match(html, /const method=methods\.find\(m=>m\.id===paymentMethodId\)/);
});

test("checkout apresenta validade dos pacotes e impede produtos sem volume transferível", () => {
    assert.match(html, /function validadeLabel\(p\)/);
    assert.match(html, /Validade: 1 dia/);
    assert.match(html, /Validade: 7 dias/);
    assert.match(html, /Validade: 30 dias/);
    assert.ok(html.includes("p.validadeDias"));
    assert.match(html, /p\.quantidadeMB>=100/);
    assert.match(html, /NÃO DISPONÍVEL/);
});

test("frontend só apresenta as instruções do método escolhido após criar o pedido", () => {
    assert.match(html, /Instruções do método seleccionado/);
    assert.doesNotMatch(html, /configured\.map\(m=>\[m\.nome\|\|m\.tipo/);
});

test("JavaScript incorporado na Loja pública tem sintaxe válida", () => {
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1);
    assert.doesNotThrow(() => new vm.Script(scripts[0][1], {
        filename: "storefront/index.html"
    }));
});
