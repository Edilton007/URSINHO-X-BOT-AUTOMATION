"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-payment-review-route-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.SALES_DB_FILE = path.join(temp, "sales.json");
process.env.AUTOMATION_ORDERS_FILE = path.join(temp, "automationOrders.json");

const tenantService = require("../src/automation/services/tenantService");
const tenantRoutes = require("../src/automation/routes/tenantRoutes");

const app = express();
app.use(express.json());
app.use("/automation/tenants", tenantRoutes);

let server;
let baseUrl;
let tenant;

test.before(async () => {
    tenant = tenantService.criarTenant({ nome: "Tenant route review" });
    server = await new Promise((resolve, reject) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
        listener.once("error", reject);
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
});

test("a rota de revisão rejeita chamadas sem chave Tenant", async () => {
    const response = await fetch(
        `${baseUrl}/automation/tenants/${encodeURIComponent(tenant.id)}/whatsapp/orders/WA-MISSING/payment-review`,
        {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ decisao: "CONFIRMAR", motivo: "verificado externamente" })
        }
    );

    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.ok, false);
});

test("a rota de revisão rejeita chave de outro tenant", async () => {
    const response = await fetch(
        `${baseUrl}/automation/tenants/${encodeURIComponent(tenant.id)}/whatsapp/orders/WA-MISSING/payment-review`,
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": "tenant-api-key-wrong"
            },
            body: JSON.stringify({ decisao: "CONFIRMAR", motivo: "verificado externamente" })
        }
    );

    assert.equal(response.status, 403);
});

test("a rota autenticada valida a decisão e não confia em groupId enviado pelo cliente", async () => {
    const response = await fetch(
        `${baseUrl}/automation/tenants/${encodeURIComponent(tenant.id)}/whatsapp/orders/WA-MISSING/payment-review`,
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": tenant.apiKey
            },
            body: JSON.stringify({
                decisao: "APROVAR_TUDO",
                motivo: "tentativa inválida",
                groupId: "999999999-999999999@g.us",
                tenantId: "TENANT-OUTRO"
            })
        }
    );

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, "DECISION_INVALID");
});
