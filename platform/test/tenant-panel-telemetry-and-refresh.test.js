"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const panelPath = path.join(__dirname, "..", "automation", "painel", "index.html");
const html = fs.readFileSync(panelPath, "utf8");

test("Tenant distingue Internet total da quota mensal transferível", () => {
    assert.match(html, /function quotaMensalTransferivel\(sim\)/);
    assert.match(html, /internetTransferivelMB/);
    assert.match(html, /internetTransferivelAtualizadoEmMs/);
    assert.match(html, /Quota mensal transferível/);
    assert.match(html, /Internet total/);
    assert.match(html, /QUOTA_FRESH_WINDOW_MS=30\*60\*1000/);

    const start = html.indexOf("function quotaMensalTransferivel(sim)");
    const end = html.indexOf("\n}\n\nfunction mbFromInput()", start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const helper = html.slice(start, end);
    assert.doesNotMatch(helper, /internetMB/, "A quota transferível nunca pode ser inferida da Internet total.");
});

test("Tenant oferece pull-to-refresh apenas a partir do topo e sem refresh nativo", () => {
    assert.match(html, /id="pullRefreshIndicator"/);
    assert.match(html, /overscroll-behavior-y:contain/);
    assert.match(html, /function configurarPullToRefresh\(\)/);
    assert.match(html, /addEventListener\('touchstart'/);
    assert.match(html, /addEventListener\('touchmove'/);
    assert.match(html, /addEventListener\('touchend'/);
    assert.match(html, /const threshold=72/);
    assert.match(html, /window\.scrollY>1/);
    assert.match(html, /event\.preventDefault\(\)/);
});
