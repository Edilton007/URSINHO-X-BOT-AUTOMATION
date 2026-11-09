const {
    downloadMediaMessage
} = require("@whiskeysockets/baileys");

const {
    getPayments
} = require("./salesService");

const {
    createWorker
} = require("tesseract.js");

let workerPromise = null;

/* ============================================================
   OCR
============================================================ */

async function getOCRWorker() {
    if (!workerPromise) {
        workerPromise = createWorker("por+eng");
    }

    return workerPromise;
}

async function runOCR(buffer) {
    const worker = await getOCRWorker();

    const result = await worker.recognize(buffer);

    return String(
        result?.data?.text || ""
    ).trim();
}

/* ============================================================
   NORMALIZAR TEXTO
============================================================ */

function normalizeText(text) {
    return String(text || "")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .trim();
}

/* ============================================================
   NÚMERO
============================================================ */

function normalizeNumber(number) {
    return String(number || "")
        .replace(/\D/g, "");
}

/* ============================================================
   OPERADORA
============================================================ */

function detectOperator(text) {
    const value = text.toLowerCase();

    if (
        value.includes("m-pesa") ||
        value.includes("mpesa") ||
        value.includes("vodacom")
    ) {
        return "mpesa";
    }

    if (
        value.includes("emola") ||
        value.includes("e-mola") ||
        value.includes("movitel")
    ) {
        return "emola";
    }

    if (
        value.includes("bim") ||
        value.includes("millennium bim")
    ) {
        return "bim";
    }

    return null;
}

/* ============================================================
   VALOR
============================================================ */

function detectAmount(text) {
    const patterns = [
        /(?:valor|montante|quantia|amount|transferiste|enviad[oa]|pagaste|pagamento)[^\d]{0,30}(\d+(?:[.,]\d{1,2})?)\s*(?:mt|mzn)?/i,

        /(\d+(?:[.,]\d{1,2})?)\s*(?:mt|mzn)/i,

        /(?:mt|mzn)\s*(\d+(?:[.,]\d{1,2})?)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (match?.[1]) {
            const value = Number(
                String(match[1]).replace(",", ".")
            );

            if (Number.isFinite(value)) {
                return value;
            }
        }
    }

    return null;
}

/* ============================================================
   DESTINO
============================================================ */

function detectDestination(text, operator) {
    const lines = text
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

    const patterns = [
        /(?:para|destino|benefici[aá]rio|destinat[aá]rio|enviado para|enviad[oa] para)\D{0,30}(\d{8,15})/i,

        /(?:n[úu]mero|number|telefone|phone)\D{0,20}(\d{8,15})/i,

        /\b(8\d{8})\b/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (match?.[1]) {
            return normalizeNumber(match[1]);
        }
    }

    /*
     * Fallback: procura números de telefone
     * diretamente no texto.
     */
    for (const line of lines) {
        const matches = line.match(/\b8\d{8}\b/g);

        if (matches?.length) {
            return normalizeNumber(matches[0]);
        }
    }

    return null;
}

/* ============================================================
   REFERÊNCIA
============================================================ */

