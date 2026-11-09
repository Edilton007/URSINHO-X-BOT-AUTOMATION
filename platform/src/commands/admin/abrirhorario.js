const { isAdmin, isOwner } = require("../../services/permissionService");

const {
    definirHorario,
    removerHorario
} = require("../../services/groupScheduleService");

module.exports = {

    name: "abrirhorario",
    aliases: ["horarioabrir"],
    category: "admin-grupo",
    permission: "admin",
    description: "Define a hora em que o grupo abre automaticamente todos os dias",

    run: async (sock, m, ctx) => {

        if (!ctx.isGroup) {
            return ctx.reply("❌ Este comando só funciona em grupos.");
        }

        const dono = isOwner(ctx.sender);
        const admin = await isAdmin(sock, ctx.chat, ctx.sender);

        if (!dono && !admin) {
            return ctx.reply("❌ Apenas administradores podem usar este comando.");
        }

        const argumento = ctx.args.join(" ").trim();

        if (!argumento || argumento.toLowerCase() === "off") {

            const resultado = removerHorario(ctx.chat, "abrir");

            return ctx.reply(
                resultado.sucesso
                    ? "🔓 Horário automático de abertura desligado."
                    : "ℹ️ Não havia nenhum horário de abertura configurado."
            );
        }

        const resultado = definirHorario(sock, ctx.chat, "abrir", argumento);

        if (!resultado.sucesso) {
            return ctx.reply(
                `❌ Hora inválida: "${argumento}"\n\nUsa o formato HH:MM, ex: ${ctx.prefix}abrirhorario 07:00\n\nPara desligar: ${ctx.prefix}abrirhorario off`
            );
        }

        return ctx.reply(
            `🔓 O grupo vai abrir automaticamente todos os dias às *${resultado.hora}*.\n\nPara desligar: ${ctx.prefix}abrirhorario off`
        );
    }
};
