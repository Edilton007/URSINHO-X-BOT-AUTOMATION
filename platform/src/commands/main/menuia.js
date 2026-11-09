const {
    sendMenuMedia,
    sendMenuNative
} = require("../../services/mediaService");

const {
    buildIAMenu
} = require("../../lib/iaMenuBuilder");

const {
    loadCommands
} = require("../../core/commandLoader");

module.exports = {

    name: "menuia",

    aliases: [
        "mia"
    ],

    category: "menus",

    description: "Menu de inteligência artificial",

    run: async (sock, m, ctx) => {

        const data = loadCommands();

        const menu = buildIAMenu(
            ctx.prefix,
            data.categories
        );

        /*
        ============================================================
        ENVIO NATIVE FLOW
        ============================================================
        */

        try {

            await sendMenuNative(
                sock,
                ctx.chat,
                menu.texto,
                menu.buttons,
                {
                    quoted: m,
                    media: "ia",
                    mediaTitle: "🤖 IA",
                    mediaSubtitle: "INTELIGÊNCIA ARTIFICIAL"
                }
            );

            console.log(
                "✅ Menu IA Native Flow enviado"
            );

        } catch (error) {

            console.error(
                "❌ Erro no Menu IA Native Flow:",
                error?.message || error
            );

            /*
            ========================================================
            FALLBACK
            ========================================================
            */

            await sendMenuMedia(
                sock,
                ctx.chat,
                "ia",
                menu.texto,
                {
                    quoted: m
                }
            );

        }

    }

};
