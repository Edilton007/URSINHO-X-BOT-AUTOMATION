"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const layout = fs.readFileSync(
    path.join(root, "android", "agent", "app", "src", "main", "res", "layout", "activity_main.xml"),
    "utf8"
);
const activity = fs.readFileSync(
    path.join(root, "android", "agent", "app", "src", "main", "java", "com", "ursinhox", "automation", "agent", "MainActivity.kt"),
    "utf8"
);

test("Agent nativo apresenta as quatro áreas aprovadas", () => {
    for (const id of ["tabEstado", "tabLigacao", "tabTarefas", "tabRegisto"]) {
        assert.equal(layout.split(`android:id="@+id/${id}"`).length - 1, 1, `Aba ${id} em falta ou duplicada.`);
    }
    for (const id of ["sectionEstado", "sectionLigacao", "sectionTarefas", "sectionRegisto"]) {
        assert.equal(layout.split(`android:id="@+id/${id}"`).length - 1, 1, `Área ${id} em falta ou duplicada.`);
    }
    assert.match(layout, /android:id="@\+id\/agentBottomTabs"/);
    assert.match(layout, /android:id="@\+id\/mainScroll"/);
});

test("navegação alterna áreas sem substituir os controlos operacionais", () => {
    assert.match(activity, /configurarNavegacao\(\)/);
    assert.match(activity, /private fun selecionarAba\(tabSelecionada: Int\)/);
    assert.match(activity, /View\.VISIBLE/);
    assert.match(activity, /View\.GONE/);
    assert.ok(layout.includes('android:id="@+id/btnBuscarTarefa"'));
    assert.ok(layout.includes('android:id="@+id/btnLigarServico"'));
    assert.ok(layout.includes('android:id="@+id/btnDesligarServico"'));
    assert.ok(layout.includes('android:id="@+id/txtLog"'));
});
