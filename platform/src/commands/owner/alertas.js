const alertas = require("../../services/alertService");

module.exports = {

    name: "alertas",
    aliases: ["alerta"],
    category: "owner",
    permission: "owner",
    description: "Ver últimos alertas ou testar o aviso ao dono",

    run: async (sock, m, ctx) => {

        const acao = String(ctx.args[0] || "").toLowerCase();

        if (acao === "teste") {

            const enviado = await alertas.alertar({
                chave: `teste:${Date.now()}`,
                titulo: "✅ Teste de alerta: se recebeste isto no privado, os avisos estão a funcionar.",
                cooldownMin: 0
            });

            return ctx.reply(
                enviado
                    ? "✅ Alerta de teste enviado no teu privado."
                    : "⚠️ Não consegui enviar. Confirma o OWNER no .env e que já falaste com o bot no privado."
            );
        }

        const lista = alertas.ultimosAlertas();

        if (!lista.length) {
            return ctx.reply(
`🔔 *ALERTAS DO BOT*

Nenhum alerta desde o último arranque. 👍

Usa *${ctx.prefix}alertas teste* para confirmar que os avisos chegam ao teu privado.`
            );
        }

        return ctx.reply(
`🔔 *ÚLTIMOS ALERTAS*

${lista.map((a, i) => `${i + 1}. ${a.titulo}\n   🕐 ${a.quando}`).join("\n\n")}`
        );
    }
};
