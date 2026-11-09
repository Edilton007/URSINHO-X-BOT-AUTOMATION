const fs = require("fs");

const {
    proto,
    generateWAMessageContent,
    generateWAMessageFromContent,
    isJidGroup
} = require("@whiskeysockets/baileys");

const {
    resolveMenuMedia
} = require("./menuMedia");

const {
    sendCarousel
} = require("../lib/interactiveMenu");

/*
============================================================
ENVIO NORMAL DE MENU
============================================================
*/

async function sendMenuMedia(
    sock,
    jid,
    type,
    caption,
    options = {}
) {

    const media = resolveMenuMedia(type);

    if (!media) {

        return sock.sendMessage(
            jid,
            {
                text: caption
            },
            {
                quoted: options.quoted
            }
        );

    }

    const fileBuffer =
        fs.readFileSync(media.path);

    /*
    ============================================================
    VÍDEO
    ============================================================
    */

    if (media.kind === "video") {

        return sock.sendMessage(
            jid,
            {
                video: fileBuffer,
                caption: caption || "",
                gifPlayback: true
            },
            {
                quoted: options.quoted
            }
        );

    }

    /*
    ============================================================
    IMAGEM
    ============================================================
    */

    return sock.sendMessage(
        jid,
        {
            image: fileBuffer,
            caption: caption || ""
        },
        {
            quoted: options.quoted
        }
    );

}

/*
============================================================
MENU COM NATIVE FLOW
============================================================
*/

