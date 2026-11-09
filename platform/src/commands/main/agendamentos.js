const schedulerDb = require("../../database/schedulerDb");

function formatarTempoRestante(ms) {

    if (ms <= 0) return "agora";

    const segundos = Math.floor(ms / 1000);
    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);

    if (dias > 0) return `${dias}d`;
    if (horas > 0) return `${horas}h`;
    if (minutos > 0) return `${minutos}m`;
    return `${segundos}s`;
}

module.exports = {
    name: "agendamentos",

    aliases: [
        "listaagendamentos",
        "meusagendamentos"
    ],

    category: "utilidade",

    description: "Ver as mensagens agendadas neste chat",

    run: async (sock, m, ctx) => {

        const lista = schedulerDb.listarPorChat(ctx.chat);

        if (!lista.length) {
            return ctx.reply("📋 Nenhum agendamento pendente neste chat.");
        }

        const texto = lista.map((item, i) => {
            const restante = formatarTempoRestante(item.disparoEm - Date.now());
            return `${i + 1}. *${item.texto.slice(0, 50)}${item.texto.length > 50 ? "..." : ""}*\n   ⏰ Em ${restante}\n   ID: \`${item.id}\``;
        }).join("\n\n");

        return ctx.reply(
            `⌚ *AGENDAMENTOS PENDENTES*\n\n${texto}\n\n_Usa ${ctx.prefix}cancelaragendamento <ID> pra cancelar._`
        );
    }
};
