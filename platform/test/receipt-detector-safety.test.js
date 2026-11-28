"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-receipts-safety-"));
const receiptDbPath = path.join(temp, "usedReceipts.json");
process.env.URSINHO_USED_RECEIPTS_DB = receiptDbPath;

const receipts = require("../src/services/receiptDetectorService");

test.after(() => {
    fs.rmSync(temp, { recursive: true, force: true });
});

test("histórico de referências é criado e preservado por gravação atómica", () => {
    const initial = receipts.loadUsedReceipts();
    assert.deepEqual(initial, { groups: {} });

    assert.equal(
        receipts.saveUsedReceipt("123456789-1234567890@g.us", "TX-UNIQUE-001", {
            sender: "258841111111@s.whatsapp.net",
            amount: 50,
            operator: "mpesa"
        }),
        true
    );

    const reloaded = receipts.loadUsedReceipts();
    assert.ok(reloaded.groups["123456789-1234567890@g.us"]["TX-UNIQUE-001"]);
    assert.equal(
        receipts.getUsedReceipt("123456789-1234567890@g.us", "TX-UNIQUE-001").amount,
        50
    );
});

test("histórico corrompido bloqueia a validação em vez de parecer vazio", () => {
    fs.writeFileSync(receiptDbPath, "{ JSON incompleto", "utf8");
    assert.throws(
        () => receipts.loadUsedReceipts(),
        /Histórico de comprovativos ilegível/
    );
});

test("mensagem do OCR não afirma que o dinheiro entrou", () => {
    const text = receipts.formatReceiptResult({
        detected: true,
        duplicate: false,
        operator: "mpesa",
        reference: "TX-RECEIPT-002",
        amount: 50,
        destination: "841234567",
        destinationName: "Conta Teste",
        verified: true,
        sender: "258841111111@s.whatsapp.net",
        numberMatch: true,
        nameMatch: true
    });

    assert.match(text, /COMPROVATIVO RECONHECIDO/);
    assert.match(text, /AGUARDE A CONFIRMAÇÃO/);
    assert.doesNotMatch(text, /PAGAMENTO DETECTADO/);
});
