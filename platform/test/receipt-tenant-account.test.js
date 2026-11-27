"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-tenant-receipt-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");
process.env.SALES_DB_FILE = path.join(temp, "sales.json");
process.env.URSINHO_USED_RECEIPTS_DB = path.join(temp, "usedReceipts.json");

const tenants = require("../src/automation/services/tenantService");
const identity = require("../src/automation/services/customerIdentityService");
const storefront = require("../src/automation/services/storefrontService");
const sales = require("../src/services/salesService");
const receipts = require("../src/services/receiptDetectorService");

test.after(() => {
    fs.rmSync(temp, { recursive: true, force: true });
});

test("OCR valida contra conta do Tenant e ignora conta legada diferente", () => {
    const tenant = tenants.criarTenant({ nome: "Tenant OCR" });
    const license = tenants.gerarCodigoLicenca(30);
    assert.equal(tenants.ativarLicenca(tenant.id, license.codigo).ok, true);

    const groupId = "123456789-1234567890@g.us";
    const pairing = identity.criarCodigoAssociacaoGrupo(tenant.id);
    assert.equal(pairing.ok, true);
    assert.equal(identity.associarGrupoPorCodigo(groupId, "Grupo OCR", pairing.codigo).ok, true);

    sales.setPayment(groupId, "mpesa", "841111111", "Conta Antiga");
    storefront.configurarLoja(tenant.id, {
        slug: "tenant-ocr",
        nome: "Loja Tenant",
        publicado: true,
        metodosPagamento: [
            { id: "mpesa-main", tipo: "MPESA", conta: "841222222", titular: "Titular Tenant" }
        ]
    });

    const correct = receipts.verifyDestination(
        groupId,
        "mpesa",
        "Transferência recebida para 841222222",
        "841222222",
        "Titular Tenant"
    );
    assert.equal(correct.verified, true);

    const legacy = receipts.verifyDestination(
        groupId,
        "mpesa",
        "Transferência recebida para 841111111",
        "841111111",
        "Conta Antiga"
    );
    assert.equal(legacy.verified, false);

    // O mesmo destinatário pode surgir no comprovativo em formato internacional
    // (+258/258) enquanto o Tenant o configurou no formato local, ou vice-versa.
    storefront.configurarLoja(tenant.id, {
        slug: "tenant-ocr",
        nome: "Loja Tenant",
        publicado: true,
        metodosPagamento: [
            { id: "mpesa-main", tipo: "MPESA", conta: "+258 84 122 2222", titular: "Titular Tenant" }
        ]
    });
    const international = receipts.verifyDestination(
        groupId,
        "mpesa",
        "Transferência recebida para 258841222222",
        "258841222222",
        "Titular Tenant"
    );
    assert.equal(international.verified, true);
});

test("bloqueia reutilização da mesma referência entre grupos da plataforma", () => {
    receipts.saveUsedReceipt("grupo-original@g.us", "TX-GLOBAL-001", {
        reference: "TX-GLOBAL-001",
        operator: "mpesa",
        sender: "258844444444@s.whatsapp.net",
        amount: 25
    });

    const sameOperator = receipts.getUsedReceipt(
        "outro-grupo@g.us",
        "TX-GLOBAL-001",
        "mpesa"
    );
    assert.ok(sameOperator);
    assert.equal(sameOperator.groupId, "grupo-original@g.us");

    const otherOperator = receipts.getUsedReceipt(
        "outro-grupo@g.us",
        "TX-GLOBAL-001",
        "emola"
    );
    assert.equal(otherOperator, null);
});

test("loja Tenant activa não permite fallback para método legado não configurado", () => {
    const tenant = tenants.criarTenant({ nome: "Tenant OCR Sem eMola" });
    const license = tenants.gerarCodigoLicenca(30);
    assert.equal(tenants.ativarLicenca(tenant.id, license.codigo).ok, true);

    const groupId = "123456789-1234567891@g.us";
    const pairing = identity.criarCodigoAssociacaoGrupo(tenant.id);
    identity.associarGrupoPorCodigo(groupId, "Grupo OCR 2", pairing.codigo);

    sales.setPayment(groupId, "emola", "841333333", "Conta eMola Antiga");
    storefront.configurarLoja(tenant.id, {
        slug: "tenant-ocr-2",
        nome: "Loja Tenant 2",
        publicado: true,
        metodosPagamento: [
            { id: "mpesa-main", tipo: "MPESA", conta: "841222222", titular: "Titular Tenant" }
        ]
    });

    const result = receipts.verifyDestination(
        groupId,
        "emola",
        "Transferência recebida para 841333333",
        "841333333",
        "Conta eMola Antiga"
    );
    assert.equal(result.verified, false);
});
