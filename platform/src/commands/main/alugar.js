const { status } = require("../../services/rentalService");
const { mensagemAluguer } = require("../../services/licenseMessages");

module.exports = {

    name: "alugar",
    aliases: ["aluguel", "aluguer", "contratar"],
    category: "info",
    description: "Como alugar o bot",

    run: async (sock, m, ctx) => {

        const info = ctx.chat.endsWith("@g.us")
            ? status(ctx.chat)
            : { active: false };

        return ctx.reply(
            mensagemAluguer({
                ativa: info.active,
                expiresAt: info.expiresAt,
                prefix: ctx.prefix
            })
        );
    }
};
