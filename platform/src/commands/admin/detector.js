const {
    isDetectorEnabled,
    setDetectorEnabled
} = require("../../services/salesService");

module.exports = {
    name: "detector",

    aliases: ["detectorcomprovativo"],

    category: "admin",

    permission: "admin",

    description: "Liga ou desliga o detector de comprovativos",

    run: async (sock, m, ctx) => {

        /* ============================================================
           SOMENTE GRUPO
        ============================================================ */

        if (!ctx.isGroup) {
            return ctx.reply(
                "❌ Este comando só pode ser usado em grupos."
            );
        }

        /* ============================================================
           SOMENTE ADMIN / DONO
        ============================================================ */

        if (
            ctx.permission !== "admin" &&
            ctx.permission !== "owner"
        ) {
            return ctx.reply(
                "🚫 Apenas administradores podem configurar o detector."
            );
        }

        /* ============================================================
           ARGUMENTO
        ============================================================ */

        const option = String(
            ctx.args?.[0] || ""
        ).toLowerCase();

        /* ============================================================
           STATUS ATUAL
        ============================================================ */

        const active = isDetectorEnabled(ctx.chat);

        /* ============================================================
           SEM ARGUMENTO / AJUDA
        ============================================================ */

        if (
            !option ||
            !["on", "off"].includes(option)
        ) {
            return ctx.reply(
`╭━━━〔 🛡️ DETECTOR 〕━━━╮
┃
┃ 📡 DETECTOR DE COMPROVATIVOS
┃
┃ STATUS
┃ ┗ ${active ? "🟢 ATIVO" : "🔴 DESATIVADO"}
┃
┃ USO
┃ ├ ${ctx.prefix}detector on
┃ ┗ ${ctx.prefix}detector off
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
            );
        }

        /* ============================================================
           ATIVAR
        ============================================================ */

        if (option === "on") {

            if (active) {
                return ctx.reply(
`╭━━━〔 🛡️ DETECTOR 〕━━━╮
┃
┃ ℹ️ O detector já está
┃ 🟢 ATIVO neste grupo.
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                );
            }

            setDetectorEnabled(
                ctx.chat,
                true
            );

            return ctx.reply(
`╭━━━〔 🛡️ DETECTOR 〕━━━╮
┃
┃ ✅ DETECTOR ATIVADO
┃
┃ 🟢 O detector de comprovativos
┃ está agora ativo neste grupo.
┃
┃ 📱 M-Pesa
┃ 💳 eMola
┃
┃ 🔎 Os comprovativos enviados
┃ serão analisados automaticamente.
┃
╰━━━〔 💎 URSINHO X BOT 〕━━━╯`
            );
        }

        /* ============================================================
           DESATIVAR
        ============================================================ */

        if (option === "off") {

            if (!active) {
                return ctx.reply(
`╭━━━〔 🛡️ DETECTOR 〕━━━╮
┃
┃ ℹ️ O detector já está
┃ 🔴 DESATIVADO neste grupo.
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                );
            }

            setDetectorEnabled(
                ctx.chat,
                false
            );

            return ctx.reply(
`╭━━━〔 🛡️ DETECTOR 〕━━━╮
┃
┃ 🔴 DETECTOR DESATIVADO
┃
┃ O bot não irá analisar
┃ comprovativos automaticamente
┃ neste grupo.
┃
╰━━━〔 💎 URSINHO X BOT 〕━━━╯`
            );
        }
    }
};
