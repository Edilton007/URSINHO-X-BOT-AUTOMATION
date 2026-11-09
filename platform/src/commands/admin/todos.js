const { isAdmin, isOwner } = require("../../services/permissionService");

module.exports = {

    name: "todos",
    aliases: [
        "marcar",
        "tagall"
    ],

    category: "admin-grupo",

    permission: "admin",

    description:
        "Marcar todos os membros do grupo",


    run: async (sock, m, ctx) => {

        try {


            if (!ctx.isGroup) {

                return ctx.reply(
                    "❌ Este comando só funciona em grupos."
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



            const mensagem =
                ctx.args
                    .join(" ")
                    .trim();



            const texto =
                mensagem ||
                "📢 Atenção a todos os membros!";



            const metadata =
                await sock.groupMetadata(
                    ctx.chat
                );



            const membros =
                metadata.participants
                    .map(
                        membro => membro.id
                    )
                    .filter(Boolean);



            if (!membros.length) {

                return ctx.reply(
                    "❌ Não foi possível encontrar membros do grupo."
                );

            }



            await sock.sendMessage(

                ctx.chat,

                {
                    text:
`╔══════════════════════╗
║ 📢 MARCANDO TODOS
╚══════════════════════╝

${texto}

👥 Membros:
${membros.length}

👤 Enviado por:
@${ctx.sender.split("@")[0]}

🐻 URSINHO X BOT V2`,

                    mentions: membros
                },

                {
                    quoted: m
                }

            );



        } catch (e) {


            console.log(
                "ERRO TODOS:",
                e.message
            );


            return ctx.reply(
                "❌ Erro ao executar a marcação geral."
            );

        }

    }

};
