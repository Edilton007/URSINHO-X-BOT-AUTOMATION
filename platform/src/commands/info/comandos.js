const { loadCommands } = require("../../core/commandLoader");

/*
============================================================
MAPA DE EMOJIS POR CATEGORIA

Só estética — se uma categoria nova aparecer que não está
aqui, cai no emoji padrão (📁) sem quebrar nada.
============================================================
*/

const EMOJI_CATEGORIA = {
    "owner": "👑",
    "admin": "🛡️",
    "admin-grupo": "🛡️",
    "admin-grupo-config": "⚙️",
    "admin-protecao": "🔒",
    "admin-sistema": "🖥️",
    "admin-vendas": "💰",
    "vendas": "💰",
    "ia": "🤖",
    "downloads": "📥",
    "jogos": "🎮",
    "info": "ℹ️",
    "menus": "📋",
    "seguranca": "🔐",
    "principal": "🌐",
    "main": "🌐",
    "outros": "📁"
};

const NOME_CATEGORIA = {
    "owner": "DONO",
    "admin": "ADMINISTRAÇÃO",
    "admin-grupo": "ADMINISTRAÇÃO DO GRUPO",
    "admin-grupo-config": "CONFIGURAÇÃO DO GRUPO",
    "admin-protecao": "PROTEÇÃO",
    "admin-sistema": "SISTEMA",
    "admin-vendas": "VENDAS (ADMIN)",
    "vendas": "VENDAS",
    "ia": "INTELIGÊNCIA ARTIFICIAL",
    "downloads": "DOWNLOADS",
    "jogos": "JOGOS",
    "info": "INFORMAÇÕES",
    "menus": "MENUS",
    "seguranca": "SEGURANÇA",
    "principal": "PRINCIPAL",
    "main": "PRINCIPAL",
    "outros": "OUTROS"
};

module.exports = {

    name: "comandos",
    aliases: [
        "todoscomandos",
        "listacomandos",
        "allcommands"
    ],
    category: "info",
    description: "Lista todos os comandos do bot, organizados por categoria",

    run: async (sock, m, ctx) => {

        try {

            const { categories, commandCount } =
                loadCommands();

            const prefix =
                ctx.prefix || ".";

            const categoriasOrdenadas =
                Object.keys(categories)
                    .sort(
                        (a, b) =>
                            categories[b].length -
                            categories[a].length
                    );

            let texto =
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 📖 TODOS OS COMANDOS 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

Total: ${commandCount} comandos

`;

            for (const categoria of categoriasOrdenadas) {

                const comandos =
                    categories[categoria]
                        .slice()
                        .sort(
                            (a, b) =>
                                a.name.localeCompare(b.name)
                        );

                const emoji =
                    EMOJI_CATEGORIA[categoria] || "📁";

                const nome =
                    NOME_CATEGORIA[categoria] ||
                    categoria.toUpperCase();

                texto +=
`${emoji} *${nome}* (${comandos.length})
`;

                for (const cmd of comandos) {

                    texto +=
`  ➲ ${prefix}${cmd.name}
`;
                }

                texto += "\n";
            }

            texto +=
`🐻 URSINHO X BOT V2`;

            return sock.sendMessage(
                ctx.chat,
                {
                    text: texto
                },
                {
                    quoted: m
                }
            );

        } catch (e) {

            console.log("Erro comandos:", e);

            return ctx.reply(
                `❌ Não foi possível listar os comandos. ⚠️ ${e.message}`
            );
        }
    }

};
