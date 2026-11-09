const {
    sendMenuMedia,
    sendMenuNative
} = require("../../services/mediaService");

const {
    loadCommands
} = require("../../core/commandLoader");

const {
    buildAdminSubmenu
} = require("../../lib/adminSubmenuBuilder");

const {
    getGroup
} = require("../../services/groupService");

module.exports = {
    name: "menuadmin",

    aliases: [
        "madmin"
    ],

    category: "menus",

    description: "Menu premium dos administradores",

    run: async (sock, m, ctx) => {

        const data = loadCommands();

        /*
        ============================================================
        SUBMENUS ADMIN
        ============================================================
        */

        const tipo = String(ctx.args?.[0] || "")
            .trim()
            .toLowerCase();

        const tiposValidos = [
            "grupo",
            "protecao",
            "sistema"
        ];

        /*
        ============================================================
        SE FOR SUBMENU
        ============================================================
        */

        if (tiposValidos.includes(tipo)) {

            let group = null;

        if (ctx.isGroup) {
            group = getGroup(ctx.chat);

            try {
                const metadata = await sock.groupMetadata(ctx.chat);

                group = {
                    ...group,
                    id: ctx.chat,
                    groupId: ctx.chat,
                    announce: metadata?.announce === true
                };
            } catch (error) {
                console.error(
                    "⚠️ Não foi possível obter estado do grupo:",
                    error?.message || error
                );
            }
        }

        const submenu = buildAdminSubmenu(
                data.categories,
                tipo,
                ctx.prefix,
                group
            );

            try {

                await sendMenuNative(
                    sock,
                    ctx.chat,
                    submenu.texto,
                    submenu.buttons,
                    {
                        quoted: m,
                        media: "admin",
                        mediaTitle: "🛡️ ADMIN",
                        mediaSubtitle: "CONTROLE DO GRUPO"
                    }
                );

                console.log(
                    `✅ Submenu Admin Premium enviado: ${tipo}`
                );

            } catch (error) {

                console.error(
                    "❌ Erro no Submenu Admin Native Flow:",
                    error?.message || error
                );

                await sendMenuMedia(
                    sock,
                    ctx.chat,
                    "admin",
                    submenu.texto,
                    {
                        quoted: m,
                        media: "admin",
                        mediaTitle: "🛡️ ADMIN",
                        mediaSubtitle: "CONTROLE DO GRUPO"
                    }
                );
            }

            return;
        }

        /*
        ============================================================
        MENU ADMIN PRINCIPAL
        ============================================================
        */

        const menu = [
            "🛡️ 𝐌𝐄𝐍𝐔 𝐀𝐃𝐌𝐈𝐍",
            "",
            "⚡ 𝐏𝐀𝐈𝐍𝐄𝐋 𝐃𝐄 𝐂𝐎𝐍𝐓𝐑𝐎𝐋𝐄",
            "",
            "👥 𝐆𝐑𝐔𝐏𝐎",
            "🛡️ 𝐏𝐑𝐎𝐓𝐄ÇÕ𝐄𝐒",
            "⚙️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀"
        ].join("\n");

        /*
        ============================================================
        BOTÕES PRINCIPAIS
        ============================================================
        */

        const buttons = [

            {
                texto: "👥 GRUPO",
                id: `${ctx.prefix}menuadmin grupo`
            },

            {
                texto: "🛡️ PROTEÇÕES",
                id: `${ctx.prefix}menuadmin protecao`
            },

            {
                texto: "⚙️ SISTEMA",
                id: `${ctx.prefix}menuadmin sistema`
            },

            {
                texto: "🏠 MENU PRINCIPAL",
                id: `${ctx.prefix}menu`
            }

        ];

        /*
        ============================================================
        ENVIO NATIVE FLOW
        ============================================================
        */

        try {

            await sendMenuNative(
                sock,
                ctx.chat,
                menu,
                buttons,
                {
                    quoted: m,
                    media: "admin",
                    mediaTitle: "🛡️ ADMIN",
                    mediaSubtitle: "CONTROLE DO GRUPO"
                }
            );

            console.log(
                "✅ Menu Admin Premium enviado"
            );

        } catch (error) {

            console.error(
                "❌ Erro no Menu Admin Native Flow:",
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
                "admin",
                menu,
                {
                    quoted: m
                }
            );
        }
    }
};
