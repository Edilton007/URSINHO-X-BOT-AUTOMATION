const { isAdmin } = require("../../services/permissionService");
const { isOwner } = require("../../services/permissionService");

module.exports = {

    name: "promover",
    aliases: ["promote"],
    category: "admin-grupo",
    permission: "admin",
    description: "Promover membro a administrador",

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


        const contextInfo =
            ctx.m?.message?.extendedTextMessage?.contextInfo;

        const user =
            contextInfo?.mentionedJid?.[0] ||
            contextInfo?.participant;

        if (!user) {
            return ctx.reply(
`❌ Membro não identificado.

Marque o membro:
${ctx.prefix}promover @user

Ou responda à mensagem do membro com:
${ctx.prefix}promover`
            );
        }


        try {

            await sock.groupParticipantsUpdate(
                ctx.chat,
                [user],
                "promote"
            );


            const d = new Date();


            const data =
                d.toLocaleDateString("pt-PT");


            const hora =
                d.toLocaleTimeString("pt-PT");


            const numero =
                user.split("@")[0];


            await sock.sendMessage(
                ctx.chat,
                {
                    text:
`╔══════════════════════╗
║ 👑 MEMBRO PROMOVIDO
╚══════════════════════╝

Usuário:
@${numero}

Status:
✅ Novo administrador

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
                "Erro promover:",
                e.message
            );


            return ctx.reply(
`❌ Falha ao promover membro.

Verifique se o bot é administrador do grupo.`
            );

        }


    }

};
