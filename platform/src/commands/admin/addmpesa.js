const { setPayment } = require("../../services/salesService");

module.exports = {
    name: "addmpesa",
    category: "admin-vendas",
    permission: "admin",
    description: "Configurar número M-Pesa",

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
║ 💳 CONFIGURAR M-PESA
╚══════════════════════╝

Uso:
.addmpesa número nome

Exemplo:
.addmpesa 841234567 URSINHO

🐻 URSINHO X BOT V2`
            );
        }

        const data = setPayment(
            ctx.chat,
            "mpesa",
            number,
            name
        );

        return ctx.reply(
`╔══════════════════════╗
║ ✅ M-PESA CONFIGURADO
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
