const { setPayment } = require("../../services/salesService");

module.exports = {
    name: "addbim",
    category: "admin-vendas",
    permission: "admin",
    description: "Configurar número BIM",

    run: async (sock, m, ctx) => {

        if (!ctx.isGroup) {
            return ctx.reply(
                "❌ Este comando só funciona em grupos."
            );
        }

        if (
            ctx.permission !== "admin" &&
            ctx.permission !== "owner"
        ) {
            return ctx.reply(
                "❌ Apenas administradores podem usar este comando."
            );
        }

        const args = ctx.args || [];

        const number = args[0];
        const name = args.slice(1).join(" ");

        if (!number) {
            return ctx.reply(
`╔══════════════════════╗
║ 💳 CONFIGURAR BIM
╚══════════════════════╝

Uso:
.addbim número nome

Exemplo:
.addbim 823456789 URSINHO

🐻 URSINHO X BOT V2`
            );
        }

        const data = setPayment(
            ctx.chat,
            "bim",
            number,
            name
        );

        return ctx.reply(
`╔══════════════════════╗
║ ✅ BIM CONFIGURADO
╚══════════════════════╝

🏦 Número:
${data.number}

👤 Nome:
${data.name || "Não definido"}

🏢 Grupo:
${ctx.chat}

🐻 URSINHO X BOT V2`
        );
    }
};
