const {
    searchMusic
} = require("../../services/musicSearchService");

const {
    sendCarousel
} = require("../../lib/interactiveMenu");

module.exports = {

    name: "play",

    aliases: [
        "musica",
        "music",
        "play2"
    ],

    category: "downloads",

    description: "Pesquisar música e escolher o formato para baixar",

    run: async (sock, m, ctx) => {

        const query = ctx.args
            .join(" ")
            .trim();

        /* ============================================================
           SEM PESQUISA
        ============================================================ */

        if (!query) {
            return ctx.reply(
                `🎵 *PLAY — PESQUISAR MÚSICA*

Escreve o nome da música e, de preferência, o artista.

Exemplos:
${ctx.prefix}play Blinding Lights The Weeknd
${ctx.prefix}play Shape of You Ed Sheeran
${ctx.prefix}play Calm Down Rema
${ctx.prefix}play Starboy The Weeknd

🐻 URSINHO X BOT V2`
            );
        }

        /* ============================================================
           AVISO
        ============================================================ */

        await ctx.reply(
            `🎵 *A procurar músicas...*

🔎 ${query}

⏳ Aguarda um momento...`
        );

        try {

            console.log("================================");
            console.log("🎵 PLAY — PESQUISA");
            console.log("🔎 Pesquisa:", query);
            console.log("================================");

            /* ========================================================
               PESQUISAR 5 RESULTADOS
            ======================================================== */

            const results = await searchMusic(
                query,
                5
            );

            if (
                !Array.isArray(results) ||
                !results.length
            ) {
                return ctx.reply(
                    `😔 *Nenhuma música encontrada.*

🔎 Pesquisa: ${query}

Tenta escrever o nome da música juntamente com o artista.`
                );
            }

            console.log(
                `🎵 Resultados encontrados: ${results.length}`
            );

            /* ========================================================
               FILTRAR RESULTADOS
            ======================================================== */

            const validResults = results
                .filter(
                    result =>
                        result &&
                        result.id
                )
                .slice(0, 5);

            if (!validResults.length) {
                throw new Error(
                    "Os resultados encontrados não possuem Track ID."
                );
            }

            console.log(
                `✅ Resultados válidos: ${validResults.length}`
            );

            /* ========================================================
               CRIAR CARDS PREMIUM
            ======================================================== */

            const cards =
                validResults.map(
                    (result, index) => {

                        const trackId =
                            String(result.id);

                        const title =
                            result.title ||
                            "Sem título";

                        const artist =
                            result.artist ||
                            "Artista desconhecido";

                        const duration =
                            result.duration !== null &&
                            result.duration !== undefined
                                ? formatDuration(
                                    result.duration
                                )
                                : "—";

                        const coverUrl =
                            result.coverUrl ||
                            null;

                        console.log(
                            `🎵 Card ${index + 1}:`,
                            title,
                            "|",
                            artist,
                            "| ID:",
                            trackId,
                            "| Capa:",
                            coverUrl
                                ? "SIM"
                                : "NÃO"
                        );

                        return {

                            /* ====================================================
                               CAPA
                            ==================================================== */

                            imageUrl:
                                coverUrl,

                            /* ====================================================
                               CABEÇALHO
                            ==================================================== */

                            title:
                                `🎵 ${title}`,

                            subtitle:
                                `👤 ${artist} • ⏱️ ${duration}`,

                            /* ====================================================
                               CONTEÚDO LIMPO
                            ==================================================== */

                            text:
                                `🎵 *${title}*\n` +
                                `👤 ${artist}\n` +
                                `⏱️ ${duration}`,

                            /* ====================================================
                               FOOTER LIMPO
                            ==================================================== */

                            footer:
                                "Escolhe o formato",

                            /* ====================================================
                               BOTÕES
                            ==================================================== */

                            buttons: [

                                {
                                    name:
                                        "quick_reply",

                                    params: {
                                        display_text:
                                            "🎵 MP3",

                                        id:
                                            `${ctx.prefix}ytmp3 --id ${trackId}`
                                    }
                                },

                                {
                                    name:
                                        "quick_reply",

                                    params: {
                                        display_text:
                                            "🎬 MP4",

                                        id:
                                            `${ctx.prefix}ytmp4 --id ${trackId}`
                                    }
                                },

                                {
                                    name:
                                        "quick_reply",

                                    params: {
                                        display_text:
                                            "📄 DOC",

                                        id:
                                            `${ctx.prefix}ytdoc --id ${trackId}`
                                    }
                                }

                            ]
                        };
                    }
                );

            /* ========================================================
               CAROUSEL
            ======================================================== */

            console.log("================================");
            console.log("🎠 ENVIANDO PLAY CAROUSEL");
            console.log(
                "🎵 Cards:",
                cards.length
            );
            console.log("================================");

            await sendCarousel(
                sock,
                ctx.chat,
                {
                    text:
                        `🎼 *RESULTADOS*\n` +
                        `🔎 ${query}`,

                    footer:
                        `🐻 URSINHO X BOT V2 • ${cards.length} opções`,

                    cards
                },
                m
            );

            console.log(
                "✅ PLAY CAROUSEL enviado com sucesso."
            );

        } catch (error) {

            console.error(
                "❌ Erro no comando play:"
            );

            console.error(
                error?.message ||
                error
            );

            console.error(
                error?.stack ||
                ""
            );

            return ctx.reply(
                `❌ *Não foi possível pesquisar as músicas.*

🔎 Pesquisa: ${query}

Tenta novamente.`
            );
        }
    }
};


/* ============================================================
   FORMATAR DURAÇÃO
============================================================ */

function formatDuration(seconds) {

    if (
        seconds === null ||
        seconds === undefined
    ) {
        return "—";
    }

    seconds =
        Number(seconds);

    if (
        !Number.isFinite(
            seconds
        )
    ) {
        return "—";
    }

    const min =
        Math.floor(
            seconds / 60
        );

    const sec =
        Math.floor(
            seconds % 60
        );

    return (
        `${min}:${String(sec).padStart(2, "0")}`
    );
}
