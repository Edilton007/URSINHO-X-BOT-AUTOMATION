const {
    isAdmin,
    isOwner
} = require("../../services/permissionService");

const {
    getGroup,
    updateGroup
} = require("../../services/groupService");

module.exports = {

    name: "antiflood",
    aliases: [
        "antispam",
        "aflood"
    ],
    category: "admin-protecao",
    permission: "admin",
    description: "Ativar ou desativar o Anti-Flood",

    run: async (sock, m, ctx) => {

        try {

            if (!ctx.isGroup) {

                return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 🌊 ANTI-FLOOD 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

❌ Este comando só funciona em grupos.

🤖 URSINHO X BOT V2`
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
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 🌊 ANTI-FLOOD 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

❌ Apenas administradores podem utilizar este comando.

🤖 URSINHO X BOT V2`
                );

            }


            const option =
                String(
                    ctx.args?.[0] || ""
                ).toLowerCase();


            if (
                ![
                    "on",
                    "off",
                    "status"
                ].includes(option)
            ) {

                return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 🌊 ANTI-FLOOD 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Utilização:

${ctx.prefix}antiflood on
${ctx.prefix}antiflood off
${ctx.prefix}antiflood status

🟢 on → Ativa o Anti-Flood
🔴 off → Desativa o Anti-Flood

ℹ️ Deteta quem manda muitas mensagens seguidas
em pouco tempo (mais de 6 em 8 segundos) e
aplica o sistema de infrações do grupo.

🤖 URSINHO X BOT V2`
                );

            }


            const group =
                getGroup(ctx.chat);


            if (option === "status") {

                const estado =
                    group.anti?.flood
                        ? "🟢 ATIVADO"
                        : "🔴 DESATIVADO";

                return sock.sendMessage(
                    ctx.chat,
                    {
                        text:
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 🌊 ANTI-FLOOD 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Estado atual:

${estado}

👮 Consultado por:

@${ctx.sender.split("@")[0]}

🤖 URSINHO X BOT V2`,
                        mentions: [
                            ctx.sender
                        ]
                    },
                    {
                        quoted: m
                    }
                );

            }


            updateGroup(
                ctx.chat,
                {
                    anti: {
                        ...(group.anti || {}),
                        flood:
                            option === "on"
                    }
                }
            );


            const agora =
                new Date();


            await sock.sendMessage(
                ctx.chat,
                {
                    text:
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 🌊 ANTI-FLOOD 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

✅ Configuração atualizada.

Estado:

${option === "on"
? "🟢 ATIVADO"
: "🔴 DESATIVADO"}

👮 Administrador:

@${ctx.sender.split("@")[0]}

📅 Data:
${agora.toLocaleDateString("pt-PT")}

⏰ Hora:
${agora.toLocaleTimeString("pt-PT")}

🤖 URSINHO X BOT V2
⚡ Tecnologia • Segurança • Gestão`,
                    mentions: [
                        ctx.sender
                    ]
                },
                {
                    quoted: m
                }
            );


            console.log(
                `[ANTIFLOOD] ${option.toUpperCase()} -> ${ctx.chat}`
            );


        } catch (e) {

            console.log(
                "Erro antiflood:",
                e
            );

            return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ ❌ ERRO 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Não foi possível alterar o Anti-Flood.

⚠️ ${e.message}

🤖 URSINHO X BOT V2`
            );

        }

    }

};
