function unwrapMessage(message) {
    if (!message) return {};

    if (message.ephemeralMessage?.message)
        return unwrapMessage(message.ephemeralMessage.message);

    if (message.viewOnceMessage?.message)
        return unwrapMessage(message.viewOnceMessage.message);

    if (message.viewOnceMessageV2?.message)
        return unwrapMessage(message.viewOnceMessageV2.message);

    return message;
}


function extractText(message) {
    const msg = unwrapMessage(message);

    // ============================================================
    // MENSAGENS NORMAIS
    // ============================================================

    if (msg.conversation) {
        return String(msg.conversation).trim();
    }

    if (msg.extendedTextMessage?.text) {
        return String(msg.extendedTextMessage.text).trim();
    }

    if (msg.imageMessage?.caption) {
        return String(msg.imageMessage.caption).trim();
    }

    if (msg.videoMessage?.caption) {
        return String(msg.videoMessage.caption).trim();
    }

    if (msg.documentMessage?.caption) {
        return String(msg.documentMessage.caption).trim();
    }


    // ============================================================
    // NATIVE FLOW / BOTÕES
    // ============================================================

    const nativeFlow =
        msg.interactiveResponseMessage?.nativeFlowResponseMessage;

    if (nativeFlow?.paramsJson) {
        try {
            const params = JSON.parse(nativeFlow.paramsJson);

            // ID principal do botão
            if (params.id) {
                return String(params.id).trim();
            }

            // Alguns formatos usam selected_id
            if (params.selected_id) {
                return String(params.selected_id).trim();
            }

            // Outros formatos usam button_id
            if (params.button_id) {
                return String(params.button_id).trim();
            }

        } catch (error) {
            console.error(
                "Erro ao interpretar Native Flow:",
                error.message
            );
        }
    }


    // ============================================================
    // BOTÕES ANTIGOS DO WHATSAPP
    // ============================================================

    if (msg.buttonsResponseMessage?.selectedButtonId) {
        return String(
            msg.buttonsResponseMessage.selectedButtonId
        ).trim();
    }


    // ============================================================
    // TEMPLATE BUTTON
    // ============================================================

    if (msg.templateButtonReplyMessage?.selectedId) {
        return String(
            msg.templateButtonReplyMessage.selectedId
        ).trim();
    }


    // ============================================================
    // NENHUM TEXTO ENCONTRADO
    // ============================================================

    return "";
}


function getMessageType(message) {
    const msg = unwrapMessage(message);

    if (msg.imageMessage)
        return "image";

    if (msg.videoMessage)
        return "video";

    if (msg.audioMessage)
        return "audio";

    if (msg.stickerMessage)
        return "sticker";

    if (msg.documentMessage)
        return "document";

    return "text";
}


module.exports = {
    unwrapMessage,
    extractText,
    getMessageType
};
