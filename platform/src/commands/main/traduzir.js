const {
    translateText,
    normalizeLanguage,
    getLanguages
} = require("../../services/translationService");

module.exports = {

    name: "traduzir",

    aliases: [
        "traducao",
        "traduz"
    ],

    category: "ia",
    iaGroup: "ferramentas",

    description: "Traduzir texto para vários idiomas",

    run: async (sock, m, ctx) => {

        const args = [...ctx.args];

        if (!args.length) {
            return ctx.reply(
`🌍 *URSINHO TRADUTOR*

Traduz textos para vários idiomas.

Uso:
${ctx.prefix}traduzir <idioma> <texto>

Exemplos:
${ctx.prefix}traduzir en Olá, como estás?
${ctx.prefix}traduzir fr Bom dia
${ctx.prefix}traduzir ja Olá

Também podes responder a uma mensagem:

${ctx.prefix}traduzir en

Para ver os idiomas disponíveis:
${ctx.prefix}traduzir idiomas`
            );
        }

        const primeira = String(args[0])
            .trim()
            .toLowerCase();

        if (
            primeira === "idiomas" ||
            primeira === "idioma" ||
            primeira === "languages"
        ) {

            const languages = getLanguages();

            const flags = {
                pt: "🇵🇹",
                en: "🇬🇧",
                es: "🇪🇸",
                fr: "🇫🇷",
                de: "🇩🇪",
                it: "🇮🇹",
                nl: "🇳🇱",
                ru: "🇷🇺",
                uk: "🇺🇦",
                pl: "🇵🇱",
                tr: "🇹🇷",
                ar: "🇸🇦",
                hi: "🇮🇳",
                zh: "🇨🇳",
                ja: "🇯🇵",
                ko: "🇰🇷",
                id: "🇮🇩",
                vi: "🇻🇳",
                th: "🇹🇭",
                sw: "🌍"
            };

            const lista = Object.entries(languages)
                .map(
                    ([code, name]) =>
                        `${flags[code] || "🌐"} ${code} — ${name}`
                )
                .join("\n");

            return ctx.reply(
`🌍 *IDIOMAS DISPONÍVEIS*

${lista}

Exemplo:
${ctx.prefix}traduzir en Olá, tudo bem?`
            );
        }

        const language = normalizeLanguage(args.shift());

        if (!language) {
            return ctx.reply(
`❌ *Idioma não suportado.*

Use:
${ctx.prefix}traduzir idiomas

para ver todos os idiomas disponíveis.`
            );
        }

        let text = args.join(" ").trim();

        /*
         * Verifica se o comando está respondendo
         * a uma mensagem.
         */
        if (!text) {

            const quoted =
                m?.message?.extendedTextMessage
                    ?.contextInfo
                    ?.quotedMessage;

            if (quoted) {

                const messageService =
                    require("../../services/messageService");

                text =
                    messageService.extractText(quoted)
                        ?.trim() || "";
            }
        }

        if (!text) {
            return ctx.reply(
`❌ *Nenhum texto encontrado.*

Escreve o texto depois do idioma ou responde a uma mensagem.

Exemplo:
${ctx.prefix}traduzir en Bom dia`
            );
        }

        const result =
            await translateText(
                text,
                language
            );

        if (!result.ok) {
            return ctx.reply(
                `❌ ${result.error}`
            );
        }

        return ctx.reply(
`🌍 *TRADUÇÃO*

${result.text}

🔤 ${result.languageName}`
        );
    }
};
