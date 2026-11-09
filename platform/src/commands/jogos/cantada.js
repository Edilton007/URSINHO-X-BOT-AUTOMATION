const { sendMenuNative } = require("../../services/mediaService");
const cantadas = require("../../database/cantadas.json");

module.exports = {
    name: "cantada",

    aliases: [
        "cantadas",
        "cantadao"
    ],

    category: "jogos",

    description: "Envia uma cantada aleatória",

    run: async (sock, m, ctx) => {

        const cantada =
            cantadas[
                Math.floor(Math.random() * cantadas.length)
            ];

        const texto = `
❤️ 𝐂𝐀𝐍𝐓𝐀𝐃𝐀

${cantada}
`;

        const buttons = [
            {
                texto: "❤️ OUTRA CANTADA",
                id: `${ctx.prefix}cantada`
            },
            {
                texto: "🎮 MENU JOGOS",
                id: `${ctx.prefix}menujogos`
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
                mediaTitle: "❤️ CANTADA",
                mediaSubtitle: "URSINHO X BOT V2"
            }
        );

    }
};
