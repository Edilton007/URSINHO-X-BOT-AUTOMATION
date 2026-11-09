const {
    isDetectorEnabled
} = require("../services/salesService");


/*
============================================================
URSINHO X BOT V2
SECURITY MENU BUILDER
Design Premium
============================================================
*/


/*
============================================================
MENU PRINCIPAL DE SEGURANÇA
============================================================
*/

function buildSecurityMenu(prefix, group = {}) {

    const texto = [
        "🔐 𝐒𝐄𝐆𝐔𝐑𝐀𝐍Ç𝐀",
        "🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕𝟐",
        "",
        "𝐂𝐄𝐍𝐓𝐑𝐀𝐋 𝐃𝐄 𝐏𝐑𝐎𝐓𝐄ÇÃ𝐎",
        "Gestão inteligente da segurança",
        "do seu grupo.",
        "",
        "━━━━━━━━━━━━━━━━━━━━"
    ].join("\n");


    const buttons = [

        {
            texto: "🛡️ PROTEÇÕES",
            id: `${prefix}menuseguranca protecoes`
        },

        {
            texto: "👋 ENTRADA & SAÍDA",
            id: `${prefix}menuseguranca entrada`
        },

        {
            texto: "💳 PAGAMENTOS",
            id: `${prefix}menuseguranca pagamentos`
        },

        {
            texto: "📊 STATUS",
            id: `${prefix}menuseguranca status`
        },

        {
            texto: "🏠 MENU PRINCIPAL",
            id: `${prefix}menu`
        }

    ];


    return {
        texto,
        buttons
    };
}


/*
============================================================
SUBMENUS
============================================================
*/

