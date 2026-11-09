const { sendMenuMedia } = require("../../services/mediaService");

module.exports = {
    name: "menudownload",
    aliases: ["mdownload"],
    category: "downloads",
    description: "Menu de downloads",

    run: async (sock, m, ctx) => {

        const menu = `📥 𝐌𝐄𝐍𝐔 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐒

𝐌𝐄𝐃𝐈𝐀 𝐂𝐄𝐍𝐓𝐄𝐑

🎵 ${ctx.prefix}play
🎬 ${ctx.prefix}ytmp4
🎧 ${ctx.prefix}ytmp3
📱 ${ctx.prefix}tiktok
📘 ${ctx.prefix}fb
`;

        return sendMenuMedia(
            sock,
            ctx.chat,
            "downloads",
            menu,
            {
                quoted: m
            }
        );

    }
};
