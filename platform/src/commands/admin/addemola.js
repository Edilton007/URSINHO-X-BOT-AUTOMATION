const { setPayment } = require("../../services/salesService");

module.exports = {
    name: "addemola",
    category: "admin-vendas",
    permission: "admin",
    description: "Configurar número eMola",

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
║ 💳 CONFIGURAR eMOLA
╚══════════════════════╝

Uso:
.addemola número nome

Exemplo:
.addemola 861234567 URSINHO

🐻 URSINHO X BOT V2`
            );
        }

        const data = setPayment(
            ctx.chat,
            "emola",
            number,
            name
        );

        return ctx.reply(
`╔══════════════════════╗
║ ✅ eMOLA CONFIGURADO
╚══════════════════════╝

📱 Número:
${data.number}

👤 Nome:
${data.name || "Não definido"}

🏢 Grupo:
${ctx.chat}

🐻 URSINHO X BOT V2`
        );
    }
};
