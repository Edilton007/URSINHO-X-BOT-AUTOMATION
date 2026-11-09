const {
    sendMenuMedia,
    sendMenuNative,
    sendMenuCarousel
} = require("../../services/mediaService");
const { temCanal, urlCanal } = require("../../services/channelService");

module.exports = {

    name: "menu",

    aliases: [
        "help",
        "ajuda"
    ],

    category: "info",

    description: "Abrir central principal do bot",

    run: async (sock, m, ctx) => {

        const prefix = ctx.prefix;

        /*
        ============================================================
        MENU PRINCIPAL PREMIUM
        ============================================================
        */

        const menu = `
╭━━━〔 🐻 URSINHO X BOT V2 〕━━━╮
┃
┃        ✨ PREMIUM MZ ✨
┃
┃ ⚡ Sistema: ONLINE
┃ 🧩 Módulos: ATIVOS
┃ 🛡️ Segurança: ATIVA
┃
┃ Explore a central do bot
┃ através dos cartões abaixo.
┃
╰━━━〔 PREMIUM SYSTEM 〕━━━
`;

        /*
        ============================================================
        CARDS PREMIUM
        ============================================================
        */

        const cards = [

            {
                title: "👑 DONO",
                mediaType: "owner",
                subtitle: "CENTRAL EXECUTIVA",
                text: "Painel exclusivo do proprietário do URSINHO X BOT V2.",
                footer: "👑 ACESSO DO PROPRIETÁRIO\nby Edilton Ronaldo",

                buttons: [
                    {
                        name: "quick_reply",
                        params: {
                            display_text: "👑 ABRIR DONO",
                            id: `${prefix}menudono`
                        }
                    }
                ]
            },

            {
                title: "🛡️ ADMIN",
                mediaType: "admin",
                subtitle: "CONTROLE DO GRUPO",
                text: "Ferramentas administrativas, proteção e gerenciamento.",
                footer: "🛡️ PAINEL ADMINISTRATIVO\nby Edilton Ronaldo",

                buttons: [
                    {
                        name: "quick_reply",
                        params: {
                            display_text: "🛡️ ABRIR ADMIN",
                            id: `${prefix}menuadmin`
                        }
                    }
                ]
            },

            {
                title: "💰 VENDAS",
                mediaType: "principal",
                subtitle: "CENTRAL COMERCIAL",
                text: "Gerencie vendas, clientes e recursos comerciais.",
                footer: "💰 SISTEMA DE VENDAS\nby Edilton Ronaldo",

                buttons: [
                    {
                        name: "quick_reply",
                        params: {
                            display_text: "💰 ABRIR VENDAS",
                            id: `${prefix}menuvendas`
                        }
                    }
                ]
            },

            {
                title: "🤖 INTELIGÊNCIA",
                mediaType: "ia",
                subtitle: "IA PREMIUM",
                text: "Converse, traduza, resuma, escreva e utilize as ferramentas de IA.",
                footer: "🧠 INTELIGÊNCIA ARTIFICIAL\nby Edilton Ronaldo",

                buttons: [
                    {
                        name: "quick_reply",
                        params: {
                            display_text: "🤖 ABRIR IA",
                            id: `${prefix}menuia`
                        }
                    }
                ]
            },

            {
                title: "📥 DOWNLOADS",
                mediaType: "downloads",
                subtitle: "MEDIA CENTER",
                text: "Música, vídeos e conteúdos através dos módulos de download.",
                footer: "📥 CENTRAL DE DOWNLOADS\nby Edilton Ronaldo",

                buttons: [
                    {
                        name: "quick_reply",
                        params: {
                            display_text: "📥 DOWNLOADS",
                            id: `${prefix}menudownload`
                        }
                    }
                ]
            },

            {
                title: "🎮 JOGOS",
                mediaType: "principal",
                subtitle: "ENTRETENIMENTO",
                text: "Central de jogos e entretenimento do URSINHO X BOT.",
                footer: "🎮 CENTRAL DE JOGOS\nby Edilton Ronaldo",

                buttons: [
                    {
                        name: "quick_reply",
                        params: {
                            display_text: "🎮 ABRIR JOGOS",
                            id: `${prefix}menujogos`
                        }
                    }
                ]
            },

            {
                title: "🔐 SEGURANÇA",
                mediaType: "seguranca",
                subtitle: "CENTRAL DE PROTEÇÃO",
                text: "Recursos de segurança e proteção do seu grupo.",
                footer: "🔐 SISTEMA DE SEGURANÇA\nby Edilton Ronaldo",

                buttons: [
                    {
                        name: "quick_reply",
                        params: {
                            display_text: "🔐 SEGURANÇA",
                            id: `${prefix}menuseguranca`
                        }
                    }
                ]
            },

            /*
            ============================================================
            ⚡ SISTEMA
            ============================================================
            */

            {
                title: "⚡ SISTEMA",
                mediaType: "principal",
                subtitle: "STATUS DO BOT",
                text: "Verifique rapidamente o estado, velocidade e monitoramento do sistema.",
                footer: "⚡ STATUS DO SISTEMA\nby Edilton Ronaldo",

                buttons: [
                    {
                        name: "quick_reply",
                        params: {
                            display_text: "⚡ TESTAR PING",
                            id: `${prefix}ping`
                        }
                    },
                    {
                        name: "quick_reply",
                        params: {
                            display_text: "🕵️ X9",
                            id: `${prefix}x9`
                        }
                    },
                    {
                        name: "quick_reply",
                        params: {
                            display_text: "📖 TODOS OS COMANDOS",
                            id: `${prefix}comandos`
                        }
                    }
                ]
            }

        ];

        /*
        ============================================================
        📢 BOTÃO DO CANAL — dentro do cartão DONO, logo abaixo de
        "ABRIR DONO" (primeiro cartão, sempre visível)
        ============================================================
        */

        if (temCanal()) {

            cards[0].buttons.push({
                name: "cta_url",
                params: {
                    display_text: "📢 SEGUIR O NOSSO CANAL",
                    url: urlCanal(),
                    merchant_url: urlCanal()
                }
            });
        }

        /*
        ============================================================
        ENVIO CARROSSEL PREMIUM
        ============================================================
        */

        try {

            await sendMenuCarousel(
                sock,
                ctx.chat,
                {
                    text: menu,
                    footer: "🐻 URSINHO X BOT V2\nby Edilton Ronaldo",
                    cards,
                    quoted: m
                }
            );

            console.log(
                `✅ Menu Principal CAROUSEL enviado | Cards: ${cards.length}`
            );

            return;

        } catch (error) {

            console.error(
                "❌ Erro no Menu Principal Carousel:",
                error?.message || error
            );

        }

        /*
        ============================================================
        FALLBACK NATIVE FLOW
        ============================================================
        */

        const buttons = [

            {
                texto: "👑 DONO",
                id: `${prefix}menudono`
            },

            {
                texto: "🛡️ ADMIN",
                id: `${prefix}menuadmin`
            },

            {
                texto: "💰 VENDAS",
                id: `${prefix}menuvendas`
            },

            {
                texto: "🤖 IA",
                id: `${prefix}menuia`
            },

            {
                texto: "📥 DOWNLOADS",
                id: `${prefix}menudownload`
            },

            {
                texto: "🎮 JOGOS",
                id: `${prefix}menujogos`
            },

            {
                texto: "🔐 SEGURANÇA",
                id: `${prefix}menuseguranca`
            },

            {
                texto: "⚡ PING",
                id: `${prefix}ping`
            },

            {
                texto: "🕵️ X9",
                id: `${prefix}x9`
            }

        ];

        if (temCanal()) {
            buttons.push({
                tipo: "cta_url",
                texto: "📢 SEGUIR O NOSSO CANAL",
                url: urlCanal()
            });
        }

        try {

            await sendMenuNative(
                sock,
                ctx.chat,
                menu,
                buttons,
                {
                    quoted: m
                }
            );

            console.log(
                "✅ Menu Principal Native Flow enviado como fallback"
            );

            return;

        } catch (error) {

            console.error(
                "❌ Erro no Menu Principal Native Flow:",
                error?.message || error
            );

        }

        /*
        ============================================================
        ÚLTIMO FALLBACK — MÍDIA
        ============================================================
        */

        try {

            await sendMenuMedia(
                sock,
                ctx.chat,
                "principal",
                menu,
                {
                    quoted: m
                }
            );

            console.log(
                "✅ Menu Principal Media enviado como fallback final"
            );

        } catch (error) {

            console.error(
                "❌ Erro no fallback final do Menu Principal:",
                error?.message || error
            );

            await sock.sendMessage(
                ctx.chat,
                {
                    text: menu
                },
                {
                    quoted: m
                }
            );

        }

    }

};
