const {
    sendMenuMedia,
    sendMenuNative
} = require("../../services/mediaService");

const {
    buildSecurityMenu,
    buildSecuritySubmenu
} = require("../../lib/securityMenuBuilder");

const {
    getGroup
} = require("../../services/groupService");

module.exports = {

    name: "menuseguranca",

    aliases: [
        "mseguranca"
    ],

    category: "seguranca",

    description: "Central premium de segurança",

    run: async (sock, m, ctx) => {

        try {

            const tipo =
                String(ctx.args?.[0] || "")
                    .trim()
                    .toLowerCase();

            const tiposValidos = [
                "protecoes",
                "entrada",
                "pagamentos",
                "status"
            ];

            const group =
                ctx.isGroup
                    ? getGroup(ctx.chat)
                    : {};

            /*
            ========================================================
            SUBMENU DE SEGURANÇA
            ========================================================
            */

            if (tiposValidos.includes(tipo)) {

                const submenu =
                    buildSecuritySubmenu(
                        ctx.prefix,
                        {
                            ...group,
                            id: ctx.chat
                        },
                        tipo
                    );

                try {

                    await sendMenuNative(
                        sock,
                        ctx.chat,
                        submenu.texto,
                        submenu.buttons,
                        {
                            quoted: m,
                            media: "seguranca",
                            mediaTitle: "🔐 SEGURANÇA",
                            mediaSubtitle: "CENTRAL DE PROTEÇÃO"
                        }
                    );

                    console.log(
                        `✅ Submenu Segurança Premium enviado: ${tipo}`
                    );

                } catch (error) {

                    console.error(
                        "❌ Erro no Submenu Segurança Native Flow:",
                        error?.message || error
                    );

                    await sendMenuMedia(
                        sock,
                        ctx.chat,
                        "seguranca",
                        submenu.texto,
                        {
                            quoted: m,
                            media: "seguranca",
                            mediaTitle: "🔐 SEGURANÇA",
                            mediaSubtitle: "CENTRAL DE PROTEÇÃO"
                        }
                    );
                }

                return;
            }

            /*
            ========================================================
            MENU PRINCIPAL DE SEGURANÇA
            ========================================================
            */

            const menu =
                buildSecurityMenu(
                    ctx.prefix,
                    {
                        ...group,
                        id: ctx.chat
                    }
                );

            try {

                await sendMenuNative(
                    sock,
                    ctx.chat,
                    menu.texto,
                    menu.buttons,
                    {
                        quoted: m,
                        media: "seguranca",
                        mediaTitle: "🔐 SEGURANÇA",
                        mediaSubtitle: "CENTRAL DE PROTEÇÃO"
                    }
                );

                console.log(
                    "✅ Menu Segurança Premium enviado"
                );

            } catch (error) {

                console.error(
                    "❌ Erro no Menu Segurança Native Flow:",
                    error?.message || error
                );

                await sendMenuMedia(
                    sock,
                    ctx.chat,
                    "seguranca",
                    menu.texto,
                    {
                        quoted: m
                    }
                );
            }

        } catch (error) {

            console.error(
                "❌ Erro no Menu Segurança:",
                error?.message || error
            );

            return ctx.reply(
`╔══════════════════════════╗
║   ❌ SEGURANÇA           ║
╚══════════════════════════╝

Não foi possível abrir o
painel de segurança.

⚠️ ${error?.message || "Erro desconhecido"}

🐻 URSINHO X BOT V2`
            );
        }

    }

};
