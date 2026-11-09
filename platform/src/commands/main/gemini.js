const { askGemini } = require("../../services/geminiService");

module.exports = {
    name: "gemini",

    aliases: [
        "googleai"
    ],

    category: "ia",
    iaGroup: "inteligencia",

    description: "Conversar diretamente com o Gemini",

    run: async (sock, m, ctx) => {

        const pedido = ctx.args.join(" ").trim();

        if (!pedido) {
            return ctx.reply(
`🤖 *GEMINI*

Escreve o que queres perguntar ao Gemini.

Exemplos:

${ctx.prefix}gemini explica como funciona a inteligência artificial

${ctx.prefix}gemini cria uma mensagem para divulgar internet Vodacom

${ctx.prefix}gemini qual é a capital de Moçambique`
            );
        }

        await ctx.reply("🤖 *Gemini está a pensar...*");

        try {

            const resposta = await askGemini(
                pedido,
                {
                    chat: ctx.chat,
                    sender: ctx.sender,
                    isGroup: ctx.isGroup,
                    pushName: ctx.pushName
                }
            );

            return ctx.reply(
                `🤖 *GEMINI*\n\n${resposta}`
            );

        } catch (error) {

            console.error(
                "Erro no comando Gemini:",
                error?.message || error
            );

            return ctx.reply(
                "❌ Ocorreu um erro ao comunicar com o Gemini."
            );
        }
    }
};
