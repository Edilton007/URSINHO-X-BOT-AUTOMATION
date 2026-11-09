const {
    getGroup,
    updateGroup
} = require("../../services/groupService");


module.exports = {

    name: "setup",
    aliases: ["configurar"],
    category: "admin-sistema",
    permission: "admin",
    description: "Configuração inicial do grupo",


    run: async (sock, m, ctx) => {

        try {


            if (!ctx.isGroup) {

                return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ ⚙️ SETUP URSINHO X BOT 🐻
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
┃ 🚫 ACESSO NEGADO 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

❌ Apenas administradores podem executar o setup.

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

                        link: true,

                        image: true,

                        video: true,

                        audio: true,

                        sticker: true,

                        status: true

                    },


                    bemvindo: {

                        ...(group.bemvindo || {}),

                        enabled: true

                    },


                    saida: {

                        ...(group.saida || {}),

                        enabled: true

                    }

                }
            );



            return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ ⚙️ SETUP CONCLUÍDO 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

✅ Configuração inicial aplicada.

🛡️ Proteções:

🔗 Anti-Link       🟢 ON
🖼️ Anti-Foto       🟢 ON
🎥 Anti-Vídeo      🟢 ON
🔊 Anti-Áudio      🟢 ON
🏷️ Anti-Sticker    🟢 ON
📢 Anti-Status     🟢 ON

👋 Bem-vindo       🟢 ON
🚪 Saída           🟢 ON


🐻 URSINHO X BOT V2
⚡ Tecnologia • Segurança • Gestão`
            );


        } catch (e) {


            console.log(
                "Erro setup:",
                e
            );


            return ctx.reply(
`❌ Erro ao executar setup.

⚠️ ${e.message}`
            );

        }

    }

};
