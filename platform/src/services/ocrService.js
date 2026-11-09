const { createWorker } = require("tesseract.js");

let workerPromise = null;

/* ============================================================
   OBTER WORKER OCR
   ============================================================ */

async function getOCRWorker() {
    if (!workerPromise) {
        workerPromise = createWorker("por+eng");
    }

    return workerPromise;
}

/* ============================================================
   EXECUTAR OCR
   ============================================================ */

async function runOCR(buffer) {
    if (!buffer) {
        return "";
    }

    const worker = await getOCRWorker();

    const result = await worker.recognize(buffer);

    return String(
        result?.data?.text || ""
    )
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n+/g, "\n")
        .trim();
}

module.exports = {
    runOCR
};
