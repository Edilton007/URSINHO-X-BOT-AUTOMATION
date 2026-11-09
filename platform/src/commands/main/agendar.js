const {
    agendar
} = require("../../services/schedulerService");

module.exports = {
    name: "agendar",

    aliases: [
        "agendar-mensagem",
        "agendarmensagem"
    ],

    category: "utilidade",

    description: "Agendar uma mensagem pra ser enviada depois de um tempo",

    run: async (sock, m, ctx) => {

        const fullArgs = ctx.args.join(" ");
        const partes = fullArgs.split(" / ");

        if (partes.length !== 2 || !partes[0].trim() || !partes[1].trim()) {
            return ctx.reply(
`❌ *Formato incorreto.*

Uso:
${ctx.prefix}agendar mensagem / tempo

Exemplo:
${ctx.prefix}agendar Reunião amanhã / 10m

Tempo aceita: *s* (segundos), *m* (minutos), *h* (horas), *d* (dias)
Ex: 30s, 10m, 2h, 1d`
            );
        }

        const mensagem = partes[0].trim();
        const tempoTexto = partes[1].trim();

        const resultado = agendar(
            sock, ctx.chat, mensagem, ctx.sender, tempoTexto
        );

        if (!resultado.sucesso) {

            if (resultado.motivo === "tempo_invalido") {
                return ctx.reply(
`❌ Tempo inválido.

Usa: *10s*, *5m*, *2h*, *1d*`
                );
            }

            return ctx.reply("❌ Mensagem inválida.");
        }

        return ctx.reply(
            `⌚ Mensagem agendada para daqui a *${tempoTexto}*.\n\nID: \`${resultado.item.id}\`\n\n_Usa ${ctx.prefix}agendamentos pra ver todos, ou ${ctx.prefix}cancelaragendamento ${resultado.item.id} pra cancelar._`
        );
    }
};
