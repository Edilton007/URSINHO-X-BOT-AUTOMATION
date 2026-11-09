const { isOwner } = require("../../services/permissionService");
const {
    publicar,
    textoPronto
} = require("../../services/channelPostService");

module.exports = {

    name: "postarcanal",
    aliases: ["publicarcanal", "canalpost"],
    category: "owner",
    permission: "owner",
    description: "Publicar uma mensagem no canal do WhatsApp",

    run: async (sock, m, ctx) => {

        if (!isOwner(ctx.sender)) {
            return ctx.reply("❌ Apenas o dono pode usar este comando.");
        }

        const entrada = String(ctx.argsTexto ?? (ctx.args || []).join(" ")).trim();

        if (!entrada) {
            return ctx.reply(
`📢 *PUBLICAR NO CANAL*

Escreva o texto a seguir ao comando:
*${ctx.prefix}postarcanal Texto da mensagem*

Ou use um texto pronto:
• *${ctx.prefix}postarcanal online* — anuncia que o bot voltou
• *${ctx.prefix}postarcanal manutencao* — avisa da manutenção

⚠️ Só funciona se o número do bot for dono ou admin do canal.`
            );
        }

        const pronto = textoPronto(entrada.toLowerCase());
        const texto = pronto || entrada;

        const r = await publicar(sock, texto);

        if (!r.ok) {
            return ctx.reply(`❌ Não consegui publicar no canal.\n\nMotivo: ${r.erro}`);
        }

        return ctx.reply("✅ Publicado no canal.");
    }
};
