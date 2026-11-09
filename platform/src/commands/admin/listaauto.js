const autoResponderDb = require("../../database/autoresponderDb");

module.exports = {
    name: "listaauto",

    aliases: [
        "lista-auto-responder",
        "listautoresponder",
        "autolist"
    ],

    category: "admin-grupo",

    description: "Ver todos os termos do auto-responder",

    run: async (sock, m, ctx) => {

        if (!ctx.isGroup) {
            return ctx.reply("❌ Este comando só funciona em grupos.");
        }

        const itens = autoResponderDb.listar(ctx.chat);

        if (!itens.length) {
            return ctx.reply(
                `📋 Nenhum termo cadastrado ainda.\n\nUsa *${ctx.prefix}addauto* pra adicionar.`
            );
        }

        const ativo = autoResponderDb.isAtivo(ctx.chat);

        const texto = itens.map((item, i) =>
            `${i + 1}. *${item.termosOriginais.join(", ")}*\n   ↳ ${item.resposta.slice(0, 60)}${item.resposta.length > 60 ? "..." : ""}`
        ).join("\n\n");

        return ctx.reply(
`🤖 *AUTO-RESPONDER* (${ativo ? "🟢 Ativado" : "🔴 Desativado"})

${texto}

Usa *${ctx.prefix}delauto <número>* pra remover algum.`
        );
    }
};
