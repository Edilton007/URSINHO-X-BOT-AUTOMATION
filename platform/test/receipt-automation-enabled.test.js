"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-receipt-automation-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.SALES_DB_FILE = path.join(temp, "sales.json");

const tenantService = require("../src/automation/services/tenantService");
const identityService = require("../src/automation/services/customerIdentityService");
const salesService = require("../src/services/salesService");
const receiptDetector = require("../src/services/receiptDetectorService");

test.after(() => {
    fs.rmSync(temp, { recursive: true, force: true });
});

test("grupo associado ao Automation ativa análise de comprovativos sem comando legado", () => {
    const tenant = tenantService.criarTenant({ nome: "Tenant Receipt Automation" });
    assert.equal(tenant.error, undefined);

    const pairing = identityService.criarCodigoAssociacaoGrupo(tenant.id);
    assert.equal(pairing.ok, true);

    const groupId = "258840000001-258840000001@g.us";
    const association = identityService.associarGrupoPorCodigo(
        groupId,
        "Grupo Automation",
        pairing.codigo
    );
    assert.equal(association.ok, true);

    // A opção legada continua desligada, mas a associação Automation
    // torna a análise de comprovativos necessária ao checkout disponível.
    assert.equal(salesService.isDetectorEnabled(groupId), false);
    assert.equal(receiptDetector.isReceiptDetectionEnabledForGroup(groupId), true);
});

test("grupo sem Automation continua dependente do interruptor legado", () => {
    const groupId = "258840000002-258840000002@g.us";

    assert.equal(receiptDetector.isReceiptDetectionEnabledForGroup(groupId), false);

    salesService.setDetectorEnabled(groupId, true);
    assert.equal(receiptDetector.isReceiptDetectionEnabledForGroup(groupId), true);
});
