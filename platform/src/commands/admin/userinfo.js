module.exports = {
    name: "userinfo",
    aliases: ["infomembro", "membro"],
    category: "admin",
    permission: "admin",
    description: "Mostrar informações de um membro",

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

            const target =
                ctx.m?.message?.extendedTextMessage?.contextInfo?.participant ||
                ctx.m?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

            if (!target) {
                return ctx.reply(
                    `⚠️ Marque ou responda à mensagem do membro.\n\nExemplo:\n${ctx.prefix}userinfo @membro`
                );
            }

            const metadata =
                await sock.groupMetadata(ctx.chat);

            const participant =
                metadata.participants.find(
                    p => p.id === target
                );

            if (!participant) {
                return ctx.reply(
                    "❌ Esse membro não foi encontrado no grupo."
                );
            }

            let cargo = "Membro";

            if (participant.admin === "superadmin") {
                cargo = "Dono do grupo";
            } else if (participant.admin === "admin") {
                cargo = "Administrador";
            }

            const group =
                require("../../services/groupService")
                    .getGroup(ctx.chat) || {};

            const warnings =
                group.warnings?.[target] || 0;

            await sock.sendMessage(
                ctx.chat,
                {
                    text:
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 👤 INFORMAÇÕES 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

📱 Número:
+${target.split("@")[0]}

👑 Cargo:
${cargo}

⚠️ Advertências:
${warnings}

🆔 JID:
${target}

🤖 URSINHO X BOT V2`,
                    mentions: [target]
                },
                {
                    quoted: m
                }
            );

        } catch (error) {
            console.error(
                "[USERINFO] Erro:",
                error.message
            );

            return ctx.reply(
                "❌ Não foi possível obter as informações do membro."
            );
        }
    }
};
