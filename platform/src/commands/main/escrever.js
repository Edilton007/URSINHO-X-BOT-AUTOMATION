const { askAI } = require("../../services/aiService");

module.exports = {

    name: "escrever",
    aliases: ["texto", "criartexto"],
    category: "ia",
    iaGroup: "ferramentas",
    description: "Criar textos com inteligência artificial",

    run: async (sock, m, ctx) => {

        const pedido =
            ctx.args.join(" ").trim();

        if (!pedido) {

            return ctx.reply(
`✍️ *ESCREVER COM IA*

Diz o que queres que eu escreva.

Exemplo:
${ctx.prefix}escrever uma mensagem para divulgar internet Vodacom`
            );

        }

        const prompt = `
Cria um texto com base no pedido abaixo.

Regras:
- Responde em Português de Moçambique.
- Segue exatamente o objetivo do pedido.
- O texto deve ser natural, claro e bem escrito.
- Não inventes informações específicas que não foram fornecidas.
- Não expliques o que fizeste.
- Entrega diretamente o texto pronto para usar.
- Usa emojis apenas quando fizer sentido.

PEDIDO:
${pedido}
        `.trim();

        const resposta =
            await askAI(
                prompt,
                {
                    chat: ctx.chat,
                    sender: ctx.sender,
                    isGroup: ctx.isGroup
                }
            );

        return ctx.reply(
            `✍️ *TEXTO IA*\n\n${resposta}`
        );
    }
};