function buildSecuritySubmenu(
    prefix,
    group = {},
    tipo
) {

    const anti = group?.anti || {};


    /*
    ========================================================
    PROTEÇÕES
    ========================================================
    */

    if (tipo === "protecoes") {

        const protecoes = [

            {
                comando: "antiflood",
                chave: "flood",
                nome: "ANTI-FLOOD"
            },

            {
                comando: "antilink",
                chave: "link",
                nome: "ANTI-LINK"
            },

            {
                comando: "antifoto",
                chave: "image",
                nome: "ANTI-FOTO"
            },

            {
                comando: "antivideo",
                chave: "video",
                nome: "ANTI-VÍDEO"
            },

            {
                comando: "antiaudio",
                chave: "audio",
                nome: "ANTI-ÁUDIO"
            },

            {
                comando: "antisticker",
                chave: "sticker",
                nome: "ANTI-STICKER"
            },

            /*
            ====================================================
            NOVA PROTEÇÃO
            ANTI-STATUS
            ====================================================
            */

            {
                comando: "antistatus",
                chave: "status",
                nome: "ANTI-STATUS"
            }

        ];


        const buttons = [];


        for (const item of protecoes) {

            const ativo =
                anti[item.chave] === true;


            buttons.push({

                texto: ativo
                    ? `🔴 DESATIVAR ${item.nome}`
                    : `🟢 ATIVAR ${item.nome}`,

                id:
                    `${prefix}${item.comando} ${ativo ? "off" : "on"}`

            });

        }


        buttons.push({

            texto: "⬅️ SEGURANÇA",

            id:
                `${prefix}menuseguranca`

        });


        buttons.push({

            texto: "🏠 MENU PRINCIPAL",

            id:
                `${prefix}menu`

        });


        const texto = [

            "🛡️ 𝐏𝐑𝐎𝐓𝐄ÇÕ𝐄𝐒",

            "Controle inteligente das proteções",

            "do seu grupo.",

            "",

            "━━━━━━━━━━━━━━━━━━━━"

        ].join("\n");


        return {
            texto,
            buttons
        };

    }


    /*
    ========================================================
    ENTRADA & SAÍDA
    ========================================================
    */

    if (tipo === "entrada") {

        const bemvindo =
            group?.bemvindo?.enabled === true;


        const saida =
            group?.saida?.enabled === true;


        const buttons = [

            {
                texto:
                    bemvindo
                        ? "🔴 DESATIVAR BOAS-VINDAS"
                        : "🟢 ATIVAR BOAS-VINDAS",

                id:
                    `${prefix}bemvindo ${bemvindo ? "off" : "on"}`
            },

            {
                texto:
                    "✏️ CONFIGURAR BOAS-VINDAS",

                id:
                    `${prefix}bemvindo mensagem`
            },

            {
                texto:
                    saida
                        ? "🔴 DESATIVAR SAÍDA"
                        : "🟢 ATIVAR SAÍDA",

                id:
                    `${prefix}saida ${saida ? "off" : "on"}`
            },

            {
                texto:
                    "✏️ CONFIGURAR SAÍDA",

                id:
                    `${prefix}saida mensagem`
            },

            {
                texto:
                    "⬅️ SEGURANÇA",

                id:
                    `${prefix}menuseguranca`
            },

            {
                texto:
                    "🏠 MENU PRINCIPAL",

                id:
                    `${prefix}menu`
            }

        ];


        const texto = [

            "👋 𝐄𝐍𝐓𝐑𝐀𝐃𝐀 & 𝐒𝐀Í𝐃𝐀",

            "Gestão automática de membros",

            "do seu grupo.",

            "",

            "━━━━━━━━━━━━━━━━━━━━"

        ].join("\n");


        return {
            texto,
            buttons
        };

    }


    /*
    ========================================================
    PAGAMENTOS
    ========================================================
    */

    if (tipo === "pagamentos") {

        const detector =
            group?.id
                ? isDetectorEnabled(group.id)
                : false;


        const buttons = [

            {
                texto:
                    detector
                        ? "🔴 DESATIVAR DETECTOR"
                        : "🟢 ATIVAR DETECTOR",

                id:
                    `${prefix}detector ${detector ? "off" : "on"}`
            },

            {
                texto:
                    "🔎 ABRIR DETECTOR",

                id:
                    `${prefix}detector`
            },

            {
                texto:
                    "⬅️ SEGURANÇA",

                id:
                    `${prefix}menuseguranca`
            },

            {
                texto:
                    "🏠 MENU PRINCIPAL",

                id:
                    `${prefix}menu`
            }

        ];


        const texto = [

            "💳 𝐏𝐀𝐆𝐀𝐌𝐄𝐍𝐓𝐎𝐒",

            "Detecção inteligente de comprovativos",

            "M-Pesa e eMola.",

            "",

            "━━━━━━━━━━━━━━━━━━━━"

        ].join("\n");


        return {
            texto,
            buttons
        };

    }


    /*
    ========================================================
    STATUS
    ========================================================
    */

    if (tipo === "status") {

        const detector =
            group?.id
                ? isDetectorEnabled(group.id)
                : false;


        const estados = [

            `🌊 Anti-Flood     ${anti.flood ? "🟢" : "🔴"}`,

            `🔗 Anti-Link      ${anti.link ? "🟢" : "🔴"}`,

            `🖼️ Anti-Foto      ${anti.image ? "🟢" : "🔴"}`,

            `🎥 Anti-Vídeo     ${anti.video ? "🟢" : "🔴"}`,

            `🔊 Anti-Áudio     ${anti.audio ? "🟢" : "🔴"}`,

            `🏷️ Anti-Sticker   ${anti.sticker ? "🟢" : "🔴"}`,

            `📢 Anti-Status    ${anti.status ? "🟢" : "🔴"}`,

            `👋 Boas-vindas    ${
                group?.bemvindo?.enabled
                    ? "🟢"
                    : "🔴"
            }`,

            `🚪 Saída          ${
                group?.saida?.enabled
                    ? "🟢"
                    : "🔴"
            }`,

            `🔎 Detector       ${
                detector
                    ? "🟢"
                    : "🔴"
            }`

        ];


        const texto = [

            "📊 𝐒𝐓𝐀𝐓𝐔𝐒 𝐃𝐄 𝐒𝐄𝐆𝐔𝐑𝐀𝐍Ç𝐀",

            "Estado atual dos sistemas.",

            "",

            ...estados,

            "",

            "━━━━━━━━━━━━━━━━━━━━",

            "🐻 𝐔𝐑𝐒𝐈𝐍𝐇𝐎 𝐗 𝐁𝐎𝐓 𝐕𝟐"

        ].join("\n");


        return {

            texto,

            buttons: [

                {
                    texto:
                        "🔄 ATUALIZAR",

                    id:
                        `${prefix}menuseguranca status`
                },

                {
                    texto:
                        "⬅️ SEGURANÇA",

                    id:
                        `${prefix}menuseguranca`
                },

                {
                    texto:
                        "🏠 MENU PRINCIPAL",

                    id:
                        `${prefix}menu`
                }

            ]

        };

    }


    /*
    ========================================================
    FALLBACK
    ========================================================
    */

    return buildSecurityMenu(
        prefix,
        group
    );

}


/*
============================================================
EXPORTS
============================================================
*/

module.exports = {

    buildSecurityMenu,

    buildSecuritySubmenu

};
