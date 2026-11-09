const {
    downloadMediaMessage
} = require("@whiskeysockets/baileys");

const {
    createWorker
} = require("tesseract.js");

const {
    getPayments,
    isDetectorEnabled
} = require("./salesService");

const {
    unwrapMessage
} = require("./messageService");

const fs = require("fs");
const path = require("path");

/* ============================================================
   DATABASE DE COMPROVATIVOS UTILIZADOS
   ============================================================ */

const RECEIPTS_DB_PATH = path.join(
    __dirname,
    "../database/usedReceipts.json"
);

function loadUsedReceipts() {
    if (!fs.existsSync(RECEIPTS_DB_PATH)) {
        const initial = {
            groups: {}
        };

        fs.writeFileSync(
            RECEIPTS_DB_PATH,
            JSON.stringify(initial, null, 2)
        );

        return initial;
    }

    try {
        const db = JSON.parse(
            fs.readFileSync(
                RECEIPTS_DB_PATH,
                "utf8"
            )
        );

        if (!db.groups) {
            db.groups = {};
        }

        return db;

    } catch (error) {
        console.error(
            "usedReceipts load erro:",
            error.message
        );

        return {
            groups: {}
        };
    }
}

function saveUsedReceipts(db) {
    fs.writeFileSync(
        RECEIPTS_DB_PATH,
        JSON.stringify(db, null, 2)
    );
}

/* ============================================================
   NORMALIZAR TEXTO
   ============================================================ */

function normalizeText(text) {
    return String(text || "")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n+/g, "\n")
        .trim();
}

/* ============================================================
   NORMALIZAR TEXTO PARA COMPARAÇÃO
   ============================================================ */

function normalizeCompare(text) {
    return String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}]/gu, "")
        .toLowerCase();
}

/* ============================================================
   LIMPAR NÚMERO
   ============================================================ */

function cleanNumber(value) {
    return String(value || "")
        .replace(/[^\d]/g, "");
}

/* ============================================================
   EXTRAIR TEXTO DA MENSAGEM
   ============================================================ */

function extractMessageText(message) {
    if (!message) {
        return "";
    }

    /*
     * Mensagem normal
     */
    if (typeof message.conversation === "string") {
        return normalizeText(
            message.conversation
        );
    }

    /*
     * Mensagem de texto estendida
     */
    if (
        message.extendedTextMessage &&
        typeof message.extendedTextMessage.text === "string"
    ) {
        return normalizeText(
            message.extendedTextMessage.text
        );
    }

    /*
     * Texto dentro de imagem como legenda
     */
    if (
        message.imageMessage &&
        typeof message.imageMessage.caption === "string"
    ) {
        return normalizeText(
            message.imageMessage.caption
        );
    }

    /*
     * Texto dentro de vídeo como legenda
     */
    if (
        message.videoMessage &&
        typeof message.videoMessage.caption === "string"
    ) {
        return normalizeText(
            message.videoMessage.caption
        );
    }

    return "";
}

/* ============================================================
   DETECTAR OPERADORA
   ============================================================ */

function detectOperator(text) {
    const value = String(text || "").toLowerCase();

    /* ========================================================
       eMOLA
       ======================================================== */

    if (
        /id\s+da\s+transa[cç][aã]o/i.test(value) ||
        (
            value.includes("transferiste") &&
            value.includes("para conta") &&
            (
                value.includes("nome:") ||
                value.includes("nome :")
            )
        )
    ) {
        return "emola";
    }

    /* ========================================================
       M-PESA
       ======================================================== */

    if (
        /^\s*confirmado\b/i.test(value) ||
        /\bconfirmado\s+[A-Z0-9]{5,30}\b/i.test(text)
    ) {
        return "mpesa";
    }

    /* ========================================================
       FALLBACK M-PESA
       ======================================================== */

    if (
        value.includes("m-pesa") ||
        value.includes("mpesa") ||
        value.includes("vodacom")
    ) {
        return "mpesa";
    }

    /* ========================================================
       FALLBACK eMOLA
       ======================================================== */

    if (
        value.includes("emola") ||
        value.includes("e-mola") ||
        value.includes("movitel")
    ) {
        return "emola";
    }

    return null;
}

