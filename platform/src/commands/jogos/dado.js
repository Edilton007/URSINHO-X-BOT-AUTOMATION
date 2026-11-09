const { sendMenuNative } = require("../../services/mediaService");

module.exports = {

    name: "dado",

    aliases: [
        "dice"
    ],

    category: "jogos",

    description: "Lançar um dado",

    run: async (sock, m, ctx) => {

        const numero = Math.floor(Math.random() * 6) + 1;

        const faces = {
            1: "⚀",
            2: "⚁",
            3: "⚂",
            4: "⚃",
            5: "⚄",
            6: "⚅"
        };

        const texto = `
🎲 𝐉𝐎𝐆𝐎 𝐃𝐎 𝐃𝐀𝐃𝐎

𝐋𝐚𝐧ç𝐚𝐧𝐝𝐨...

${faces[numero]}

𝐑𝐞𝐬𝐮𝐥𝐭𝐚𝐝𝐨:
🎲 𝐍ú𝐦𝐞𝐫𝐨 ${numero}

𝐁𝐨𝐚 𝐬𝐨𝐫𝐭𝐞 🍀
`;

        const buttons = [

            {
                texto: "🎲 JOGAR NOVAMENTE",
                id: `${ctx.prefix}dado`
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
                mediaTitle: "🎲 JOGO DO DADO",
                mediaSubtitle: "URSINHO X BOT V2"
            }
        );

    }

};
