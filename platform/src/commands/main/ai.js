const { askAI } = require("../../services/aiService");

module.exports = {

    name: "ai",
    aliases: ["ia"],
    category: "ia",
iaGroup: "inteligencia",
    description: "Conversar com a inteligência artificial",

    run: async (sock, m, ctx) => {

        const prompt =
            ctx.args.join(" ").trim();

        if (!prompt) {

            return ctx.reply(
`🤖 *URSINHO IA*

Escreve uma pergunta para a IA.

Exemplo:
${ctx.prefix}ai Olá, quem és tu?`
            );

        }

        const resposta =
            await askAI(
                prompt,
                {
                    chat: ctx.chat,
                    sender: ctx.sender,
                    isGroup: ctx.isGroup
                }
            );

        return ctx.reply(
            `🤖 *URSINHO IA*\n\n${resposta}`
        );
    }
};
