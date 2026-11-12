"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MODULO = path.join(__dirname, "..", "src", "automation", "utils", "diaOperacional.js");
const { diaOperacional } = require(MODULO);

// 23:59:59 de 11/11 em Maputo e meia-noite seguinte (UTC+2).
const ULTIMO_SEGUNDO = Date.parse("2026-11-11T21:59:59Z");
const MEIA_NOITE = Date.parse("2026-11-11T22:00:00Z");

function comVariavel(valor, fn) {
  const original = process.env.OPERATION_DAY_OFFSET_MIN;
  if (valor === undefined) delete process.env.OPERATION_DAY_OFFSET_MIN;
  else process.env.OPERATION_DAY_OFFSET_MIN = valor;
  try {
    return fn();
  } finally {
    if (original === undefined) delete process.env.OPERATION_DAY_OFFSET_MIN;
    else process.env.OPERATION_DAY_OFFSET_MIN = original;
  }
}

function assertPadraoMaputo(descricao) {
  assert.equal(diaOperacional(ULTIMO_SEGUNDO), "Wed Nov 11 2026", `${descricao}: 23:59:59 de Maputo`);
  assert.equal(diaOperacional(MEIA_NOITE), "Thu Nov 12 2026", `${descricao}: 00:00:00 de Maputo`);
}

test("variável ausente usa o padrão de Maputo", () => {
  comVariavel(undefined, () => assertPadraoMaputo("ausente"));
});

test("variável vazia usa o padrão de Maputo e não UTC", () => {
  comVariavel("", () => assertPadraoMaputo("vazia"));
});

test("variável só com espaços usa o padrão de Maputo", () => {
  comVariavel("   ", () => assertPadraoMaputo("espaços"));
});

test("variável com texto inválido usa o padrão de Maputo", () => {
  for (const invalido of ["abc", "12.5", "1e2", "0x10", "--5", "+-5", "120min", "null", "undefined", "NaN", "Infinity"]) {
    comVariavel(invalido, () => assertPadraoMaputo(`inválida "${invalido}"`));
  }
});

test("variável fora do intervalo -720..840 usa o padrão de Maputo", () => {
  for (const fora of ["841", "-721", "9999", "-9999", "100000"]) {
    comVariavel(fora, () => assertPadraoMaputo(`fora do intervalo "${fora}"`));
  }
});

test("valores válidos escritos de propósito continuam a ser respeitados", () => {
  comVariavel("0", () => {
    assert.equal(diaOperacional(ULTIMO_SEGUNDO), "Wed Nov 11 2026");
    assert.equal(diaOperacional(MEIA_NOITE), "Wed Nov 11 2026", "0 explícito é UTC e vira só às 00:00Z");
  });
  comVariavel("180", () => assert.equal(diaOperacional(ULTIMO_SEGUNDO), "Thu Nov 12 2026"));
  comVariavel("-300", () => assert.equal(diaOperacional(ULTIMO_SEGUNDO), "Wed Nov 11 2026"));
  comVariavel(" 120 ", () => assertPadraoMaputo("120 com espaços"));
  comVariavel("840", () => assert.equal(diaOperacional(ULTIMO_SEGUNDO), "Thu Nov 12 2026"));
  comVariavel("-720", () => assert.equal(diaOperacional(ULTIMO_SEGUNDO), "Wed Nov 11 2026"));
});

test("instante inválido não rebenta e cai em 1970", () => {
  comVariavel(undefined, () => {
    assert.equal(diaOperacional(NaN), "Thu Jan 01 1970");
    assert.equal(diaOperacional(Infinity), "Thu Jan 01 1970");
  });
});

test("formato coincide com Date#toDateString de um servidor em UTC (contadores gravados continuam válidos)", () => {
  const script = `
    const { diaOperacional } = require(${JSON.stringify(MODULO)});
    let diferentes = 0;
    for (let i = 0; i < 400; i++) {
      const t = Date.UTC(2024, 0, 1) + i * 3 * 86400000 + 12345678;
      if (diaOperacional(t) !== new Date(t).toDateString()) diferentes++;
    }
    process.stdout.write(String(diferentes));
  `;
  const resultado = spawnSync(process.execPath, ["-e", script], {
    env: { ...process.env, TZ: "UTC", OPERATION_DAY_OFFSET_MIN: "0" },
    encoding: "utf8"
  });
  assert.equal(resultado.status, 0, resultado.stderr);
  assert.equal(resultado.stdout, "0");
});
