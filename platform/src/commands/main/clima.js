const { getClima } = require("../../services/weatherService");

module.exports = {
    name: "clima",

    aliases: [
        "tempo",
        "temperatura"
    ],

    category: "ia",
    iaGroup: "ferramentas",

    description: "Consulta o clima/tempo real e atual de uma cidade",

    run: async (sock, m, ctx) => {

        const local = ctx.args.join(" ").trim() || "Maputo";

        await ctx.reply(`🌦️ *A consultar o clima de ${local}...*`);

        try {

            const resultado = await getClima(local);

            return ctx.reply(
`╭━━━〔 🌦️ CLIMA 〕━━━╮
┃
┃ ${resultado.split("\n").join("\n┃ ")}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
🐻 URSINHO X BOT V2`
            );

        } catch (error) {
            console.error(
                "Erro no comando clima:",
                error?.message || error
            );
            return ctx.reply(
                "❌ Não consegui obter o clima agora, tenta mais tarde."
            );
        }
    }
};
