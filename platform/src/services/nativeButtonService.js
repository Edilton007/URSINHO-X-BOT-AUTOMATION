const {
    proto,
    generateWAMessageContent,
    generateWAMessageFromContent,
    isJidGroup
} = require("@whiskeysockets/baileys");

/*
============================================================
URSINHO X BOT V2
NATIVE BUTTON SERVICE
============================================================
*/

/*
============================================================
ENVIAR BOTÕES NATIVE FLOW
============================================================
*/

async function enviarComBotoes(
    sock,
    jid,
    quoted,
    texto,
    botoes = [],
    imagem = null
) {

    if (typeof texto !== "string") {
        texto = String(texto || "");
    }

    /*
    ========================================================
    BOTÕES
    ========================================================
    */

    const nativeFlowButtons = botoes.map((b) => {

        /*
        ----------------------------------------------------
        BOTÃO URL
        ----------------------------------------------------
        */

        if (b.tipo === "cta_url") {

            return proto.Message
                .InteractiveMessage
                .NativeFlowMessage
                .NativeFlowButton
                .create({
                    name: "cta_url",

                    buttonParamsJson: JSON.stringify({
                        display_text: b.texto,
                        url: b.url
                    })
                });
        }

        /*
        ----------------------------------------------------
        QUICK REPLY
        ----------------------------------------------------
        */

        return proto.Message
            .InteractiveMessage
            .NativeFlowMessage
            .NativeFlowButton
            .create({
                name: "quick_reply",

                buttonParamsJson: JSON.stringify({
                    display_text: b.texto,
                    id: b.id
                })
            });
    });

    /*
    ========================================================
    PREPARAR IMAGEM
    ========================================================
    */

    let imageMessage = null;

    if (imagem) {

        try {

            const mediaContent =
                await generateWAMessageContent(
                    {
                        image: imagem
                    },
                    {
                        upload: sock.waUploadToServer
                    }
                );

            imageMessage =
                mediaContent?.imageMessage || null;

        } catch (imageError) {

            console.error(
                "⚠️ Erro ao preparar imagem dos botões:",
                imageError?.message || imageError
            );
        }
    }

    /*
    ========================================================
    INTERACTIVE MESSAGE
    ========================================================
    */

    const interactive =
        proto.Message
            .InteractiveMessage
            .create({

                body:
                    proto.Message
                        .InteractiveMessage
                        .Body
                        .create({
                            text: texto
                        }),

                footer:
                    proto.Message
                        .InteractiveMessage
                        .Footer
                        .create({
                            text: "URSINHO X BOT V2"
                        }),

                ...(imageMessage
                    ? {
                        header:
                            proto.Message
                                .InteractiveMessage
                                .Header
                                .create({
                                    title: "",
                                    hasMediaAttachment: true,
                                    imageMessage
                                })
                    }
                    : {}),

                nativeFlowMessage:
                    proto.Message
                        .InteractiveMessage
                        .NativeFlowMessage
                        .create({

                            buttons: nativeFlowButtons,

                            messageVersion: 1
                        })
            });

    /*
    ========================================================
    GERAR MENSAGEM WHATSAPP
    ========================================================
    */

    const waMessage =
        generateWAMessageFromContent(
            jid,
            {
                interactiveMessage: interactive
            },
            {
                userJid: sock.user.id,
                quoted
            }
        );

    /*
    ========================================================
    ADDITIONAL NODES
    ========================================================
    */

    const additionalNodes = [

        {
            tag: "biz",

            attrs: {},

            content: [

                {
                    tag: "interactive",

                    attrs: {
                        type: "native_flow",
                        v: "1"
                    },

                    content: [

                        {
                            tag: "native_flow",

                            attrs: {
                                v: "9",
                                name: "mixed"
                            }
                        }
                    ]
                }
            ]
        }
    ];

    /*
    ========================================================
    BOT MESSAGE
    ========================================================
    */

    if (!isJidGroup(jid)) {

        additionalNodes.push({

            tag: "bot",

            attrs: {
                biz_bot: "1"
            }
        });
    }

    /*
    ========================================================
    ENVIAR
    ========================================================
    */

    await sock.relayMessage(
        jid,
        waMessage.message,
        {
            messageId: waMessage.key.id,
            additionalNodes
        }
    );

    return waMessage;
}


/*
============================================================
BOTÃO ON / OFF
============================================================

IMPORTANTE:
Não existe mais mensagem fixa de VENDAS.

A função usa exatamente o `texto` recebido pelo comando.

Assim funciona para:

!antistatus
!antilink
!antifoto
!antivideo
!antiaudio
!antisticker
!vendaia
!detector
etc.
============================================================
*/

async function enviarBotoesOnOff(
    sock,
    jid,
    quoted,
    {
        titulo = "CONFIGURAÇÃO",

        status = false,

        texto = "",

        prefix = "!",

        comando = ""
    } = {}
) {

    const acaoTexto =
        status
            ? "🔴 DESATIVAR"
            : "🟢 ATIVAR";

    const acaoId =
        status
            ? `${prefix}${comando} off`
            : `${prefix}${comando} on`;

    /*
    ========================================================
    TEXTO
    ========================================================

    Se o comando forneceu um texto personalizado,
    usamos esse texto.

    NÃO substituir pelo texto de vendas.
    ========================================================
    */

    let mensagem = String(texto || "").trim();

    /*
    --------------------------------------------------------
    FALLBACK
    --------------------------------------------------------

    Caso algum comando antigo não envie `texto`,
    ainda mostramos uma mensagem genérica correta.
    --------------------------------------------------------
    */

    if (!mensagem) {

        mensagem =
            `╭━━〔 ⚙️ ${titulo} 〕━━╮\n` +
            `┃ ⚡ Estado: ${status ? "🟢 ATIVADO" : "🔴 DESATIVADO"}\n` +
            `╰━━━━━━━━━━━━━━━━╯\n` +
            `🐻 URSINHO X BOT V2`;
    }

    /*
    ========================================================
    ENVIAR BOTÃO
    ========================================================
    */

    return await enviarComBotoes(
        sock,
        jid,
        quoted,
        mensagem,
        [
            {
                tipo: "quick_reply",

                texto: acaoTexto,

                id: acaoId
            }
        ]
    );
}


/*
============================================================
EXPORTS
============================================================
*/

module.exports = {
    enviarComBotoes,
    enviarBotoesOnOff
};
