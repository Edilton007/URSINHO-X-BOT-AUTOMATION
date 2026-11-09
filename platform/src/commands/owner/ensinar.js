const { teach } = require("../../services/aiService");

module.exports = {

    name: "ensinar",
    category: "owner",
    permission: "owner",
    description: "Ensinar uma resposta à IA",

    run: async (sock, m, ctx) => {

        const owner =
            ctx.permission === "owner";

        if (!owner) {
            return ctx.reply(
                "❌ Apenas o dono pode ensinar a IA."
            );
        }

        const texto =
            ctx.args.join(" ").trim();

        if (!texto.includes("=")) {

            return ctx.reply(
`🤖 *ENSINAR IA*

Formato:
${ctx.prefix}ensinar pergunta = resposta

Exemplo:
${ctx.prefix}ensinar quem és = Sou o URSINHO X BOT V2 🤖`
            );

        }

        const partes =
            texto.split("=");

        const pergunta =
            partes.shift().trim();

        const resposta =
            partes.join("=").trim();

        if (!pergunta || !resposta) {

            return ctx.reply(
                "❌ A pergunta e a resposta são obrigatórias."
            );

        }

        const sucesso =
            teach(
                pergunta,
                resposta
            );

        if (!sucesso) {

            return ctx.reply(
                "❌ Não foi possível guardar o ensinamento."
            );

        }

        return ctx.reply(
`✅ *IA ENSINADA*

❓ Pergunta:
${pergunta}

💡 Resposta:
${resposta}

🐻 URSINHO X BOT V2`
        );
    }
};
