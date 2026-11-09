const {
    getGroup,
    updateGroup
} = require("../../services/groupService");


module.exports = {

    name: "antisticker",
    aliases: ["antiselo", "antistick"],
    category: "admin-protecao",
    permission: "admin",
    description: "Ativar ou desativar Anti-Sticker",


    run: async (sock, m, ctx) => {

        try {

            if (!ctx.isGroup) {

                return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 🏷️ ANTI-STICKER 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

❌ Este comando só funciona em grupos.

🤖 URSINHO X BOT V2`
                );

            }


            if (
                ctx.permission !== "admin" &&
                ctx.permission !== "owner"
            ) {

                return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 🏷️ ANTI-STICKER 🐻
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
┃ 🏷️ ANTI-STICKER 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Utilização:

${ctx.prefix}antisticker on
${ctx.prefix}antisticker off

🟢 on  → Ativa o Anti-Sticker
🔴 off → Desativa o Anti-Sticker

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
                        sticker:
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
┃ 🏷️ ANTI-STICKER 🐻
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
                `[ANTISTICKER] ${option.toUpperCase()} -> ${ctx.chat}`
            );


        } catch (e) {

            console.log(
                "Erro antisticker:",
                e
            );


            return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ ❌ ERRO 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Não foi possível alterar o Anti-Sticker.

⚠️ ${e.message}

🤖 URSINHO X BOT V2`
            );

        }

    }

};
