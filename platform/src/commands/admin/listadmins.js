module.exports = {
    name: "listadmins",
    aliases: ["admins", "adms"],
    category: "admin-grupo",
    permission: "admin",
    description: "Lista os administradores do grupo",

    run: async (sock, m, ctx) => {
        try {
            if (!ctx.isGroup) {
                return ctx.reply(
                    "❌ Este comando só funciona em grupos."
                );
            }

            if (
                ctx.permission !== "admin" &&
                ctx.permission !== "owner"
            ) {
                return ctx.reply(
                    "❌ Apenas administradores podem utilizar este comando."
                );
            }

            const metadata =
                await sock.groupMetadata(ctx.chat);

            const admins = metadata.participants.filter(
                participant =>
                    participant.admin === "admin" ||
                    participant.admin === "superadmin"
            );

            if (!admins.length) {
                return ctx.reply(
                    "❌ Nenhum administrador encontrado."
                );
            }

            let texto =
                `╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 👑 ADMINISTRADORES 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

`;

            const mentions = [];

            admins.forEach((admin, index) => {
                const jid = admin.id;

                mentions.push(jid);

                texto +=
                    `${index + 1}. @${jid.split("@")[0]}` +
                    `${admin.admin === "superadmin" ? " 👑" : ""}\n`;
            });

            texto +=
                `\n👥 Total: ${admins.length}

🤖 URSINHO X BOT V2`;

            await sock.sendMessage(
                ctx.chat,
                {
                    text: texto,
                    mentions
                },
                {
                    quoted: m
                }
            );

        } catch (error) {
            console.error(
                "[LISTADMINS] Erro:",
                error.message
            );

            return ctx.reply(
                "❌ Não foi possível obter a lista de administradores."
            );
        }
    }
};
