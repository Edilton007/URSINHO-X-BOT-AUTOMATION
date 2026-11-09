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

    name: "pair",

    aliases: ["pareamento"],

    category: "owner",

    permission: "owner",

    description: "Gerar código de pareamento (sem QR) para nova sessão",

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

            const numero =
                String(ctx.args?.[0] || "")
                    .replace(/[^0-9]/g, "");

            if (numero.length < 8 || numero.length > 15) {
                return ctx.reply(
                    "📱 Use: .pair 258XXXXXXXXX\n(número do cliente com código do país, só dígitos)"
                );
            }

            const sessionName =
                `rental_${Date.now().toString(36)}`;

            const onPairingCode = async (
                codigo,
                info
            ) => {

                await sock.sendMessage(
                    ctx.chat,
                    {
                        text:
`╭━━━〔 🔐 NOVA CONEXÃO 〕━━━╮
┃
┃ 🆔 Sessão: ${info.sessionId}
┃ 📱 Tipo: RENTAL
┃ 📞 Número: ${info.pairingNumber}
┃
┃ 🔑 CÓDIGO: ${codigo}
┃
┃ No WhatsApp do cliente:
┃ Definições > Dispositivos ligados >
┃ Ligar com número de telefone
┃ e digite o código acima.
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

                    try {

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
                null,
                {
                    pairingNumber: numero,
                    onPairingCode
                }
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
                `🔐 Nova sessão RENTAL (pairing) criada: ${session.sessionId}`
            );

        } catch (error) {

            console.error(
                "❌ Erro no .pair:",
                error?.message || error
            );

            return ctx.reply(
                "❌ Não foi possível gerar o código de pareamento."
            );
        }
    }
};
