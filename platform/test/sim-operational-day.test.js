"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-day-test-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.AUTOMATION_ALLOW_EXECUTION = "false";

const db = require("../src/automation/database/automationDb");
const tenants = require("../src/automation/services/tenantService");
const telemetry = require("../src/automation/services/simTelemetryService");
const { diaOperacional } = require("../src/automation/utils/diaOperacional");

test.after(() => {
  fs.rmSync(temp, { recursive: true, force: true });
});

test("dia operacional vira à meia-noite de Maputo e não às 02:00 locais", () => {
  assert.equal(diaOperacional(Date.parse("2026-11-11T21:59:59Z")), "Wed Nov 11 2026");
  assert.equal(diaOperacional(Date.parse("2026-11-11T22:00:00Z")), "Thu Nov 12 2026");
  assert.equal(diaOperacional(Date.parse("2026-11-12T10:00:00Z")), "Thu Nov 12 2026");
});

test("formato coincide com Date#toDateString para manter contadores já gravados", () => {
  const meioDia = Date.parse("2026-03-05T10:00:00Z");
  assert.equal(diaOperacional(meioDia), new Date(meioDia + 2 * 3600 * 1000).toUTCString().slice(0, 16)
    .replace(",", "").replace(/^(\w+) (\d+) (\w+) (\d+)$/, "$1 $3 $2 $4"));
});

test("SIM com 10 transferências de ontem volta a ser elegível sem esperar nova telemetria", () => {
  const tenant = tenants.criarTenant({ nome: "Tenant Virada do Dia" });
  const device = tenants.registrarDevice(tenant.id, "device-virada-dia");
  const status = telemetry.registrarStatus(tenant.id, device.id, {
    slot: 0, operadora: "Vodacom Moçambique", internetMB: 2000, saldoMT: 10, subscriptionId: 2
  });
  assert.equal(status.ok, true);

  const sim = Object.values(db.sims).find((s) => s.deviceId === device.id);
  assert.ok(sim);

  // Hoje com 10 feitas: bloqueado.
  sim.transferenciasHoje = 10;
  sim.transferenciasData = diaOperacional(Date.now());
  assert.equal(telemetry.escolherSimElegivel(tenant.id, device.id, 100, 10), null);

  // As mesmas 10 gravadas num dia anterior: elegível.
  sim.transferenciasData = "Mon Jan 01 2001";
  const escolhido = telemetry.escolherSimElegivel(tenant.id, device.id, 100, 10);
  assert.ok(escolhido);
  assert.equal(escolhido.subscriptionId, 2);
  assert.equal(escolhido.slot, 0);
});
