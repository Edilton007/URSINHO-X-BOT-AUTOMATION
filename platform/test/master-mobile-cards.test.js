"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const masterPath = path.join(__dirname, "..", "master-admin", "index.html");
const html = fs.readFileSync(masterPath, "utf8");

test("Master transforma tabelas administrativas em cartões no mobile", () => {
    assert.match(html, /@media\s*\(max-width:\s*640px\)/);
    assert.match(html, /\.table tbody\{display:grid;gap:10px\}/);
    assert.match(html, /\.table td::before\{content:attr\(data-label\)/);
    assert.match(html, /\.tablewrap\{overflow:visible/);
});

test("todas as listagens dinâmicas do Master fornecem rótulos para cartões", () => {
    for (const label of [
        "data-label=\"Tenant\"",
        "data-label=\"Estado\"",
        "data-label=\"Licença\"",
        "data-label=\"Dispositivo\"",
        "data-label=\"Ações\"",
        "data-label=\"Operação\"",
        "data-label=\"Decisão\"",
        "data-label=\"Referência\"",
        "data-label=\"Destino\"",
        "data-label=\"Pagamento\"",
        "data-label=\"Data\"",
        "data-label=\"Detalhe\"",
        "data-label=\"Código\"",
        "data-label=\"Criado / expira\""
    ]) {
        assert.ok(html.includes(label), `Rótulo em falta: ${label}`);
    }
});
