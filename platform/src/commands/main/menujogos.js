const { sendMenuNative } = require("../../services/mediaService");

module.exports = {
    name: "menujogos",
    aliases: ["mjogos"],
    category: "jogos",
    description: "Menu de jogos e brincadeiras",

    run: async (sock, m, ctx) => {

        const texto = `
🎮 𝐉𝐎𝐆𝐎𝐒 𝐄 𝐁𝐑𝐈𝐍𝐂𝐀𝐃𝐄𝐈𝐑𝐀𝐒

Escolha uma categoria:

🎮 JOGOS
😂 BRINCADEIRAS
🏆 RANKING
`;

        const buttons = [

            {
                texto: "🎮 JOGOS",
                id: `${ctx.prefix}jogos`
            },

            {
                texto: "😂 BRINCADEIRAS",
                id: `${ctx.prefix}brincadeiras`
            },

            {
                texto: "🏆 RANKING",
                id: `${ctx.prefix}ranking`
            },

            {
                texto: "⬅️ VOLTAR",
                id: `${ctx.prefix}menu`
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
                mediaTitle: "🎮 JOGOS",
                mediaSubtitle: "ENTRETENIMENTO"
            }
        );
    }
};
