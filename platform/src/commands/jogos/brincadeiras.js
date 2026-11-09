const { sendMenuNative } = require("../../services/mediaService");

module.exports = {

    name: "brincadeiras",

    aliases: [
        "brincadeira"
    ],

    category: "jogos",

    description: "Menu de brincadeiras",

    run: async (sock, m, ctx) => {

        const texto = `
Escolha uma brincadeira:

❤️ CANTADAS
💋 BEIJAR
🤗 ABRAÇAR
🔥 VERDADE OU DESAFIO
`;

        const buttons = [

            {
                texto: "❤️ CANTADAS",
                id: `${ctx.prefix}cantada`
            },

            {
                texto: "💋 BEIJAR",
                id: `${ctx.prefix}beijar`
            },

            {
                texto: "🤗 ABRAÇAR",
                id: `${ctx.prefix}abracar`
            },

            {
                texto: "🔥 VERDADE/DESAFIO",
                id: `${ctx.prefix}verdadeoudesafio`
            },

            {
                texto: "⬅️ VOLTAR JOGOS",
                id: `${ctx.prefix}menujogos`
            },

            {
                texto: "🏠 MENU PRINCIPAL",
                id: `${ctx.prefix}menu`
            }

        ];

        return sendMenuNative(
            sock,
            ctx.chat,
            texto,
            buttons,
            {
                quoted: m,
                media: "principal",
                mediaTitle: "😂 BRINCADEIRAS",
                mediaSubtitle: "Escolha uma diversão"
            }
        );
    }
};