/* ============================================================
   DETECTAR REFERÊNCIA
   ============================================================ */

function detectReference(
    text,
    operator = null
) {
    const value = normalizeText(text);

    /* ========================================================
       eMOLA
       ID da transacao PP260809.1207.s39449.
       ======================================================== */

    if (operator === "emola") {
        const match = value.match(
            /ID\s+da\s+transa[cç][aã]o\s*[:#-]?\s*([A-Z0-9._-]{8,50})/i
        );

        if (match?.[1]) {
            return match[1]
                .replace(/[.,]+$/, "")
                .trim();
        }
    }

    /* ========================================================
       M-PESA
       Confirmado DH26L1VHAYW.
       ======================================================== */

    if (operator === "mpesa") {
        const match = value.match(
            /\bConfirmado\s+([A-Z0-9]{5,30})/i
        );

        if (match?.[1]) {
            return match[1].trim();
        }
    }

    /* ========================================================
       FALLBACK
       ======================================================== */

    const patterns = [
        /(?:refer[eê]ncia|reference|ref)[\s:#-]*([A-Z0-9._-]{5,50})/i,

        /(?:transa[cç][aã]o|transaction|id)[\s:#-]*([A-Z0-9._-]{5,50})/i
    ];

    for (const regex of patterns) {
        const match = value.match(regex);

        if (match?.[1]) {
            return match[1]
                .replace(/[.,]+$/, "")
                .trim();
        }
    }

    return null;
}

/* ============================================================
   DETECTAR VALOR
   ============================================================ */

function detectAmount(
    text,
    operator = null
) {
    const value = normalizeText(text);

    /* ========================================================
       eMOLA
       ======================================================== */

    if (operator === "emola") {
        const match = value.match(
            /Transferiste\s+([\d.,]+)\s*MT\b/i
        );

        if (match?.[1]) {
            const amount = Number(
                match[1].replace(",", ".")
            );

            if (
                Number.isFinite(amount) &&
                amount > 0
            ) {
                return amount;
            }
        }
    }

    /* ========================================================
       M-PESA
       ======================================================== */

    if (operator === "mpesa") {
        const match = value.match(
            /Transferiste\s+([\d.,]+)\s*MT\b/i
        );

        if (match?.[1]) {
            const amount = Number(
                match[1].replace(",", ".")
            );

            if (
                Number.isFinite(amount) &&
                amount > 0
            ) {
                return amount;
            }
        }
    }

    /* ========================================================
       FALLBACK
       ======================================================== */

    const patterns = [
        /(?:valor|amount|quantia|montante|recebeste|recebido|transferiste|transferido)[^\d]{0,20}([\d.,]+)\s*(?:mt|mzn)?/i,

        /([\d.,]+)\s*(?:mt|mzn)/i,

        /mt\s*([\d.,]+)/i
    ];

    for (const regex of patterns) {
        const match = value.match(regex);

        if (match?.[1]) {
            const amount = Number(
                match[1].replace(",", ".")
            );

            if (
                Number.isFinite(amount) &&
                amount > 0
            ) {
                return amount;
            }
        }
    }

    return null;
}

/* ============================================================
   DETECTAR DESTINO
   ============================================================ */

function detectDestination(
    text,
    operator = null
) {
    const value = normalizeText(text);

    /* ========================================================
       eMOLA
       para conta 877145014, nome:
       ======================================================== */

    if (operator === "emola") {
        const match = value.match(
            /para\s+conta\s+((?:8[6-7])\d{7})\b/i
        );

        if (match?.[1]) {
            return cleanNumber(
                match[1]
            );
        }
    }

    /* ========================================================
       M-PESA
       para 258857745014 - EDILTON
       ======================================================== */

    if (operator === "mpesa") {
        const match = value.match(
            /para\s+((?:258)?8[4-5]\d{7})\s*[-–—]\s*([^\n.]+?)(?:\s+ao|\s+as|\s+aos|\s+às|\.)/i
        );

        if (match?.[1]) {
            return cleanNumber(
                match[1]
            );
        }

        /* ====================================================
           FALLBACK MAIS SIMPLES
           ==================================================== */

        const fallback = value.match(
            /para\s+((?:258)?8[4-5]\d{7})\b/i
        );

        if (fallback?.[1]) {
            return cleanNumber(
                fallback[1]
            );
        }
    }

    return null;
}

/* ============================================================
   DETECTAR NOME DO DESTINO
   ============================================================ */

function detectDestinationName(
    text,
    operator = null
) {
    const value = normalizeText(text);

    /*
     * OCR pode separar o nome em várias linhas.
     *
     * Transformamos temporariamente tudo numa única linha.
     */

    const singleLine = value
        .replace(/\s+/g, " ")
        .trim();

    /* ========================================================
       eMOLA
       ======================================================== */

    if (operator === "emola") {

        /*
         * Aceita:
         *
         * nome: EDILTON RONALDO MANGUELE as 12:07:19
         *
         * nome : EDILTON RONALDO MANGUELE as 12:07:19
         *
         * NOME: EDILTON RONALDO MANGUELE
         * as 12:07:19
         */

        const match = singleLine.match(
            /nome\s*:\s*(.+?)(?=\s+(?:as|às|aos)\s+\d{1,2}:\d{2}(?::\d{2})?|\s+\d{1,2}:\d{2}(?::\d{2})?\s+de\s+\d{1,2}\/\d{1,2}\/\d{2,4}|\s+taxa\s*:|\s+o\s+saldo\b|\s+conte[uú]do\s*:|$)/i
        );

        if (match?.[1]) {
            const name = match[1]
                .replace(/\s+/g, " ")
                .trim();

            if (name) {
                return name;
            }
        }

        /*
         * FALLBACK 1
         *
         * Caso o OCR tenha perdido os dois pontos.
         *
         * Exemplo:
         *
         * nome EDILTON RONALDO MANGUELE
         */

        const fallback1 = singleLine.match(
            /\bnome\s*[:\-]?\s*(.+?)(?=\s+(?:as|às|aos)\b|\s+\d{1,2}:\d{2}|\s+taxa\b|\s+o\s+saldo\b|\s+conte[uú]do\b|$)/i
        );

        if (fallback1?.[1]) {
            const name = fallback1[1]
                .replace(/\s+/g, " ")
                .trim();

            if (name) {
                return name;
            }
        }

        /*
         * FALLBACK 2
         *
         * Se o OCR colocar o nome numa linha e a hora
         * numa linha seguinte.
         */

        const lines = value
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (/^nome\s*:/i.test(line)) {
                let name = line
                    .replace(/^nome\s*:\s*/i, "")
                    .trim();

                /*
                 * Se a linha seguinte for continuação
                 * do nome, juntamos.
                 */

                if (
                    lines[i + 1] &&
                    !/^(?:as|às|aos)\s+\d{1,2}:\d{2}/i.test(
                        lines[i + 1]
                    ) &&
                    !/^\d{1,2}:\d{2}/.test(
                        lines[i + 1]
                    )
                ) {
                    if (
                        /^[A-ZÁÀÃÂÉÊÍÓÔÕÚÇÑ\s]+$/i.test(
                            lines[i + 1]
                        )
                    ) {
                        name += " " + lines[i + 1];
                    }
                }

                name = name
                    .replace(/\s+/g, " ")
                    .trim();

                if (name) {
                    return name;
                }
            }
        }
    }

    /* ========================================================
       M-PESA
       ======================================================== */

    if (operator === "mpesa") {
        /*
         * ====================================================
         * M-PESA — NOME DO DESTINO
         * ----------------------------------------------------
         * Aceita:
         *
         * para 857745014 - EDILTON aos 14/8/26
         * para 841234567 - EDILTON as 14/8/26
         * para 258857745014 - EDILTON aos 14/8/26
         *
         * O nome é capturado somente depois do hífen.
         * O número pode ser qualquer número válido de
         * 9 dígitos ou 12 dígitos com 258.
         * ====================================================
         */

        const match = singleLine.match(
            /para\s+(?:258)?8[2-7]\d{7}\s*[-–—]\s*(.+?)(?=\s+(?:aos|as|às|em|no)\b)/i
        );

        if (match?.[1]) {
            const name = match[1]
                .replace(/\s+/g, " ")
                .trim();

            if (name) {
                return name;
            }
        }
    }

    return null;
}

/* ============================================================
   DETECTAR DATA / HORA
   ============================================================ */

function detectDateTime(
    text,
    operator = null
) {
    const value = normalizeText(text);

    /*
     * Criamos também uma versão numa única linha.
     * Isso ajuda quando OCR quebra a data/hora.
     */

    const singleLine = value
        .replace(/\s+/g, " ")
        .trim();

    /* ========================================================
       eMOLA
       as 12:07:19 de 09/08/2026
       ======================================================== */

    if (operator === "emola") {
        const patterns = [
            /(?:as|às|aos)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+de\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,

            /(\d{1,2}:\d{2}(?::\d{2})?)\s+de\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i
        ];

        for (const regex of patterns) {
            const match = singleLine.match(regex);

            if (match) {
                if (regex === patterns[0]) {
                    return `${match[2]} ${match[1]}`;
                }

                return `${match[2]} ${match[1]}`;
            }
        }
    }

    /* ========================================================
       M-PESA
       aos 2/8/26 as 12:00 PM
       ======================================================== */

    if (operator === "mpesa") {
        const patterns = [
            /(?:aos|em|no)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:as|às)\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i,

            /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:as|às)\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i
        ];

        for (const regex of patterns) {
            const match = singleLine.match(regex);

            if (match) {
                return `${match[1]} ${match[2]}`;
            }
        }
    }

    return null;
}

