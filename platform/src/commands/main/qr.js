const QRCode = require("qrcode");

const {
    startSession
} = require("../../core/multisession/SessionManager");

const {
    getActiveSessions
} = require("../../services/sessionRegistryService");

const {
    loadCommands
} = require("../../core/commandLoader");

const {
    buildHandler
} = require("../../handler");

const {
    registerEvents
} = require("../../core/events");

const config = require("../../config/bot");

module.exports = {

    name: "qr",

    aliases: [],

    category: "owner",

    permission: "owner",

    description: "Gerar QR Code para nova sessão",

    run: async (
        sock,
        m,
        ctx
    ) => {

        try {

            if (ctx.permission !== "owner") {
                return ctx.reply(
                    "❌ Este comando é exclusivo do proprietário."
                );
            }

            const sessionName =
                `rental_${Date.now().toString(36)}`;

            let qrEnviado = false;

            const onQRCode = async (
                qr,
                info
            ) => {

                if (qrEnviado) {
                    return;
                }

                qrEnviado = true;

                const image =
                    await QRCode.toBuffer(
                        qr,
                        {
                            type: "png",
                            width: 900,
                            margin: 2,
                            errorCorrectionLevel: "M"
                        }
                    );

                await sock.sendMessage(
                    ctx.chat,
                    {
                        image,
                        caption:
`╭━━━〔 🔐 NOVA CONEXÃO 〕━━━╮
┃
┃ 🆔 Sessão: ${info.sessionId}
┃ 📱 Tipo: RENTAL
┃
┃ 📷 Escaneie este QR Code
┃ no WhatsApp do cliente.
┃
┃ ⏳ Aguardando conexão...
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                    },
                    {
                        quoted: m
                    }
                );
            };

            const data =
                loadCommands();

            const handle =
                buildHandler(
                    data.commands,
                    config
                );

            await startSession(
                sessionName,
                async (newSock) => {

                    console.log(
                        `🔧 CALLBACK onSocketReady recebido: ${sessionName}`
                    );

                    try {

                        console.log(
                            "🔧 Registrando eventos da sessão rental..."
                        );

                        registerEvents(
                            newSock,
                            handle
                        );

                        console.log(
                            `✅ Eventos registados na sessão rental: ${sessionName}`
                        );

                    } catch (error) {

                        console.error(
                            "❌ ERRO AO REGISTRAR EVENTOS DA RENTAL:",
                            error?.stack || error?.message || error
                        );

                    }
                },
                onQRCode
            );

            const session =
                getActiveSessions()
                    .find(
                        item =>
                            item.sessionName === sessionName
                    );

            if (!session) {
                return ctx.reply(
                    "❌ A sessão foi iniciada, mas não consegui registrar os dados."
                );
            }

            console.log(
                `🔐 Nova sessão RENTAL criada: ${session.sessionId}`
            );

        } catch (error) {

            console.error(
                "❌ Erro no !qr:",
                error?.message || error
            );

            return ctx.reply(
                "❌ Não foi possível gerar o QR Code."
            );
        }
    }
};
