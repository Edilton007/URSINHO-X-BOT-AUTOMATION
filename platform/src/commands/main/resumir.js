const { askAI } = require("../../services/aiService");

module.exports = {

    name: "resumir",
    aliases: ["resumo", "sumario"],
    category: "ia",
    iaGroup: "ferramentas",
    description: "Resumir textos com inteligência artificial",

    run: async (sock, m, ctx) => {

        const texto =
            ctx.args.join(" ").trim();

        if (!texto) {

            return ctx.reply(
`📝 *RESUMIR TEXTO*

Envia o texto que queres resumir.

Exemplo:
${ctx.prefix}resumir A inteligência artificial está a transformar...`
            );

        }

        const prompt = `
Resume o texto abaixo em Português de Moçambique.

Regras:
- Mantém apenas as informações mais importantes.
- Não inventes informações.
- Sê claro e direto.
- Usa linguagem natural.
- Não digas que estás a resumir.
- Entrega apenas o resumo.

TEXTO:
${texto}
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
            `📝 *RESUMO IA*\n\n${resposta}`
        );
    }
};
