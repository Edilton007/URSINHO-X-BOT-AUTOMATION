const {
    isAdmin,
    isOwner
} = require("../../services/permissionService");

const {
    getGroup,
    updateGroup
} = require("../../services/groupService");

module.exports = {

    name: "antiaudio",
    aliases: ["antiaud"],
    category: "admin-protecao",
    permission: "admin",
    description: "Ativar ou desativar Anti-Áudio",

    run: async (sock, m, ctx) => {

        try {

            if (!ctx.isGroup) {

                return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 🔊 ANTI-ÁUDIO 🐻
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
┃ 🔊 ANTI-ÁUDIO 🐻
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
                option !== "on" &&
                option !== "off"
            ) {

                return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 🔊 ANTI-ÁUDIO 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Utilização:

${ctx.prefix}antiaudio on
${ctx.prefix}antiaudio off

🟢 on  → Ativa o Anti-Áudio
🔴 off → Desativa o Anti-Áudio

🤖 URSINHO X BOT V2`
                );

            }


            const group =
                getGroup(ctx.chat);


            updateGroup(
                ctx.chat,
                {
                    anti: {
                        ...(group.anti || {}),
                        audio:
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
┃ 🔊 ANTI-ÁUDIO 🐻
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
                `[ANTIAUDIO] ${option.toUpperCase()} -> ${ctx.chat}`
            );


        } catch (e) {

            console.log(
                "Erro antiaudio:",
                e
            );

            return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ ❌ ERRO 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Não foi possível alterar o Anti-Áudio.

⚠️ ${e.message}

🤖 URSINHO X BOT V2`
            );

        }

    }

};
