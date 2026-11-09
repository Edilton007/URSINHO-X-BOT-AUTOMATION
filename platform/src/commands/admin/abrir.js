const { isAdmin } = require("../../services/permissionService");
const { isOwner } = require("../../services/permissionService");

module.exports = {

    name: "abrir",
    aliases: ["open"],
    category: "admin-grupo",
    permission: "admin",
    description: "Abrir grupo para membros",

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


            await sock.groupSettingUpdate(
                ctx.chat,
                "not_announcement"
            );


            await sock.sendMessage(
                ctx.chat,
                {
                    react: {
                        text: "🔓",
                        key: ctx.m?.key
                    }
                }
            );


            const timeService = require("../../services/timeService");

            return sock.sendMessage(
                ctx.chat,
                {
                    text:
`╔══════════════════════╗
║ 🔓 GRUPO ABERTO
╚══════════════════════╝

🎉 Grupo aberto para todos.

📅 Data:
${timeService.formatarData()}

⏰ Hora:
${timeService.formatarHora()} (Moçambique)

🐻 URSINHO X BOT V2`
                },
                {
                    quoted: m
                }
            );


        } catch (e) {

            console.log(
                "Erro abrir:",
                e.message
            );


            return ctx.reply(
                "❌ Não foi possível abrir o grupo."
            );

        }

    }

};
