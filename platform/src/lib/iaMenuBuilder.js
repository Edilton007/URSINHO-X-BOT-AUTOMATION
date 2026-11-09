/*
============================================================
URSINHO X BOT V2
IA MENU BUILDER
LAYOUT PREMIUM COMPACTO
============================================================
*/

function buildIAMenu(prefix = "!", categories = {}) {

    const comandos = Array.isArray(categories?.ia)
        ? categories.ia
        : [];

    /*
    ========================================================
    GRUPOS IA
    ========================================================
    */

    const grupos = {

        inteligencia: {
            titulo: "🧠 𝐈𝐍𝐓𝐄𝐋𝐈𝐆Ê𝐍𝐂𝐈𝐀"
        },

        ferramentas: {
            titulo: "✨ 𝐅𝐄𝐑𝐑𝐀𝐌𝐄𝐍𝐓𝐀𝐒 𝐈𝐀"
        },

        imagens: {
            titulo: "🖼️ 𝐈𝐌𝐀𝐆𝐄𝐍𝐒"
        }

    };

    /*
    ========================================================
    DESCRIÇÕES
    ========================================================
    */

    const descricoes = {

        ai: "Conversar com IA",

        chat: "Ativar ou desativar Chat IA",

        gemini: "Conversar com Gemini",

        escrever: "Criar textos com IA",

        ler: "Analisar imagens",

        resumir: "Resumir textos",

        traduzir: "Traduzir textos",

        imagem: "Pesquisar imagens"

    };

    /*
    ========================================================
    BOTÕES
    APENAS AÇÕES RÁPIDAS
    ========================================================
    */

    const botoesPermitidos = new Set([
        "ai",
        "chat",
        "gemini"
    ]);

    const buttons = [];

    /*
    ========================================================
    CABEÇALHO
    ========================================================
    */

    const linhas = [

        "🤖 𝐌𝐄𝐍𝐔 𝐈𝐀",

        "",

        "𝐈𝐍𝐓𝐄𝐋𝐈𝐆Ê𝐍𝐂𝐈𝐀 𝐀𝐑𝐓𝐈𝐅𝐈𝐂𝐈𝐀𝐋"

    ];

    /*
    ========================================================
    CONSTRUÇÃO DOS GRUPOS
    ========================================================
    */

    for (const [grupo, config] of Object.entries(grupos)) {

        const lista = comandos.filter(
            cmd => cmd?.iaGroup === grupo
        );

        if (!lista.length) {
            continue;
        }

        linhas.push(
            "",
            config.titulo
        );

        for (const cmd of lista) {

            const nome = String(cmd.name || "").trim();

            if (!nome) {
                continue;
            }

            const descricao =
                descricoes[nome] ||
                String(cmd.description || "").trim();

            linhas.push(
                `├ ${prefix}${nome}` +
                (descricao ? ` — ${descricao}` : "")
            );

            /*
            ------------------------------------------------
            BOTÕES RÁPIDOS
            ------------------------------------------------
            */

            if (botoesPermitidos.has(nome)) {

                const nomesBotao = {

                    ai: "🤖 CONVERSAR COM IA",

                    chat: "💬 CHAT IA",

                    gemini: "✨ GEMINI"

                };

                buttons.push({

                    texto:
                        nomesBotao[nome] ||
                        `🤖 ${nome.toUpperCase()}`,

                    id:
                        `${prefix}${nome}`

                });

            }

        }

    }

    /*
    ========================================================
    NAVEGAÇÃO
    ========================================================
    */

    buttons.push({
        texto: "🏠 MENU PRINCIPAL",
        id: `${prefix}menu`
    });

    /*
    ========================================================
    RESULTADO
    ========================================================
    */

    return {

        texto: linhas.join("\n"),

        buttons

    };

}


/*
============================================================
EXPORTS
============================================================
*/

module.exports = {

    buildIAMenu

};