/* ============================================================
   NÚMEROS ENCONTRADOS
   ============================================================ */

function extractPhoneNumbers(text) {
    const matches =
        String(text || "").match(
            /(?:\+?258[\s-]?)?(?:8[2-7]\d{7})\b/g
        ) || [];

    return matches.map(cleanNumber);
}

/* ============================================================
   VERIFICAR DESTINO
   ============================================================ */

function verifyDestination(
    groupId,
    operator,
    text,
    destination = null,
    destinationName = null
) {
    /*
     * MUITO IMPORTANTE:
     *
     * A configuração é sempre obtida usando
     * o groupId que recebeu o comprovativo.
     *
     * Nunca usamos configuração global.
     */

    const payments = getPayments(
        groupId
    );

    const account =
        payments?.[operator];

    if (
        !account ||
        !account.number
    ) {
        return {
            verified: false,

            numberMatch: false,

            nameMatch: false,

            configuredNumber: null,

            configuredName: null,

            destination:
                destination || null,

            destinationName:
                destinationName || null
        };
    }

    const configuredNumber =
        cleanNumber(
            account.number
        );

    const configuredName =
        String(
            account.name || ""
        ).trim();

    const foundNumbers =
        extractPhoneNumbers(text);

    /* ========================================================
       VERIFICAR NÚMERO
       ======================================================== */

    let numberMatch = false;

    if (destination) {
        numberMatch =
            cleanNumber(destination) ===
            configuredNumber;
    } else {
        numberMatch =
            foundNumbers.some(
                number =>
                    number === configuredNumber ||
                    number.endsWith(configuredNumber) ||
                    configuredNumber.endsWith(number)
            );
    }

    /* ========================================================
       VERIFICAR NOME
       ======================================================== */

    let nameMatch = false;

    if (
        configuredName &&
        destinationName
    ) {
        nameMatch =
            normalizeCompare(
                destinationName
            ) ===
            normalizeCompare(
                configuredName
            );
    }

    /*
     * Só consideramos verificado quando
     * número E nome correspondem.
     */

    const verified =
        numberMatch &&
        nameMatch;

    return {
        verified,

        numberMatch,

        nameMatch,

        configuredNumber,

        configuredName,

        destination:
            destination || null,

        destinationName:
            destinationName || null
    };
}

