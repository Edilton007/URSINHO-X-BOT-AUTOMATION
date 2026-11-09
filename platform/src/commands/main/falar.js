const fs = require("fs");

const {
    generateSpeech,
    temTtsConfigurado
} = require("../../services/ttsService");

const db = require("../../database/database");

const {
    extractAIMedia,
    downloadAIMediaBase64,
    getQuotedMessage
} = require("../../services/aiMediaService");

const {
    extractText,
    unwrapMessage
} = require("../../services/messageService");

const { askGemini, getUltimoErroGemini } = require("../../services/geminiService");

module.exports = {
    name: "falar",

    aliases: [
        "tts"
    ],

    category: "ia",
    iaGroup: "inteligencia",

    description: "Falar um texto, ler uma mensagem citada, descrever uma imagem citada, ou responder a um áudio citado — tudo em voz",

    run: async (sock, m, ctx) => {

        if (!temTtsConfigurado()) {
            return ctx.reply(
                "❌ O recurso de voz não está configurado (falta a GEMINI_API_KEY ou o motor gratuito)."
            );
        }

        const textoDigitado = ctx.args.join(" ").trim();

        let textoParaFalar = textoDigitado;

        try {

            // Se não escreveu nada, olha pra mensagem citada
            if (!textoParaFalar) {

                const aiMedia = extractAIMedia(m);

                // 1) Respondeu a uma IMAGEM -> descreve e fala a descrição
                if (aiMedia?.kind === "image") {

                    await ctx.reply("🖼️ *A ver a imagem...*");

                    const mediaPayload =
                        await downloadAIMediaBase64(sock, aiMedia);

                    const descricao = await askGemini(
                        "Descreve o que vês nesta imagem, de forma natural e falada (como se estivesses a contar a alguém).",
                        {
                            chat: ctx.chat,
                            sender: ctx.sender,
                            isGroup: ctx.isGroup,
                            pushName: ctx.pushName,
                            media: mediaPayload
                        }
                    );

                    if (!descricao) {
                        return ctx.reply(
                            `❌ Não consegui descrever essa imagem agora.\n\n_Erro técnico: ${getUltimoErroGemini() || "desconhecido"}_`
                        );
                    }

                    textoParaFalar = descricao;

                } else if (aiMedia?.kind === "audio") {

                    // 3) Respondeu a um ÁUDIO -> ouve, entende, e
                    // responde falando de volta (conversa por voz)

                    await ctx.reply("🎧 *A ouvir o áudio...*");

                    const mediaPayload =
                        await downloadAIMediaBase64(sock, aiMedia);

                    const resposta = await askGemini(
                        "Ouve este áudio e responde ao que a pessoa disse ou pediu, de forma natural e falada (como se estivesses a responder de viva voz).",
                        {
                            chat: ctx.chat,
                            sender: ctx.sender,
                            isGroup: ctx.isGroup,
                            pushName: ctx.pushName,
                            media: mediaPayload
                        }
                    );

                    if (!resposta) {
                        return ctx.reply(
                            `❌ Não consegui entender esse áudio agora.\n\n_Erro técnico: ${getUltimoErroGemini() || "desconhecido"}_`
                        );
                    }

                    textoParaFalar = resposta;

                } else {

                    // 2) Respondeu a um TEXTO -> lê esse texto
                    const quoted = getQuotedMessage(m);
                    const quotedUnwrapped = unwrapMessage(quoted);

                    if (quotedUnwrapped) {
                        textoParaFalar = extractText(quotedUnwrapped);
                    }
                }
            }

            if (!textoParaFalar) {
                return ctx.reply(
`🎙️ *FALAR*

Escreve um texto, ou responde (reply) a uma mensagem de texto, imagem ou áudio, e eu falo.

Exemplos:

${ctx.prefix}falar Olá, tudo bem?

_(respondendo a um texto)_ ${ctx.prefix}falar

_(respondendo a uma imagem)_ ${ctx.prefix}falar

_(respondendo a um áudio)_ ${ctx.prefix}falar`
                );
            }

            await ctx.reply(
                textoParaFalar.length > 900
                    ? "🎙️ *A gerar áudio longo...* pode demorar 1 a 2 minutos."
                    : "🎙️ *A gerar áudio...*"
            );

            const vozDoChat = db.getVoice(ctx.chat);

            const oggPath = await generateSpeech(textoParaFalar, vozDoChat);

            if (!oggPath) {
                return ctx.reply(
                    "❌ Não foi possível gerar o áudio."
                );
            }

            try {

                await sock.sendMessage(
                    ctx.chat,
                    {
                        audio: fs.readFileSync(oggPath),
                        mimetype: "audio/ogg; codecs=opus",
                        ptt: true
                    },
                    { quoted: m }
                );

            } finally {
                if (fs.existsSync(oggPath)) {
                    try { fs.unlinkSync(oggPath); } catch {}
                }
            }

        } catch (error) {

            console.error(
                "Erro no comando falar:",
                error?.message || error
            );

            return ctx.reply(
                `❌ ${error?.userMessage || "Ocorreu um erro ao gerar o áudio."}`
            );
        }
    }
};
