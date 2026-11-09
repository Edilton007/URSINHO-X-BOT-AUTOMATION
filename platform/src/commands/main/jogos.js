const { sendMenuNative } = require("../../services/mediaService");

module.exports = {

    name: "jogos",

    aliases: [
        "menujogo"
    ],

    category: "jogos",

    description: "Menu de jogos",

    run: async (sock, m, ctx) => {

        const texto = `
Escolha um jogo:

🎲 DADO
✊ PEDRA PAPEL TESOURA
❓ FORCA
🎯 JOGO DA VELHA
🔥 VERDADE OU DESAFIO
`;

        const buttons = [

            {
                texto: "🎲 DADO",
                id: `${ctx.prefix}dado`
            },

            {
                texto: "✊ PPT",
                id: `${ctx.prefix}ppt`
            },

            {
                texto: "❓ FORCA",
                id: `${ctx.prefix}forca`
            },

            {
                texto: "🎯 JOGO DA VELHA",
                id: `${ctx.prefix}jogodavelha`
            },

            {
                texto: "🔥 VERDADE OU DESAFIO",
                id: `${ctx.prefix}verdadeoudesafio`
            },

            {
                texto: "⬅️ VOLTAR",
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
                mediaTitle: "🎮 MENU JOGOS",
                mediaSubtitle: "Escolha sua diversão"
            }
        );
    }
};