/* ============================================================
   VALIDAR SE É COMPROVATIVO
   ============================================================ */

function looksLikeReceipt(
    text,
    operator = null
) {
    const value =
        String(text || "").toLowerCase();

    /* ========================================================
       eMOLA
       ======================================================== */

    if (operator === "emola") {
        return (
            /id\s+da\s+transa[cç][aã]o/i.test(value) &&
            value.includes("transferiste") &&
            value.includes("para conta") &&
            (
                value.includes("nome:") ||
                value.includes("nome :") ||
                /\bnome\s+/i.test(value)
            )
        );
    }

    /* ========================================================
       M-PESA
       ======================================================== */

    if (operator === "mpesa") {
        return (
            /\bconfirmado\b/i.test(value) &&
            value.includes("transferiste") &&
            value.includes("para")
        );
    }

    /* ========================================================
       FALLBACK
       ======================================================== */

    const keywords = [
        "pagamento",
        "transferência",
        "transferencia",
        "transferiste",
        "recebeste",
        "recebido",
        "transação",
        "transacao",
        "m-pesa",
        "mpesa",
        "emola",
        "e-mola",
        "vodacom",
        "movitel",
        "mt"
    ];

    let score = 0;

    for (const keyword of keywords) {
        if (value.includes(keyword)) {
            score++;
        }
    }

    return score >= 2;
}

