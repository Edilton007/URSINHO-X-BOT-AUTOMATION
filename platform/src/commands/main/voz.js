const {
    temTtsConfigurado,
    getVozesDisponiveis,
    vozValida
} = require("../../services/ttsService");

const { isAdmin, isOwner } = require("../../services/permissionService");

const db = require("../../database/database");

module.exports = {
    name: "voz",

    aliases: [
        "vozes",
        "trocarvoz"
    ],

    category: "ia",
    iaGroup: "inteligencia",

    description: "Lista ou troca a voz usada pelo .falar/Chat IA neste chat",

    run: async (sock, m, ctx) => {

        if (!temTtsConfigurado()) {
            return ctx.reply(
                "❌ O recurso de voz não está configurado (falta a GEMINI_API_KEY)."
            );
        }

        const nomeEscolhido = ctx.args.join(" ").trim();

        const vozes = getVozesDisponiveis();
        const vozAtual = db.getVoice(ctx.chat) || "Kore (padrão)";

        // Sem argumento -> mostra a lista e a voz atual
        if (!nomeEscolhido) {

            const lista = Object.entries(vozes)
                .map(([nome, estilo]) => `┃ • ${nome} — ${estilo}`)
                .join("\n");

            return ctx.reply(
`╭━━━〔 🎙️ VOZES 〕━━━╮
┃
┃ Voz atual deste chat:
┃ ${vozAtual}
┃
┃ VOZES DISPONÍVEIS:
${lista}
┃
┃ Para trocar, usa:
┃ ${ctx.prefix}voz NomeDaVoz
┃
┃ Exemplo:
┃ ${ctx.prefix}voz Puck
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
🐻 URSINHO X BOT V2`
            );
        }

        // Em grupo, só admin/dono pode trocar a voz de todos
        if (ctx.isGroup) {

            const dono = isOwner(ctx.sender);
            const admin = await isAdmin(sock, ctx.chat, ctx.sender);

            if (!dono && !admin) {
                return ctx.reply(
                    "🚫 Apenas administradores podem trocar a voz do grupo."
                );
            }
        }

        const vozEncontrada = vozValida(nomeEscolhido);

        if (!vozEncontrada) {
            return ctx.reply(
                `❌ Voz "${nomeEscolhido}" não existe.\n\nUsa ${ctx.prefix}voz para ver a lista de vozes disponíveis.`
            );
        }

        db.setVoice(ctx.chat, vozEncontrada);

        return ctx.reply(
`╭━━━〔 🎙️ VOZES 〕━━━╮
┃
┃ ✅ Voz alterada!
┃
┃ Nova voz: ${vozEncontrada} (${vozes[vozEncontrada]})
┃
┃ Já se aplica ao .falar e ao
┃ Chat IA neste chat.
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
🐻 URSINHO X BOT V2`
        );
    }
};
