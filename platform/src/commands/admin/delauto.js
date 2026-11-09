const autoResponderDb = require("../../database/autoresponderDb");

const {
    isAdmin,
    isOwner
} = require("../../services/permissionService");

module.exports = {
    name: "delauto",

    aliases: [
        "del-auto-responder",
        "delautoresponder",
        "removeauto"
    ],

    category: "admin-grupo",

    permission: "admin",

    description: "Remover um termo do auto-responder",

    run: async (sock, m, ctx) => {

        if (!ctx.isGroup) {
            return ctx.reply("❌ Este comando só funciona em grupos.");
        }

        const dono = isOwner(ctx.sender);
        const admin = await isAdmin(sock, ctx.chat, ctx.sender);

        if (!dono && !admin) {
            return ctx.reply(
                "❌ Apenas administradores podem usar este comando."
            );
        }

        const alvo = ctx.args.join(" ").trim();

        if (!alvo) {
            return ctx.reply(
`❌ Uso: ${ctx.prefix}delauto <termo ou número>

Usa *${ctx.prefix}listaauto* pra ver os números.`
            );
        }

        const resultado = autoResponderDb.remover(ctx.chat, alvo);

        if (!resultado.sucesso) {
            return ctx.reply("⚠️ Não encontrei esse termo/número na lista.");
        }

        return ctx.reply(
            `✅ Removido: ${resultado.item.termosOriginais.join(", ")}`
        );
    }
};