/* ============================================================
   OCR
   ============================================================ */

async function runOCR(buffer) {
    const worker =
        await createWorker("por");

    try {
        const result =
            await worker.recognize(
                buffer
            );

        return normalizeText(
            result?.data?.text || ""
        );

    } finally {
        await worker.terminate();
    }
}

/* ============================================================
   VERIFICAR REFERÊNCIA JÁ UTILIZADA
   ============================================================ */

function getUsedReceipt(
    groupId,
    reference
) {
    if (
        !groupId ||
        !reference
    ) {
        return null;
    }

    const db =
        loadUsedReceipts();

    const group =
        db.groups?.[groupId];

    if (!group) {
        return null;
    }

    return (
        group[reference] ||
        null
    );
}

/* ============================================================
   REGISTRAR REFERÊNCIA
   ============================================================ */

function saveUsedReceipt(
    groupId,
    reference,
    data
) {
    if (
        !groupId ||
        !reference
    ) {
        return false;
    }

    const db =
        loadUsedReceipts();

    if (
        !db.groups[groupId]
    ) {
        db.groups[groupId] = {};
    }

    db.groups[groupId][reference] = {
        reference,

        sender:
            data.sender ||
            null,

        pushName:
            data.pushName ||
            null,

        usedAt:
            data.usedAt ||
            Date.now(),

        dateTime:
            data.dateTime ||
            null,

        operator:
            data.operator ||
            null,

        amount:
            data.amount ||
            null,

        destination:
            data.destination ||
            null,

        destinationName:
            data.destinationName ||
            null
    };

    saveUsedReceipts(db);

    return true;
}

/* ============================================================
   OBTER REMETENTE
   ============================================================ */

function getMessageSender(m) {
    return (
        m?.key?.participant ||
        m?.participant ||
        m?.senderPn ||
        m?.key?.remoteJid ||
        null
    );
}

/* ============================================================
   OBTER NOME DO REMETENTE
   ============================================================ */

function getMessagePushName(m) {
    return (
        m?.pushName ||
        m?.key?.pushName ||
        "Cliente"
    );
}

/* ============================================================
   ANALISAR COMPROVATIVO
   ============================================================ */

