const {
    isAdmin,
    isOwner
} = require("../../services/permissionService");

const {
    getGroup,
    updateGroup
} = require("../../services/groupService");

module.exports = {

    name: "antilink",
    aliases: [
        "antilinks",
        "alink"
    ],
    category: "admin-protecao",
    permission: "admin",
    description: "Ativar ou desativar o Anti-Link",

    run: async (sock, m, ctx) => {

        try {

            if (!ctx.isGroup) {

                return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 🔗 ANTI-LINK 🐻
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
┃ 🔗 ANTI-LINK 🐻
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
┃ 🔗 ANTI-LINK 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Utilização:

${ctx.prefix}antilink on
${ctx.prefix}antilink off
${ctx.prefix}antilink status

🟢 on → Ativa o Anti-Link
🔴 off → Desativa o Anti-Link

🤖 URSINHO X BOT V2`
                );

            }


            const group =
                getGroup(ctx.chat);


            if (option === "status") {

                const estado =
                    group.anti?.link
                        ? "🟢 ATIVADO"
                        : "🔴 DESATIVADO";

                return sock.sendMessage(
                    ctx.chat,
                    {
                        text:
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 🔗 ANTI-LINK 🐻
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
                        link:
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
┃ 🔗 ANTI-LINK 🐻
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
                `[ANTILINK] ${option.toUpperCase()} -> ${ctx.chat}`
            );


        } catch (e) {

            console.log(
                "Erro antilink:",
                e
            );

            return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ ❌ ERRO 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Não foi possível alterar o Anti-Link.

⚠️ ${e.message}

🤖 URSINHO X BOT V2`
            );

        }

    }

};
