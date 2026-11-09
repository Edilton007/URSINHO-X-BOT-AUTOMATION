const {
    isAdmin,
    isOwner
} = require("../../services/permissionService");

const {
    getGroup,
    updateGroup
} = require("../../services/groupService");

module.exports = {

    name: "antipalavrao",
    aliases: [
        "antixingamento",
        "apalavrao",
        "haran"
    ],
    category: "admin-protecao",
    permission: "admin",
    description: "Ativar ou desativar o Anti-Palavrão",

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
"❌ Apenas administradores podem utilizar este comando."
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
┃ 🤬 ANTI-PALAVRÃO 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Utilização:

${ctx.prefix}antipalavrao on
${ctx.prefix}antipalavrao off
${ctx.prefix}antipalavrao status

🟢 on → Ativa o Anti-Palavrão
🔴 off → Desativa o Anti-Palavrão

ℹ️ Deteta linguagem imprópria e aplica o
sistema de infrações do grupo.

Podes adicionar palavras próprias com:
${ctx.prefix}addpalavrao <palavra>

🤖 URSINHO X BOT V2`
                );

            }


            const group =
                getGroup(ctx.chat);


            if (option === "status") {

                const estado =
                    group.anti?.palavrao
                        ? "🟢 ATIVADO"
                        : "🔴 DESATIVADO";

                const customCount =
                    (group.anti?.customPalavroes || []).length;

                return sock.sendMessage(
                    ctx.chat,
                    {
                        text:
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 🤬 ANTI-PALAVRÃO 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Estado atual:

${estado}

📝 Palavras extra deste grupo: ${customCount}

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
                        palavrao:
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
┃ 🤬 ANTI-PALAVRÃO 🐻
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
                `[ANTIPALAVRAO] ${option.toUpperCase()} -> ${ctx.chat}`
            );


        } catch (e) {

            console.log(
                "Erro antipalavrao:",
                e
            );

            return ctx.reply(
`❌ Não foi possível alterar o Anti-Palavrão. ⚠️ ${e.message}`
            );

        }

    }

};