async function analyzeReceipt(
    sock,
    m,
    groupId
) {
    if (!groupId) {
        return null;
    }

    /* ========================================================
       DETECTOR DESLIGADO
       ======================================================== */

    if (!isDetectorEnabled(groupId)) {
        return null;
    }

    const message =
        unwrapMessage(
            m?.message
        );

    if (!message) {
        return null;
    }

    let text = "";

    /* ========================================================
       IDENTIFICAR ORIGEM DO COMPROVATIVO
       ======================================================== */

    const hasImage =
        !!message.imageMessage;

    const directText =
        extractMessageText(
            message
        );

    /* ========================================================
       TEXTO DIRETO
       ======================================================== */

    if (
        !hasImage &&
        directText
    ) {
        text = directText;
    }

    /* ========================================================
       IMAGEM
       ======================================================== */

    if (hasImage) {
        let buffer;

        try {
            buffer =
                await downloadMediaMessage(
                    m,
                    "buffer",
                    {},
                    {
                        logger: {
                            info() {},
                            error() {},
                            warn() {},
                            debug() {}
                        },

                        reuploadRequest:
                            sock.updateMediaMessage
                    }
                );

        } catch (error) {
            console.error(
                "Detector download erro:",
                error.message
            );

            return null;
        }

        if (!buffer) {
            return null;
        }

        /* ====================================================
           OCR
           ==================================================== */

        try {
            text =
                await runOCR(
                    buffer
                );

        } catch (error) {
            console.error(
                "Detector OCR erro:",
                error.message
            );

            return null;
        }

        /*
         * Se existir legenda juntamente com
         * a imagem, juntamos a legenda ao OCR.
         */

        if (
            directText &&
            text &&
            !text.includes(directText)
        ) {
            text =
                `${text}\n${directText}`;
        } else if (
            directText &&
            !text
        ) {
            text = directText;
        }
    }

    /* ========================================================
       SEM TEXTO
       ======================================================== */

    if (!text) {
        return null;
    }

    text =
        normalizeText(
            text
        );

    /* ========================================================
       OPERADORA
       ======================================================== */

    const operator =
        detectOperator(
            text
        );

    if (!operator) {
        return null;
    }

    /* ========================================================
       VALIDAR COMPROVATIVO
       ======================================================== */

    if (
        !looksLikeReceipt(
            text,
            operator
        )
    ) {
        return null;
    }

    /* ========================================================
       EXTRAIR DADOS
       ======================================================== */

    const reference =
        detectReference(
            text,
            operator
        );

    const amount =
        detectAmount(
            text,
            operator
        );

    const destination =
        detectDestination(
            text,
            operator
        );

    const destinationName =
        detectDestinationName(
            text,
            operator
        );

    const dateTime =
        detectDateTime(
            text,
            operator
        );

    /*
     * Sem referência não processamos.
     *
     * A referência é usada para impedir
     * reutilização.
     */

    if (!reference) {
        return null;
    }

    /* ========================================================
       DUPLICADO
       ======================================================== */

    const previous =
        getUsedReceipt(
            groupId,
            reference
        );

    const sender =
        getMessageSender(
            m
        );

    const pushName =
        getMessagePushName(
            m
        );

    if (previous) {
        return {
            detected: true,

            duplicate: true,

            operator,

            reference,

            amount,

            destination,

            destinationName,

            dateTime,

            previous,

            sender,

            pushName,

            rawText: text
        };
    }

    /* ========================================================
       VERIFICAR DESTINO
       ======================================================== */

    const verification =
        verifyDestination(
            groupId,
            operator,
            text,
            destination,
            destinationName
        );

    /* ========================================================
       REGISTRAR REFERÊNCIA
       ======================================================== */

    const usedAt =
        Date.now();

    /*
     * A referência fica registrada mesmo
     * quando o número/nome não corresponde.
     *
     * Assim ninguém consegue reutilizar
     * o mesmo comprovativo.
     */

    saveUsedReceipt(
        groupId,
        reference,
        {
            sender,

            pushName,

            usedAt,

            dateTime,

            operator,

            amount,

            destination,

            destinationName
        }
    );

    return {
        detected: true,

        duplicate: false,

        operator,

        reference,

        amount,

        destination,

        destinationName,

        dateTime,

        verified:
            verification.verified,

        numberMatch:
            verification.numberMatch,

        nameMatch:
            verification.nameMatch,

        configuredNumber:
            verification.configuredNumber,

        configuredName:
            verification.configuredName,

        sender,

        pushName,

        rawText: text
    };
}

/* ============================================================
   FORMATAR DATA/HORA DO DUPLICADO
   ============================================================ */

function formatPreviousDate(
    previous
) {
    if (
        previous?.dateTime
    ) {
        return previous.dateTime;
    }

    if (
        previous?.usedAt
    ) {
        return new Date(
            previous.usedAt
        ).toLocaleString(
            "pt-PT",
            {
                timeZone:
                    "Africa/Maputo"
            }
        );
    }

    return "Não identificada";
}

/* ============================================================
   FORMATAR RESULTADO
   ============================================================ */

