const { generateUnlock } = require("../../services/rentalService");
const { isOwner } = require("../../services/permissionService");

module.exports = {

    name: "gerarunlock",
    aliases: ["unlock"],
    category: "owner",
    permission: "owner",
    description: "Gerar código de desbloqueio",

    run: async (sock, m, ctx) => {


        if (!isOwner(ctx.sender)) {

            return ctx.reply(
                "❌ Apenas o dono pode usar este comando."
            );

        }


        const grupo = ctx.args?.[0] || ctx.chat;


        const code = generateUnlock(grupo);


        return ctx.reply(
`╔══════════════════════╗
║ 🔓 UNLOCK GERADO
╚══════════════════════╝

Grupo:
${grupo}

Código:
${code}

Use este código para desbloquear.

🐻 URSINHO X BOT V2`
        );

    }

};
