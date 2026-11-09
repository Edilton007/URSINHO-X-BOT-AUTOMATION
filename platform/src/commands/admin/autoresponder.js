const autoResponderDb = require("../../database/autoresponderDb");

const {
    isAdmin,
    isOwner
} = require("../../services/permissionService");

module.exports = {
    name: "autoresponder",

    aliases: [
        "auto-responder",
        "autoresposta"
    ],

    category: "admin-grupo",

    permission: "admin",

    description: "Ativar ou desativar o auto-responder no grupo",

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

        const opcao = String(ctx.args[0] || "").toLowerCase();

        if (opcao === "on") {
            autoResponderDb.setAtivo(ctx.chat, true);
            return ctx.reply("✅ Auto-responder *ativado* neste grupo.");
        }

        if (opcao === "off") {
            autoResponderDb.setAtivo(ctx.chat, false);
            return ctx.reply("🔴 Auto-responder *desativado* neste grupo.");
        }

        const ativo = autoResponderDb.isAtivo(ctx.chat);
        const total = autoResponderDb.listar(ctx.chat).length;

        return ctx.reply(
`🤖 *AUTO-RESPONDER*

Estado: ${ativo ? "🟢 Ativado" : "🔴 Desativado"}
Termos cadastrados: ${total}

${ctx.prefix}autoresponder on/off — ligar/desligar
${ctx.prefix}addauto — adicionar termo
${ctx.prefix}delauto — remover termo
${ctx.prefix}listaauto — ver todos os termos`
        );
    }
};
