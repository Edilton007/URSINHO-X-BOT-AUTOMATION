const {
    downloadMediaMessage
} = require("@whiskeysockets/baileys");

const {
    unwrapMessage
} = require("./messageService");

// ============================================================
// LOCALIZAR MÍDIA (na mensagem atual ou na citada)
// ============================================================

function getQuotedMessage(m) {
    const contextInfo =
        m?.message?.extendedTextMessage?.contextInfo ||
        m?.message?.imageMessage?.contextInfo ||
        m?.message?.videoMessage?.contextInfo ||
        m?.message?.audioMessage?.contextInfo ||
        m?.message?.viewOnceMessage?.message?.extendedTextMessage?.contextInfo ||
        m?.message?.viewOnceMessage?.message?.imageMessage?.contextInfo ||
        m?.message?.viewOnceMessageV2?.message?.extendedTextMessage?.contextInfo ||
        m?.message?.viewOnceMessageV2?.message?.imageMessage?.contextInfo;

    return contextInfo?.quotedMessage || null;
}

/**
 * Limpa o mimetype antes de mandar pro Gemini — o WhatsApp
 * manda coisas tipo "audio/ogg; codecs=opus", e a API do
 * Gemini só aceita o tipo puro (ex: "audio/ogg").
 */
function limparMimetype(mimetype) {
    return String(mimetype || "").split(";")[0].trim();
}

/**
 * Procura imagem ou áudio na mensagem atual, e se não achar
 * (e não houver texto próprio escrito), na mensagem citada
 * (reply). Retorna null se não houver.
 *
 * O parâmetro `textoProprio` evita que uma resposta de texto
 * normal a um áudio/imagem (ex: responder "Parabéns" a uma
 * nota de voz) seja mal interpretada como "analisa essa mídia"
 * — só olha pra mídia citada quando a pessoa não escreveu nada.
 */
function extractAIMedia(m, textoProprio) {

    const current = unwrapMessage(m?.message);

    if (current?.imageMessage) {
        return {
            kind: "image",
            message: { message: current },
            mimetype:
                limparMimetype(current.imageMessage.mimetype) || "image/jpeg"
        };
    }

    if (current?.audioMessage) {
        return {
            kind: "audio",
            message: { message: current },
            mimetype:
                limparMimetype(current.audioMessage.mimetype) || "audio/ogg"
        };
    }

    // Stickers são imagens WebP — o Gemini lê-os diretamente,
    // tratamos como "image" (não precisamos de um kind à parte).
    if (current?.stickerMessage) {
        return {
            kind: "image",
            message: { message: current },
            mimetype:
                limparMimetype(current.stickerMessage.mimetype) || "image/webp"
        };
    }

    // Se a pessoa já escreveu um texto próprio, não vai buscar
    // mídia na mensagem citada — o texto dela é que importa.
    if (textoProprio && textoProprio.trim()) {
        return null;
    }

    const quoted = getQuotedMessage(m);
    const quotedUnwrapped = unwrapMessage(quoted);

    if (quotedUnwrapped?.imageMessage) {
        return {
            kind: "image",
            message: { message: quotedUnwrapped },
            mimetype:
                limparMimetype(quotedUnwrapped.imageMessage.mimetype) || "image/jpeg"
        };
    }

    if (quotedUnwrapped?.audioMessage) {
        return {
            kind: "audio",
            message: { message: quotedUnwrapped },
            mimetype:
                limparMimetype(quotedUnwrapped.audioMessage.mimetype) || "audio/ogg"
        };
    }

    if (quotedUnwrapped?.stickerMessage) {
        return {
            kind: "image",
            message: { message: quotedUnwrapped },
            mimetype:
                limparMimetype(quotedUnwrapped.stickerMessage.mimetype) || "image/webp"
        };
    }

    return null;
}

// ============================================================
// BAIXAR E CONVERTER PRA BASE64
// ============================================================

async function downloadAIMediaBase64(sock, media) {

    if (!media) {
        return null;
    }

    const buffer = await downloadMediaMessage(
        media.message,
        "buffer",
        {},
        {
            logger: {
                info() {},
                error() {},
                warn() {},
                debug() {}
            },
            reuploadRequest: sock.updateMediaMessage
        }
    );

    return {
        kind: media.kind,
        mimetype: media.mimetype,
        base64: buffer.toString("base64")
    };
}

module.exports = {
    extractAIMedia,
    downloadAIMediaBase64,
    getQuotedMessage
};
