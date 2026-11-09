const { isAdmin } = require("../../services/permissionService");
const { isOwner } = require("../../services/permissionService");

module.exports = {

    name: "despromover",
    aliases: ["demote"],
    category: "admin-grupo",
    permission: "admin",
    description: "Remover administrador",

    run: async (sock, m, ctx) => {


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


        if (!ctx.isGroup) {

            return ctx.reply(
                "❌ Este comando só funciona em grupos."
            );

        }


        const user =
            ctx.m?.message?.extendedTextMessage
            ?.contextInfo
            ?.mentionedJid?.[0];


        if (!user) {

            return ctx.reply(
`❌ Marque alguém para remover administrador.

Exemplo:
.despromover @user`
            );

        }


        try {


            await sock.groupParticipantsUpdate(
                ctx.chat,
                [user],
                "demote"
            );


            const d = new Date();


            const data =
                d.toLocaleDateString("pt-PT");


            const hora =
                d.toLocaleTimeString("pt-PT");


            const numero =
                user.split("@")[0];


            return sock.sendMessage(
                ctx.chat,
                {
                    text:
`╔══════════════════════╗
║ 👤 ADMIN REMOVIDO
╚══════════════════════╝

Usuário:
@${numero}

Status:
❌ Deixou de ser administrador

📅 Data:
${data}

⏰ Hora:
${hora}

🐻 URSINHO X BOT V2`,
                    mentions: [user]
                },
                {
                    quoted: m
                }
            );


        } catch (e) {


            console.log(
                "Erro despromover:",
                e.message
            );


            return ctx.reply(
`❌ Falha ao remover administrador.

Verifique se o bot é administrador do grupo.`
            );

        }


    }

};
