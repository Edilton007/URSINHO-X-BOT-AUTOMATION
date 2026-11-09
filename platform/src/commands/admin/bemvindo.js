const { isAdmin, isOwner } = require("../../services/permissionService");
const { getGroup, updateGroup } = require("../../services/groupService");

module.exports = {

    name: "bemvindo",
    aliases: ["welcome"],
    category: "admin-grupo-config",
    permission: "admin",
    description: "Sistema de boas-vindas",

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
                    "❌ Apenas administradores podem configurar boas-vindas."
                );
            }


            const action =
                String(ctx.args[0] || "")
                .toLowerCase();



            const group =
                getGroup(ctx.chat);



            if (action === "on") {

                updateGroup(
                    ctx.chat,
                    {
                        bemvindo: {
                            enabled: true,
                            message:
                            group.bemvindo?.message || null
                        }
                    }
                );


                return ctx.reply(
`╔══════════════════════╗
║ 👋 BOAS-VINDAS
╚══════════════════════╝

🟢 Sistema ativado.

🐻 URSINHO X BOT V2`
                );

            }



            if (action === "off") {

                updateGroup(
                    ctx.chat,
                    {
                        bemvindo: {
                            ...group.bemvindo,
                            enabled: false
                        }
                    }
                );


                return ctx.reply(
`╔══════════════════════╗
║ 👋 BOAS-VINDAS
╚══════════════════════╝

🔴 Sistema desativado.

🐻 URSINHO X BOT V2`
                );

            }



            if (action === "mensagem") {

                const mensagem =
                    ctx.args
                    .slice(1)
                    .join(" ")
                    .trim();



                if (!mensagem) {
                    return ctx.reply(
`.bemvindo mensagem <texto>`
                    );
                }



                updateGroup(
                    ctx.chat,
                    {
                        bemvindo:{
                            ...group.bemvindo,
                            message: mensagem
                        }
                    }
                );


                return ctx.reply(
"✅ Mensagem de boas-vindas atualizada."
                );

            }



            if (action === "ver") {

                return ctx.reply(
`📄 Mensagem atual:

${group.bemvindo?.message || "Padrão"}

Estado:
${
group.bemvindo?.enabled
? "🟢 Ativo"
: "🔴 Desativado"
}`
                );

            }



            if (action === "reset") {

                updateGroup(
                    ctx.chat,
                    {
                        bemvindo:{
                            enabled:false,
                            message:null
                        }
                    }
                );


                return ctx.reply(
"♻️ Sistema restaurado."
                );

            }



            return ctx.reply(
`╔══════════════════════╗
║ 👋 BOAS-VINDAS
╚══════════════════════╝

${ctx.prefix}bemvindo on
${ctx.prefix}bemvindo off
${ctx.prefix}bemvindo mensagem <texto>
${ctx.prefix}bemvindo ver
${ctx.prefix}bemvindo reset

🐻 URSINHO X BOT V2`
            );


        } catch(e){

            console.log(
                "ERRO BEMVINDO:",
                e.message
            );

            return ctx.reply(
                "❌ Erro no sistema de boas-vindas."
            );

        }

    }

};
