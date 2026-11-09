const { getGroup } = require("../../services/groupService");
const { isAdmin, isOwner } = require("../../services/permissionService");

module.exports = {

    name: "status",
    aliases: ["statsgrupo"],
    category: "admin-sistema",
    permission: "admin",
    description: "Ver status do grupo",


    run: async (sock, m, ctx) => {

        try {

            if (!ctx.isGroup) {

                return ctx.reply(
                    "❌ Este comando só funciona em grupos."
                );

            }


            const dono = isOwner(ctx.sender);

            const admin = await isAdmin(
                sock,
                ctx.chat,
                ctx.sender
            );


            if (!dono && !admin) {

                return ctx.reply(
                    "❌ Apenas administradores podem usar este comando."
                );

            }


            const group = getGroup(
                ctx.chat
            );


            const anti = group.anti || {};


            const estado = (value) =>
                value ? "🟢 ON" : "🔴 OFF";


            return ctx.reply(
`╔══════════════════════╗
║ 📊 STATUS DO GRUPO
╚══════════════════════╝

🔗 Anti-Link:
${estado(anti.link)}

🖼️ Anti-Foto:
${estado(anti.image)}

🎥 Anti-Vídeo:
${estado(anti.video)}

🔊 Anti-Áudio:
${estado(anti.audio)}

🏷️ Anti-Sticker:
${estado(anti.sticker)}

📢 Anti-Status:
${estado(anti.status)}

👋 Bem-vindo:
${estado(group.bemvindo?.enabled)}

🚪 Saída:
${estado(group.saida?.enabled)}

🔐 Licença:
${group.rentalActive ? "✅ Ativa" : "❌ Inativa"}

🐻 URSINHO X BOT V2`
            );


        } catch (e) {

            console.log(
                "ERRO STATUS:",
                e
            );

            return ctx.reply(
                "❌ Erro ao verificar status."
            );

        }

    }

};
