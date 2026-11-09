const {
    sendMenuNative,
    sendMenuMedia
} = require("../../services/mediaService");

const {
    isVendaIAEnabled
} = require("../../services/salesService");

module.exports = {

    name: "menuvendaia",

    aliases: [
        "mvendaia"
    ],

    category: "menus",

    description: "Painel da VENDAIA",

    run: async (
        sock,
        m,
        ctx
    ) => {

        try {

            /*
            ========================================================
            STATUS REAL DA VENDAIA
            ========================================================
            */

            const status =
                isVendaIAEnabled(ctx.chat);


            /*
            ========================================================
            PAINEL PREMIUM
            ========================================================
            */

            const menu = [
                "🤖 𝐕𝐄𝐍𝐃𝐀𝐈𝐀",
                "",
                "⚡ 𝐈𝐍𝐓𝐄𝐋𝐈𝐆Ê𝐍𝐂𝐈𝐀 𝐃𝐄 𝐕𝐄𝐍𝐃𝐀𝐒",
                "",
                `🧠 ${status ? "🟢 ONLINE" : "🔴 OFFLINE"}`
            ].join("\n");


            /*
            ========================================================
            BOTÃO INTELIGENTE
            ========================================================
            */

            const buttons = [

                {
                    texto: status
                        ? "🔴 DESATIVAR VENDAIA"
                        : "🟢 ATIVAR VENDAIA",

                    id: `${ctx.prefix}vendaia ${status ? "off" : "on"}`
                },

                {
                    texto: "⬅️ VENDAS",
                    id: `${ctx.prefix}menuvendas`
                },

                {
                    texto: "🏠 MENU PRINCIPAL",
                    id: `${ctx.prefix}menu`
                }

            ];


            /*
            ========================================================
            NATIVE FLOW
            ========================================================
            */

            try {

                await sendMenuNative(
                    sock,
                    ctx.chat,
                    menu,
                    buttons,
                    {
                        quoted: m,
                        media: "principal",
                        mediaTitle: "🤖 VENDAIA",
                        mediaSubtitle: "INTELIGÊNCIA DE VENDAS"
                    }
                );

                console.log(
                    `✅ Painel VENDAIA Premium enviado — ${
                        status ? "ONLINE" : "OFFLINE"
                    }`
                );

            } catch (error) {

                console.error(
                    "❌ Erro Native Flow VENDAIA:",
                    error?.message || error
                );


                /*
                ====================================================
                FALLBACK
                ====================================================
                */

                await sendMenuMedia(
                    sock,
                    ctx.chat,
                    "principal",
                    menu,
                    {
                        quoted: m
                    }
                );

            }

        } catch (error) {

            console.error(
                "❌ Erro no menu VENDAIA:",
                error
            );

            return ctx.reply(
                "❌ Não foi possível abrir o painel da VENDAIA."
            );

        }

    }

};
