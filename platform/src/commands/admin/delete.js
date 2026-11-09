const {
    isAdmin,
    isOwner
} = require("../../services/permissionService");

module.exports = {

    name: "delete",

    aliases: [
        "del",
        "apagar",
        "apagarmensagem"
    ],

    category: "admin-grupo",

    permission: "admin",

    description: "Apaga uma mensagem do grupo",

    run: async (sock, m, ctx) => {

        try {

            /* ====================================================
               SOMENTE GRUPOS
            ==================================================== */

            if (!ctx.isGroup) {

                return ctx.reply(
                    "❌ Este comando só funciona em grupos."
                );

            }


            /* ====================================================
               PERMISSÕES
            ==================================================== */

            const dono =
                isOwner(ctx.sender);

            const admin =
                await isAdmin(
                    sock,
                    ctx.chat,
                    ctx.sender
                );

            if (!dono && !admin) {

                return ctx.reply(
                    "❌ Apenas administradores podem utilizar este comando."
                );

            }


            /* ====================================================
               IDENTIFICAR MENSAGEM RESPONDIDA
            ==================================================== */

            const contextInfo =
                ctx.m?.message?.extendedTextMessage?.contextInfo;

            const quotedMessage =
                contextInfo?.quotedMessage;

            const quotedParticipant =
                contextInfo?.participant;

            const quotedStanzaId =
                contextInfo?.stanzaId;


            if (
                !quotedMessage ||
                !quotedParticipant ||
                !quotedStanzaId
            ) {

                return ctx.reply(
`❌ Nenhuma mensagem selecionada.

Responda à mensagem que deseja apagar e envie:

${ctx.prefix}delete

Exemplo:
${ctx.prefix}delete`
                );

            }


            /* ====================================================
               CONSTRUIR KEY DA MENSAGEM
            ==================================================== */

            const deleteKey = {

                remoteJid: ctx.chat,

                fromMe:
                    quotedParticipant ===
                    sock.user?.id,

                id: quotedStanzaId,

                participant: quotedParticipant

            };


            /* ====================================================
               REAÇÃO
            ==================================================== */

            try {

                await sock.sendMessage(
                    ctx.chat,
                    {
                        react: {
                            text: "🗑️",
                            key: ctx.m?.key
                        }
                    }
                );

            } catch {}


            /* ====================================================
               APAGAR
            ==================================================== */

            await sock.sendMessage(
                ctx.chat,
                {
                    delete: deleteKey
                }
            );


            console.log(
                "[DELETE] ✅ Mensagem apagada:",
                {
                    chat: ctx.chat,
                    id: quotedStanzaId,
                    participant: quotedParticipant
                }
            );


        } catch (error) {

            console.error(
                "[DELETE] ❌ Erro:",
                error?.message || error
            );


            return ctx.reply(
`❌ Não foi possível apagar a mensagem.

⚠️ Verifique se:
• O bot é administrador do grupo.
• A mensagem foi respondida corretamente.
• A mensagem ainda pode ser apagada pelo WhatsApp.`
            );

        }

    }

};
