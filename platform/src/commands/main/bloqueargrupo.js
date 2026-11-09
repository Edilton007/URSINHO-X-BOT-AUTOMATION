const { block } = require("../../services/rentalService");
const { isOwner } = require("../../services/permissionService");

module.exports = {

    name: "bloqueargrupo",
    aliases: ["blockgrupo"],
    category: "owner",
    permission: "owner",
    description: "Bloquear grupo",

    run: async (sock, m, ctx) => {


        if (!isOwner(ctx.sender)) {

            return ctx.reply(
                "❌ Apenas o dono pode usar este comando."
            );

        }


        const grupo = ctx.args?.[0] || ctx.chat;


        block(grupo);


        return ctx.reply(
`╔══════════════════════╗
║ 🚫 GRUPO BLOQUEADO
╚══════════════════════╝

Grupo:
${grupo}

O acesso foi bloqueado.

🐻 URSINHO X BOT V2`
        );

    }

};
