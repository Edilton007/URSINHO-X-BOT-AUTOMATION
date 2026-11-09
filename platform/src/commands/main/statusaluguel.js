const { status } = require("../../services/rentalService");
const { isOwner } = require("../../services/permissionService");

module.exports = {

    name: "statusaluguel",
    aliases: ["statuslicenca", "licenca"],
    category: "owner",
    permission: "owner",
    description: "Ver status da licença",

    run: async (sock, m, ctx) => {


        if (!isOwner(ctx.sender)) {

            return ctx.reply(
                "❌ Apenas o dono pode usar este comando."
            );

        }


        const info = status(ctx.chat);


        const ativo = info.active
            ? "✅ Ativo"
            : "❌ Inativo";


        const expira = info.expiresAt
            ? new Date(info.expiresAt)
                .toLocaleString("pt-PT")
            : "Sem licença";


        return ctx.reply(
`╔══════════════════════╗
║ 📋 STATUS LICENÇA
╚══════════════════════╝

Status:
${ativo}

Expira:
${expira}

🐻 URSINHO X BOT V2`
        );

    }

};
