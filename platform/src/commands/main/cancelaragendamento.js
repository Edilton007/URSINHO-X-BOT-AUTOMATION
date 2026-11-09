const schedulerDb = require("../../database/schedulerDb");

module.exports = {
    name: "cancelaragendamento",

    aliases: [
        "cancelaragenda",
        "cancelaragendar"
    ],

    category: "utilidade",

    description: "Cancelar uma mensagem agendada",

    run: async (sock, m, ctx) => {

        const id = ctx.args[0];

        if (!id) {
            return ctx.reply(
                `❌ Uso: ${ctx.prefix}cancelaragendamento <ID>\n\nUsa *${ctx.prefix}agendamentos* pra ver os IDs.`
            );
        }

        // Só permite cancelar agendamentos deste mesmo chat,
        // pra ninguém cancelar agendamento de outro grupo
        const pendentesDoChat = schedulerDb.listarPorChat(ctx.chat);
        const pertenceAoChat = pendentesDoChat.some(item => item.id === id);

        if (!pertenceAoChat) {
            return ctx.reply("⚠️ Não encontrei esse agendamento neste chat.");
        }

        const removido = schedulerDb.remover(id);

        return ctx.reply(
            removido
                ? "✅ Agendamento cancelado."
                : "⚠️ Não foi possível cancelar (já pode ter sido enviado)."
        );
    }
};
