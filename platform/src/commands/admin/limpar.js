const { isAdmin } = require("../../services/permissionService");

module.exports = {

    name: "limpar",

    aliases: [
        "clear",
        "limparchat"
    ],

    category: "admin-sistema",

    permission: "admin",

    description: "Limpeza visual do chat",

    run: async (
        sock,
        m,
        ctx
    ) => {

        try {

            /*
            ==================================================
            VERIFICAR SE É GRUPO
            ==================================================
            */

            if (
                !ctx.chat ||
                !String(ctx.chat).endsWith("@g.us")
            ) {

                return ctx.reply(
`╭━━━〔 🧹 LIMPEZA DO CHAT 〕━━━╮
┃
┃ ❌ Este comando só funciona
┃ em grupos.
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                );

            }

            /*
            ==================================================
            VERIFICAR PERMISSÃO
            ==================================================
            */

            const admin = await isAdmin(
                sock,
                ctx.chat,
                ctx.sender
            );

            if (
                !admin &&
                ctx.permission !== "owner"
            ) {

                return ctx.reply(
`╭━━━〔 🚫 ACESSO NEGADO 〕━━━╮
┃
┃ ❌ Apenas administradores
┃ podem usar este comando.
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                );

            }

            /*
            ==================================================
            IDENTIDADE DO ADMINISTRADOR
            ==================================================
            */

            const senderJid =
                String(ctx.sender || "");

            /*
            ==================================================
            MENSAGEM DE INÍCIO
            ==================================================
            */

            await sock.sendMessage(
                ctx.chat,
                {
                    text:
`🧹 A limpar o chat...`
                },
                {
                    quoted: m
                }
            );

            /*
            ==================================================
            LIMPEZA VISUAL
            ==================================================

            O WhatsApp não disponibiliza uma operação para o
            bot apagar todo o histórico do grupo de uma vez.

            Por isso usamos uma limpeza visual através de
            mensagens vazias/espaços.
            ==================================================
            */

            let blank = "";

            for (let i = 0; i < 650; i++) {

                blank += "‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎\u200B\n";

            }

            await sock.sendMessage(
                ctx.chat,
                {
                    text: blank
                }
            );

            /*
            ==================================================
            MENSAGEM DE CONCLUSÃO

            Réplica exata da técnica pedida: envia uma
            "imagem" com dados de mídia fictícios via
            relayMessage. Aviso: como os hashes/chaves não
            correspondem a mídia real, pode aparecer como
            imagem quebrada dependendo da versão do WhatsApp.
            ==================================================
            */

            const cleanMessage = {
                botInvokeMessage: {
                    message: {
                        messageContextInfo: {
                            deviceListMetadataVersion: 2,
                            deviceListMetadata: {}
                        },
                        imageMessage: {
                            url:
                                "https://mmg.whatsapp.net/o1/v/t62.7118-24/f1/m234/up-oil-image-e1bbfe2b-334b-4c5d-b716-d80edff29301?ccb=9-4&oh=01_Q5AaID0uZoxsi9v2I7KJZEgeJ7IVkFPZkt2yeYf6ps0IWG2g&oe=66E7130B&_nc_sid=000000&mms3=true",
                            mimetype: "image/png",
                            caption: "🐻 Limpo ✅️",
                            fileSha256:
                                "YVuPx9PoIxL0Oc3xsUc3n3uhttmVYlqUV97LKKvIjL8=",
                            fileLength: "999999999",
                            height: 10000000000000000,
                            width: 99999999999999999999999,
                            mediaKey:
                                "4T8WJKuKvJ9FXSwldCXe5+/IA7aYi5ycf301J0xIZwA=",
                            fileEncSha256:
                                "jfG3tesFLdqtCzO6cqU51HGGkEtd7+w22aJtaEm2yjE=",
                            directPath:
                                "/v/t62.7118-24/29631950_1467571294644184_4827066390759523804_n.enc?ccb=11-4&oh=01_Q5AaIFPK_QoDRMR4vZIBbMTdy6GreGhSA2HHRAIu0-vAMgqN&oe=66E72F5E&_nc_sid=5e03e0",
                            mediaKeyTimestamp: "1723839207",
                            jpegThumbnail: "",
                            scansSidecar:
                                "il8IxPgrhGdtn37jGMVgQVRKlPd/CERE+Nr822DZe2UT9r0YT3KPSQ==",
                            scanLengths: [5373, 24562, 15656, 22918],
                            midQualityFileSha256:
                                "s8Li+/zg2VmzMvJtRAZHPVres8nAPEWcd11nK5b/keY="
                        }
                    },
                    expiration: 0,
                    ephemeralSettingTimestamp: "1723838053",
                    disappearingMode: {
                        initiator: "CHANGED_IN_CHAT",
                        trigger: "UNKNOWN",
                        initiatedByMe: true
                    }
                }
            };

            try {

                await sock.relayMessage(
                    ctx.chat,
                    cleanMessage,
                    {}
                );

            } catch (relayError) {

                console.error(
                    "Erro ao enviar mensagem 'Limpo' via relayMessage, a usar texto simples como reserva:",
                    relayError?.message || relayError
                );

                await sock.sendMessage(
                    ctx.chat,
                    {
                        text: "🐻 Limpo ✅️"
                    }
                );
            }

            /*
            ==================================================
            LOG
            ==================================================
            */

            console.log(
                "🧹 Limpeza visual executada por:",
                senderJid,
                "no grupo:",
                ctx.chat
            );

        } catch (error) {

            console.error(
                "ERRO LIMPAR:",
                error
            );

            return ctx.reply(
`╭━━━〔 ❌ ERRO NA LIMPEZA 〕━━━╮
┃
┃ ⚠️ Não foi possível concluir
┃ a limpeza visual.
┃
┃ ${error?.message || "Erro desconhecido"}
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
            );

        }

    }

};
