const {
    getGroup,
    updateGroup
} = require("../../services/groupService");


module.exports = {

    name: "saida",
    aliases: ["goodbye", "bye"],
    category: "admin-grupo-config",
    permission: "admin",
    description: "Sistema de saída do grupo",


    run: async (sock, m, ctx) => {

        try {


            if (!ctx.isGroup) {

                return ctx.reply(
`╭━━━〔 👋 SAÍDA 🐻 〕━━━╮

❌ Este comando só funciona em grupos.

🤖 URSINHO X BOT V2`
                );

            }



            if (
                ctx.permission !== "admin" &&
                ctx.permission !== "owner"
            ) {

                return ctx.reply(
`╭━━━〔 🚫 ACESSO NEGADO 〕━━━╮

❌ Apenas administradores podem
configurar o sistema de saída.

╰━━━━━━━━━━━━━━━━━━━━━━╯`
                );

            }



            const body =
                ctx.text || "";



            const args =
                body.trim().split(/\s+/);



            const action =
                (args[1] || "").toLowerCase();



            const group =
                getGroup(ctx.chat);



            switch (action) {



                case "on":


                    updateGroup(
                        ctx.chat,
                        {
                            saida:{
                                ...(group.saida || {}),
                                enabled:true
                            }
                        }
                    );


                    return ctx.reply(
`╭━━━━━━〔 👋 SAÍDA 〕━━━━━━╮

🟢 Sistema de saída ativado.

Agora o bot avisará quando
alguém sair do grupo.

╰━━━〔🐻 URSINHO X BOT V2〕━━━╯`
                    );





                case "off":


                    updateGroup(
                        ctx.chat,
                        {
                            saida:{
                                ...(group.saida || {}),
                                enabled:false
                            }
                        }
                    );


                    return ctx.reply(
`╭━━━━━━〔 👋 SAÍDA 〕━━━━━━╮

🔴 Sistema de saída desativado.

╰━━━〔🐻 URSINHO X BOT V2〕━━━╯`
                    );





                case "mensagem": {


                    const mensagem =
                        args
                        .slice(2)
                        .join(" ")
                        .trim();



                    if (!mensagem) {

                        return ctx.reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 👋 SISTEMA DE SAÍDA V2 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Envie:

${ctx.prefix}saida mensagem <texto>

Exemplo:

${ctx.prefix}saida mensagem Até breve @user 👋

🤖 URSINHO X BOT V2`
                        );

                    }



                    updateGroup(
                        ctx.chat,
                        {
                            saida:{
                                ...(group.saida || {}),
                                message: mensagem
                            }
                        }
                    );



                    return ctx.reply(
                        "✅ Mensagem de saída atualizada."
                    );

                }





                case "ver":


                    return ctx.reply(
`╭━━━〔 📄 SAÍDA ATUAL 〕━━━╮

Estado:
${
group.saida?.enabled
? "🟢 Ativado"
: "🔴 Desativado"
}


Mensagem:

${
group.saida?.message ||
"Mensagem padrão ativa."
}

╰━━━━━━━━━━━━━━━━━━━━━━╯

🐻 URSINHO X BOT V2`
                    );






                case "reset":


                    updateGroup(
                        ctx.chat,
                        {
                            saida:{
                                enabled:false,
                                message:null
                            }
                        }
                    );


                    return ctx.reply(
                        "♻️ Sistema de saída restaurado."
                    );






                default:


                    return ctx.reply(
`╭━━━〔 👋 SISTEMA DE SAÍDA 〕━━━╮

🟢 ${ctx.prefix}saida on

🔴 ${ctx.prefix}saida off

📝 ${ctx.prefix}saida mensagem <texto>

📄 ${ctx.prefix}saida ver

♻️ ${ctx.prefix}saida reset


🐻 URSINHO X BOT V2`
                    );

            }



        } catch (e) {


            console.log(
                "ERRO SAIDA CMD:",
                e
            );


            return ctx.reply(
`❌ Erro ao executar sistema de saída.

⚠️ ${e.message}`
            );


        }

    }

};
