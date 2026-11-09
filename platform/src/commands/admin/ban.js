const { isAdmin } = require("../../services/permissionService");
const { isOwner } = require("../../services/permissionService");
const config = require("../../config/bot");

module.exports = {

    name: "ban",
    aliases: ["kick", "remover"],
    category: "admin-grupo",
    permission: "admin",
    description: "Remover membro do grupo",

    run: async (sock, m, ctx) => {

        try {

            if (!ctx.isGroup) {

                return ctx.reply(
                    "❌ Este comando só pode ser usado em grupos."
                );

            }


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
                    "❌ Apenas administradores podem usar este comando."
                );

            }


            const info =
                ctx.m?.message?.extendedTextMessage?.contextInfo;


            const quoted =
                info?.participant;


            const mentioned =
                info?.mentionedJid?.[0];


            const user =
                quoted || mentioned;


            if (!user) {

                return ctx.reply(
`❌ Nenhum membro selecionado.

Use:

.ban @membro

OU responda a mensagem da pessoa e envie:

.ban`
                );

            }


            if (user === ctx.sender) {

                return ctx.reply(
                    "⚠️ Você não pode remover a si mesmo."
                );

            }


            const ownerNumber =
                String(config.OWNER_NUMBER || "")
                .replace(/\D/g, "");


            if (
                user.split("@")[0] === ownerNumber
            ) {

                return ctx.reply(
                    "🚫 O dono do bot não pode ser removido."
                );

            }


            if (
                sock.user?.id &&
                user === sock.user.id
            ) {

                return ctx.reply(
                    "🤖 Não posso remover a mim mesmo."
                );

            }


            const metadata =
                await sock.groupMetadata(
                    ctx.chat
                );


            const alvo =
                metadata.participants.find(
                    p => p.id === user
                );


            if (
                alvo &&
                (
                    alvo.admin === "admin" ||
                    alvo.admin === "superadmin"
                )
            ) {

                return ctx.reply(
                    "🛡️ Não é possível remover outro administrador."
                );

            }


            await sock.sendMessage(
                ctx.chat,
                {
                    react: {
                        text: "⚡",
                        key: ctx.m?.key
                    }
                }
            );


            await sock.groupParticipantsUpdate(
                ctx.chat,
                [user],
                "remove"
            );


            const data =
                new Date()
                .toLocaleDateString("pt-PT");


            const hora =
                new Date()
                .toLocaleTimeString("pt-PT");


            return sock.sendMessage(
                ctx.chat,
                {
                    text:
`╔══════════════════════╗
║ 🚨 MEMBRO REMOVIDO
╚══════════════════════╝

Membro:
@${user.split("@")[0]}

Moderador:
@${ctx.sender.split("@")[0]}

📅 Data:
${data}

⏰ Hora:
${hora}

🛡️ Motivo:
Violação das regras do grupo.

🐻 URSINHO X BOT V2`,
                    mentions: [
                        user,
                        ctx.sender
                    ]
                },
                {
                    quoted: m
                }
            );


        } catch (e) {

            console.log(
                "Erro ban:",
                e.message
            );


            return ctx.reply(
`❌ Não foi possível remover este membro.

Verifique se o bot é administrador do grupo.`
            );

        }

    }

};
