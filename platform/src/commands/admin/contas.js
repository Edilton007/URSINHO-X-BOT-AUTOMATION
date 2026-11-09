const { getPayments } = require("../../services/salesService");

module.exports = {
    name: "contas",
    category: "admin-vendas",
    permission: "admin",
    description: "Ver contas de pagamento",

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

        const pay = getPayments(ctx.chat);

        return ctx.reply(
`╔══════════════════════╗
║ 💳 CONTAS DE PAGAMENTO
╚══════════════════════╝

💳 M-Pesa:
📱 ${pay.mpesa.number || "Não configurado"}
👤 ${pay.mpesa.name || "—"}

💳 eMola:
📱 ${pay.emola.number || "Não configurado"}
👤 ${pay.emola.name || "—"}

🏦 BIM:
📱 ${pay.bim.number || "Não configurado"}
👤 ${pay.bim.name || "—"}

🐻 URSINHO X BOT V2`
        );
    }
};
