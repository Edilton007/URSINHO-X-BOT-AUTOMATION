const { isAdmin, isOwner } = require("../../services/permissionService");
const { getGroup, updateGroup } = require("../../services/groupService");

module.exports = {

    name: "desmute",
    aliases: ["dessilenciar", "unmute"],
    category: "admin-grupo",
    permission: "admin",
    description: "Remover o silêncio de um membro",

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

.desmute @membro

OU responda à mensagem da pessoa e envie:

.desmute`
                );
            }


            const group =
                getGroup(ctx.chat);

            const muted =
                group.muted || [];

            if (!muted.includes(user)) {

                return sock.sendMessage(
                    ctx.chat,
                    {
                        text:
`ℹ️ @${user.split("@")[0]} não está silenciado.`,
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
                    muted:
                        muted.filter(
                            jid => jid !== user
                        )
                }
            );


            await sock.sendMessage(
                ctx.chat,
                {
                    text:
`🔊 @${user.split("@")[0]} foi desmutado — já pode enviar mensagens normalmente.

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

            console.log("Erro desmute:", e);

            return ctx.reply(
                `❌ Não foi possível desmutar. ⚠️ ${e.message}`
            );
        }
    }

};