function detectReference(text) {
    const patterns = [
        /(?:refer[eê]ncia|reference|transa[cç][aã]o|transaction|id)\s*[:#-]?\s*([A-Z0-9]{5,30})/i,

        /(?:op|ref)\s*[:#-]?\s*([A-Z0-9]{5,30})/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (match?.[1]) {
            return match[1].trim();
        }
    }

    /*
     * Fallback para códigos alfanuméricos.
     */
    const fallback = text.match(
        /\b[A-Z0-9]{8,20}\b/g
    );

    if (fallback?.length) {
        const ignored = new Set([
            "MPESA",
            "VODACOM",
            "MOVITEL",
            "MILLENNIUM",
            "CONFIRMADO",
            "PAGAMENTO",
            "TRANSFERISTE"
        ]);

        for (const value of fallback) {
            if (!ignored.has(value.toUpperCase())) {
                return value;
            }
        }
    }

    return null;
}

/* ============================================================
   VERIFICAR DESTINO
============================================================ */

function verifyDestination(groupId, operator, destination) {
    if (!groupId || !operator || !destination) {
        return false;
    }

    const payments = getPayments(groupId);

    const configured =
        payments?.[operator]?.number || "";

    if (!configured) {
        return false;
    }

    return (
        normalizeNumber(configured) ===
        normalizeNumber(destination)
    );
}

/* ============================================================
   DETECTAR COMPROVATIVO
============================================================ */

async function detectPayment(sock, m, groupId) {
    if (!sock || !m || !groupId) {
        return null;
    }

    if (!groupId.endsWith("@g.us")) {
        return null;
    }

    const message = m.message || {};

    /*
     * Nesta primeira versão trabalhamos com:
     * imagem e imagem dentro de view-once.
     */

    const hasImage =
        !!message.imageMessage ||
        !!message.viewOnceMessage?.message?.imageMessage ||
        !!message.viewOnceMessageV2?.message?.imageMessage;

    if (!hasImage) {
        return null;
    }

    try {
        const buffer = await downloadMediaMessage(
            m,
            "buffer",
            {},
            {
                logger: {
                    info() {},
                    error() {},
                    warn() {},
                    debug() {}
                }
            }
        );

        if (!buffer) {
            return null;
        }

        const rawText = await runOCR(buffer);

        if (!rawText) {
            return null;
        }

        const text = normalizeText(rawText);

        const operator = detectOperator(text);

        /*
         * Se não identificou nenhuma operadora,
         * não tratamos a imagem como comprovativo.
         */
        if (!operator) {
            return null;
        }

        const amount = detectAmount(text);
        const destination = detectDestination(
            text,
            operator
        );

        const reference = detectReference(text);

        const destinationVerified =
            verifyDestination(
                groupId,
                operator,
                destination
            );

        return {
            detected: true,
            operator,
            amount,
            destination,
            reference,
            destinationVerified,
            text,
            sender:
                m.key?.participant ||
                m.participant ||
                m.key?.remoteJid
        };

    } catch (error) {
        console.error(
            "paymentDetectorService:",
            error.message
        );

        return null;
    }
}

/* ============================================================
   FORMATAÇÃO
============================================================ */

function formatPaymentDetection(data) {
    const operatorNames = {
        mpesa: "M-Pesa",
        emola: "eMola",
        bim: "BIM"
    };

    const operator =
        operatorNames[data.operator] ||
        data.operator ||
        "Desconhecida";

    const amount =
        data.amount !== null &&
        data.amount !== undefined
            ? `${data.amount.toFixed(2)} MT`
            : "Não identificado";

    const destination =
        data.destination ||
        "Não identificado";

    const reference =
        data.reference ||
        "Não identificada";

    const verified =
        data.destinationVerified;

    return `╭━━━〔 🐻 URSINHO X BOT 〕━━━╮
┃
┃ ✅ PAGAMENTO DETECTADO
┃
┃ 👤 CLIENTE
┃ ┗ @${String(data.sender || "")
        .split("@")[0]}
┃
┃ 🏦 OPERADORA
┃ ┗ ${operator}
┃
┃ 🔑 REFERÊNCIA
┃ ┗ ${reference}
┃
┃ 💰 VALOR
┃ ┗ ${amount}
┃
┃ 📲 DESTINO
┃ ┗ ${destination}
┃
┃ 🎁 PACOTE
┃ ┗ —
┃
┃ ${verified ? "🟢 DESTINO VERIFICADO" : "🔴 DESTINO NÃO VERIFICADO"}
┃
╰━━━〔 💎 URSINHO X BOT 〕━━━╯`;
}

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
    detectPayment,
    formatPaymentDetection,
    detectOperator,
    detectAmount,
    detectDestination,
    detectReference,
    verifyDestination
};
