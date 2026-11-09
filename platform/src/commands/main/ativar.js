const { activate } = require("../../services/rentalService");
const {
    mensagemAtivado,
    erroAtivacao
} = require("../../services/licenseMessages");
const watch = require("../../services/licenseWatchService");

module.exports = {

    name: "ativar",
    aliases: ["ativarbot"],
    category: "owner",
    description: "Ativar licença do grupo",

    run: async (sock, m, ctx) => {

        const args = ctx.args || [];

        const code = String(args[0] || "")
            .trim()
            .toUpperCase();


        console.log("===== DEBUG ATIVAR =====");
console.log("CÓDIGO RECEBIDO:", code);
console.log("ctx.chat:", ctx.chat);
console.log("ctx.sender:", ctx.sender);
console.log("ctx.prefix:", ctx.prefix);
console.log("chat termina com @g.us:", String(ctx.chat).endsWith("@g.us"));



        if (!code) {

            return ctx.reply(
`❌ *Falta o código.*

Escreva o comando e o código que recebeu do proprietário.
Exemplo: *${ctx.prefix}ativar UX-ABC1234567*

Ainda não tem código? Escreva *${ctx.prefix}alugar*.`
            );

        }

        if (!String(ctx.chat).endsWith("@g.us")) {

            return ctx.reply(
                "❌ A licença é ativada dentro do grupo. Escreva este comando no grupo que quer ativar."
            );
        }

        const result = activate(
            code,
            ctx.chat
        );

        if (result.error) {

            return ctx.reply(
                erroAtivacao(result.error, ctx.prefix)
            );

        }

        // Recomeça a contagem dos avisos de expiração e informa o dono
        try {
            watch.iniciarRegisto(ctx.chat);
            watch.avisarAtivacao(sock, ctx.chat, result).catch(() => {});
        } catch {}

        return ctx.reply(
            mensagemAtivado({
                expiresAt: result.expiresAt,
                renewed: result.renewed,
                duration: result.duration,
                prefix: ctx.prefix
            })
        );

    }

};
