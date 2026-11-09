const {
    sendMenuMedia,
    sendMenuNative
} = require("../../services/mediaService");

const {
    buildVendasMenu,
    buildVendasSubmenu
} = require("../../lib/vendasMenuBuilder");

const {
    loadCommands
} = require("../../core/commandLoader");

module.exports = {
    name: "menuvendas",

    aliases: [
        "mvendas"
    ],

    category: "menus",

    description: "Central premium de vendas e VENDAIA",

    run: async (sock, m, ctx) => {
        try {
            const data = loadCommands();

            const tipo = String(ctx.args?.[0] || "")
                .trim()
                .toLowerCase();

            /*
            ============================================================
            SUBMENUS DE VENDAS
            ============================================================
            */

            const tiposValidos = [
                "vendas",
                "pagamentos",
                "tabela"
            ];

            if (tiposValidos.includes(tipo)) {
                const submenu = buildVendasSubmenu(
                    ctx.prefix,
                    data.categories,
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
                            media: "principal",
                            mediaTitle: "💰 VENDAS",
                            mediaSubtitle: "CENTRAL COMERCIAL"
                        }
                    );

                    console.log(
                        `✅ Submenu Vendas Premium enviado: ${tipo}`
                    );

                } catch (error) {

                    console.error(
                        "❌ Erro no Submenu Vendas Native Flow:",
                        error?.message || error
                    );

                    await sendMenuMedia(
                        sock,
                        ctx.chat,
                        "principal",
                        submenu.texto,
                        {
                            quoted: m
                        }
                    );
                }

                return;
            }

            /*
            ============================================================
            MENU PRINCIPAL DE VENDAS
            ============================================================
            */

            const menu = buildVendasMenu(
                ctx.prefix,
                data.categories
            );

            /*
            ============================================================
            BOTÕES PRINCIPAIS
            ============================================================
            */

            const buttons = [
                {
                    texto: "🛒 VENDAS",
                    id: `${ctx.prefix}menuvendas vendas`
                },

                {
                    texto: "💳 PAGAMENTOS",
                    id: `${ctx.prefix}menuvendas pagamentos`
                },

                {
                    texto: "📊 TABELA",
                    id: `${ctx.prefix}menuvendas tabela`
                },

                {
                    texto: "🤖 VENDAIA",
                    id: `${ctx.prefix}menuvendaia`
                },

                {
                    texto: "🏠 MENU PRINCIPAL",
                    id: `${ctx.prefix}menu`
                }
            ];

            /*
            ============================================================
            NATIVE FLOW
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
                        media: "principal",
                        mediaTitle: "💰 VENDAS",
                        mediaSubtitle: "CENTRAL COMERCIAL"
                    }
                );

                console.log(
                    "✅ Menu Vendas/VENDAIA Premium enviado"
                );

            } catch (error) {

                console.error(
                    "❌ Erro no Menu Vendas Native Flow:",
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
                    "principal",
                    menu,
                    {
                        quoted: m
                    }
                );
            }

        } catch (error) {

            console.error(
                "❌ Erro no Menu Vendas/VENDAIA:",
                error
            );

            return ctx.reply(
                "❌ Não foi possível abrir o menu de vendas."
            );
        }
    }
};