async function sendMenuNative(
    sock,
    jid,
    caption,
    buttons = [],
    options = {}
) {

    /*
    ============================================================
    HEADER
    ============================================================
    */

    let header = null;

    /*
    ============================================================
    MÍDIA INLINE NO NATIVE FLOW
    ============================================================
    */

    if (options.media) {

        const media =
            resolveMenuMedia(options.media);

        if (
            media &&
            media.kind === "video" &&
            fs.existsSync(media.path)
        ) {

            try {

                const videoBuffer =
                    fs.readFileSync(media.path);

                console.log(
                    `🎬 Native Flow "${options.media}" → preparando vídeo`
                );

                /*
                ----------------------------------------------------
                UPLOAD REAL DO BAILEYS
                ----------------------------------------------------
                */

                const mediaContent =
                    await generateWAMessageContent(
                        {
                            video: videoBuffer
                        },
                        {
                            upload:
                                sock.waUploadToServer
                        }
                    );

                const videoMessage =
                    mediaContent?.videoMessage;

                if (!videoMessage) {

                    throw new Error(
                        "Baileys não retornou videoMessage após o upload."
                    );

                }

                /*
                ----------------------------------------------------
                HEADER COM VÍDEO
                ----------------------------------------------------
                */

                header =
                    proto.Message
                        .InteractiveMessage
                        .Header
                        .create({

                            title:
                                options.mediaTitle || "",

                            subtitle:
                                options.mediaSubtitle || "",

                            hasMediaAttachment:
                                true,

                            videoMessage

                        });

                console.log(
                    `✅ Native Flow "${options.media}" → vídeo inline preparado`
                );

            } catch (error) {

                console.error(
                    `❌ Erro ao preparar vídeo inline "${options.media}":`,
                    error?.message || error
                );

                /*
                ----------------------------------------------------
                FALLBACK SEM MÍDIA
                ----------------------------------------------------
                */

                header =
                    proto.Message
                        .InteractiveMessage
                        .Header
                        .create({

                            title:
                                options.mediaTitle || "",

                            subtitle:
                                options.mediaSubtitle || "",

                            hasMediaAttachment:
                                false

                        });

            }

        } else {

            header =
                proto.Message
                    .InteractiveMessage
                    .Header
                    .create({

                        title:
                            options.mediaTitle || "",

                        subtitle:
                            options.mediaSubtitle || "",

                        hasMediaAttachment:
                            false

                    });

        }

    }

    /*
    ============================================================
    BOTÕES
    ============================================================
    */

    const buttonList =
        buttons.map((button) => {

            /*
            ========================================================
            CTA COPY
            ========================================================
            */

            if (button.tipo === "cta_copy") {

                return proto.Message
                    .InteractiveMessage
                    .NativeFlowMessage
                    .NativeFlowButton
                    .create({

                        name: "cta_copy",

                        buttonParamsJson:
                            JSON.stringify({

                                display_text:
                                    button.texto,

                                copy_code:
                                    button.codigo

                            })

                    });

            }

            /*
            ========================================================
            CTA URL
            ========================================================
            */

            if (button.tipo === "cta_url") {

                return proto.Message
                    .InteractiveMessage
                    .NativeFlowMessage
                    .NativeFlowButton
                    .create({

                        name: "cta_url",

                        buttonParamsJson:
                            JSON.stringify({

                                display_text:
                                    button.texto,

                                url:
                                    button.url

                            })

                    });

            }

            /*
            ========================================================
            QUICK REPLY
            ========================================================
            */

            return proto.Message
                .InteractiveMessage
                .NativeFlowMessage
                .NativeFlowButton
                .create({

                    name: "quick_reply",

                    buttonParamsJson:
                        JSON.stringify({

                            display_text:
                                button.texto,

                            id:
                                button.id

                        })

                });

        });

    /*
    ============================================================
    INTERACTIVE MESSAGE
    ============================================================
    */

    const messageData = {};

    /*
    ------------------------------------------------------------
    HEADER
    ------------------------------------------------------------
    */

    if (header) {

        messageData.header = header;

    }

    /*
    ------------------------------------------------------------
    BODY
    ------------------------------------------------------------
    */

    messageData.body =
        proto.Message
            .InteractiveMessage
            .Body
            .create({

                text:
                    caption || ""

            });

    /*
    ------------------------------------------------------------
    FOOTER
    ------------------------------------------------------------
    */

    messageData.footer =
        proto.Message
            .InteractiveMessage
            .Footer
            .create({

                text:
                    "🐻 URSINHO X BOT V2\nby Edilton Ronaldo"

            });

    /*
    ------------------------------------------------------------
    NATIVE FLOW
    ------------------------------------------------------------
    */

    messageData.nativeFlowMessage =
        proto.Message
            .InteractiveMessage
            .NativeFlowMessage
            .create({

                buttons:
                    buttonList,

                messageVersion:
                    1

            });

    /*
    ============================================================
    CREATE INTERACTIVE MESSAGE
    ============================================================
    */

    const interactive =
        proto.Message
            .InteractiveMessage
            .create(
                messageData
            );

    /*
    ============================================================
    GERA WA MESSAGE
    ============================================================
    */

    const waMessage =
        generateWAMessageFromContent(

            jid,

            {
                interactiveMessage:
                    interactive
            },

            {

                userJid:
                    sock.user.id,

                quoted:
                    options.quoted

            }

        );

    /*
    ============================================================
    NODES ADICIONAIS
    ============================================================
    */

    const additionalNodes = [

        {

            tag: "biz",

            attrs: {},

            content: [

                {

                    tag: "interactive",

                    attrs: {

                        type:
                            "native_flow",

                        v:
                            "1"

                    },

                    content: [

                        {

                            tag: "native_flow",

                            attrs: {

                                v:
                                    "9",

                                name:
                                    "mixed"

                            }

                        }

                    ]

                }

            ]

        }

    ];

    /*
    ============================================================
    BOT NODE PRIVADO
    ============================================================
    */

    if (!isJidGroup(jid)) {

        additionalNodes.push({

            tag: "bot",

            attrs: {

                biz_bot:
                    "1"

            }

        });

    }

    /*
    ============================================================
    ENVIO
    ============================================================
    */

    return sock.relayMessage(

        jid,

        waMessage.message,

        {

            messageId:
                waMessage.key.id,

            additionalNodes

        }

    );

}

/*
============================================================
MENU PREMIUM COM CARROSSEL
============================================================
*/

async function sendMenuCarousel(
    sock,
    jid,
    options = {}
) {

    const {

        text = "",

        footer =
            "🐻 URSINHO X BOT V2 • PREMIUM MZ",

        cards = [],

        quoted = null

    } = options;

    return await sendCarousel(

        sock,

        jid,

        {

            text,

            footer,

            cards

        },

        quoted

    );

}

/*
============================================================
EXPORTS
============================================================
*/

module.exports = {

    sendMenuMedia,

    sendMenuNative,

    sendMenuCarousel

};
