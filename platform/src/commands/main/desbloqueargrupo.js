const { unblock } = require("../../services/rentalService");
const { isOwner } = require("../../services/permissionService");

module.exports = {

    name: "desbloqueargrupo",
    aliases: ["unblockgrupo"],
    category: "owner",
    permission: "owner",
    description: "Desbloquear grupo",

    run: async (sock, m, ctx) => {


        if (!isOwner(ctx.sender)) {

            return ctx.reply(
                "❌ Apenas o dono pode usar este comando."
            );

        }


        const grupo = ctx.args?.[0] || ctx.chat;


        unblock(grupo);


        return ctx.reply(
`╔══════════════════════╗
║ ✅ GRUPO DESBLOQUEADO
╚══════════════════════╝

Grupo:
${grupo}

O acesso foi restaurado.

🐻 URSINHO X BOT V2`
        );

    }

};
