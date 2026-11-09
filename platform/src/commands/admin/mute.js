const { isAdmin, isOwner } = require("../../services/permissionService");
const { getGroup, updateGroup } = require("../../services/groupService");

module.exports = {

    name: "mute",
    aliases: ["silenciar"],
    category: "admin-grupo",
    permission: "admin",
    description: "Silenciar um membro (mensagens dele são apagadas automaticamente)",

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

.mute @membro

OU responda à mensagem da pessoa e envie:

.mute`
                );
            }


            if (user === ctx.sender) {

                return ctx.reply(
                    "❌ Não podes silenciar-te a ti mesmo."
                );
            }


            const group =
                getGroup(ctx.chat);

            const muted =
                group.muted || [];

            if (muted.includes(user)) {

                return sock.sendMessage(
                    ctx.chat,
                    {
                        text:
`ℹ️ @${user.split("@")[0]} já está silenciado.`,
                        mentions: [user]
                    },
                    {
                        quoted: m
                    }
                );
            }


            updateGroup(
                ctx.chat,
                {
                    muted: [
                        ...muted,
                        user
                    ]
                }
            );


            await sock.sendMessage(
                ctx.chat,
                {
                    text:
`🔇 @${user.split("@")[0]} foi silenciado.

As mensagens desta pessoa serão apagadas automaticamente até ser desmutada.

👮 Por: @${ctx.sender.split("@")[0]}`,
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

            console.log("Erro mute:", e);

            return ctx.reply(
                `❌ Não foi possível silenciar. ⚠️ ${e.message}`
            );
        }
    }

};