function formatReceiptResult(
    data
) {
    const operatorNames = {
        mpesa: "M-Pesa",
        emola: "eMola",
        bim: "BIM"
    };

    const operator =
        operatorNames[
            data.operator
        ] ||
        "Desconhecida";

    const amount =
        data.amount != null
            ? `${data.amount.toFixed(2)} MT`
            : "Não identificado";

    const reference =
        data.reference ||
        "Não identificada";

    const destination =
        data.destination ||
        "Não identificado";

    const destinationName =
        data.destinationName ||
        "Não identificado";

    /* ========================================================
       CLIENTE
       ======================================================== */

    const client =
        data.sender ||
        null;

    const clientMention =
        client
            ? `@${client.split("@")[0]}`
            : data.pushName ||
              "Cliente";

    /* ========================================================
       DUPLICADO
       ======================================================== */

    if (data.duplicate) {
        const previous =
            data.previous ||
            {};

        const previousClient =
            previous.sender
                ? `@${previous.sender.split("@")[0]}`
                : previous.pushName ||
                  "Cliente";

        const previousDate =
            formatPreviousDate(
                previous
            );

        return `╭━━━〔 🐻 URSINHO X BOT 〕━━━╮
┃
┃ ⚠️ COMPROVATIVO JÁ FOI USADO
┃
┃ 👤 TENTOU USAR
┃ ┗ ${clientMention}
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
┃ 👤 USADO ANTERIORMENTE POR
┃ ┗ ${previousClient}
┃
┃ 🕐 DATA E HORA
┃ ┗ ${previousDate}
┃
┃ 🚫 Este comprovativo já foi
┃ utilizado anteriormente.
┃
╰━━━〔 💎 URSINHO X BOT 〕━━━╯`;
    }

    /* ========================================================
       DESTINO VERIFICADO
       ======================================================== */

    if (data.verified) {
        return `╭━━━〔 🐻 URSINHO X BOT 〕━━━╮
┃
┃ ✅ PAGAMENTO DETECTADO
┃
┃ 👤 CLIENTE
┃ ┗ ${clientMention}
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
┃ 👤 NOME
┃ ┗ ${destinationName}
┃
┃ 🟢 DESTINO VERIFICADO
┃
╰━━━〔 💎 URSINHO X BOT 〕━━━╯`;
    }

    /* ========================================================
       DESTINO NÃO VERIFICADO
       ======================================================== */

    let mismatch = "";

    if (
        !data.numberMatch &&
        !data.nameMatch
    ) {
        mismatch = `┃
┃ 🔴 NÚMERO E NOME NÃO CORRESPONDEM
┃
┃ 📲 NÚMERO PROGRAMADO
┃ ┗ ${data.configuredNumber || "Não configurado"}
┃
┃ 👤 NOME PROGRAMADO
┃ ┗ ${data.configuredName || "Não configurado"}`;

    } else if (
        !data.numberMatch
    ) {
        mismatch = `┃
┃ 🔴 NÚMERO NÃO CORRESPONDE
┃
┃ 📲 NÚMERO PROGRAMADO
┃ ┗ ${data.configuredNumber || "Não configurado"}`;

    } else if (
        !data.nameMatch
    ) {
        mismatch = `┃
┃ 🔴 NOME NÃO CORRESPONDE
┃
┃ 👤 NOME PROGRAMADO
┃ ┗ ${data.configuredName || "Não configurado"}`;

    } else {
        mismatch = `┃
┃ 🟡 DESTINO NÃO VERIFICADO`;
    }

    return `╭━━━〔 🐻 URSINHO X BOT 〕━━━╮
┃
┃ ⚠️ PAGAMENTO NÃO VERIFICADO
┃
┃ 👤 CLIENTE
┃ ┗ ${clientMention}
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
┃ 📲 DESTINO NO COMPROVATIVO
┃ ┗ ${destination}
┃
┃ 👤 NOME NO COMPROVATIVO
┃ ┗ ${destinationName}
${mismatch}
┃
╰━━━〔 💎 URSINHO X BOT 〕━━━╯`;
}

/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {
    analyzeReceipt,

    formatReceiptResult,

    detectOperator,

    detectAmount,

    detectReference,

    detectDestination,

    detectDestinationName,

    detectDateTime,

    verifyDestination,

    loadUsedReceipts,

    saveUsedReceipts,

    getUsedReceipt,

    saveUsedReceipt
};
