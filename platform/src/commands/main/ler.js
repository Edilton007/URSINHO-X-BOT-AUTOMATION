const {
    downloadMediaMessage
} = require("@whiskeysockets/baileys");

const {
    unwrapMessage
} = require("../../services/messageService");

const {
    runOCR
} = require("../../services/ocrService");

function getQuotedMessage(m) {
    const contextInfo =
        m?.message?.extendedTextMessage?.contextInfo ||
        m?.message?.imageMessage?.contextInfo ||
        m?.message?.viewOnceMessage?.message?.imageMessage?.contextInfo ||
        m?.message?.viewOnceMessageV2?.message?.imageMessage?.contextInfo;

    return contextInfo?.quotedMessage || null;
}

function getImageMessage(message) {
    const msg = unwrapMessage(message);

    if (msg?.imageMessage) {
        return msg.imageMessage;
    }

    return null;
}

module.exports = {
    name: "ler",

    aliases: [
        "ocr",
        "leitura"
    ],

    category: "ia",
    iaGroup: "ferramentas",

    description: "Ler e extrair texto de uma imagem",

    run: async (sock, m, ctx) => {
        let targetMessage = m;

        const ownMessage = unwrapMessage(m?.message);

        /*
         * Se o comando estiver numa imagem, usamos a própria imagem.
         */
        if (!getImageMessage(ownMessage)) {
            const quotedMessage = getQuotedMessage(m);

            if (quotedMessage) {
                targetMessage = {
                    ...m,
                    message: quotedMessage
                };
            }
        }

        const imageMessage =
            getImageMessage(targetMessage?.message);

        if (!imageMessage) {
            return ctx.reply(
                `📖 *LER IMAGEM*

Envia uma imagem com o comando ${ctx.prefix}ler na legenda ou responde a uma imagem com:

${ctx.prefix}ler

Exemplo:
${ctx.prefix}ler`
            );
        }

        let buffer;

        try {
            buffer = await downloadMediaMessage(
                targetMessage,
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
                "Erro ao baixar imagem para OCR:",
                error?.message || error
            );

            return ctx.reply(
                "❌ Não consegui baixar a imagem. Tenta enviar ou responder à imagem novamente."
            );
        }

        if (!buffer) {
            return ctx.reply(
                "❌ Não consegui obter a imagem."
            );
        }

        await ctx.reply(
            "📖 *A ler a imagem...*"
        );

        try {
            const text = await runOCR(buffer);

            if (!text) {
                return ctx.reply(
                    "❌ Não consegui identificar texto nesta imagem."
                );
            }

            return ctx.reply(
                `📖 *TEXTO DA IMAGEM*\n\n${text}`
            );

        } catch (error) {
            console.error(
                "Erro no OCR:",
                error?.message || error
            );

            return ctx.reply(
                "❌ Ocorreu um erro ao ler a imagem."
            );
        }
    }
};
