const fs = require("fs");
const path = require("path");

const {
    searchYouTube,
    downloadMp4
} = require("../../services/musicDownloadService");

const {
    searchMusic,
    getMusicById
} = require("../../services/musicSearchService");

module.exports = {

    name: "ytmp4",

    aliases: [
        "video"
    ],

    category: "downloads",

    description: "Baixar vídeo YouTube em MP4",

    run: async (sock, m, ctx) => {

        const args = [...ctx.args];

        let trackId = null;

        /*
        ========================================================
        ACEITAR:
        !ytmp4 --id 123456
        ========================================================
        */

        if (
            args[0] &&
            args[0].toLowerCase() === "--id"
        ) {
            trackId = args[1] || null;
            args.splice(0, 2);
        }

        const query = args
            .join(" ")
            .trim();

        /*
        ========================================================
        SEM PESQUISA / ID
        ========================================================
        */

        if (!query && !trackId) {

            return ctx.reply(
                `🎬 *YTMP4 — BAIXAR VÍDEO*

Escreve o nome da música ou usa o ID.

Exemplos:
${ctx.prefix}ytmp4 Calm Down Rema
${ctx.prefix}ytmp4 --id 1614063459

🐻 URSINHO X BOT V2`
            );

        }

        await ctx.reply(
            `🎬 *A preparar o MP4...*

🔎 Pesquisa: ${
                trackId
                    ? `música ID ${trackId}`
                    : query
            }

⏳ Aguarda um momento...`
        );

        try {

            console.log("================================");
            console.log("🎬 YTMP4");
            console.log(
                "🔎 Pesquisa:",
                trackId
                    ? `música ID ${trackId}`
                    : query
            );
            console.log("================================");

            /*
            ====================================================
            OBTER MÚSICA
            ====================================================
            */

            let result = null;

            if (trackId) {

                console.log(
                    "🆔 Procurando música pelo Track ID:",
                    trackId
                );

                result = await getMusicById(
                    trackId
                );

            } else {

                console.log(
                    "🔎 Procurando música:",
                    query
                );

                const results =
                    await searchMusic(
                        query,
                        5
                    );

                if (
                    results &&
                    results.length
                ) {
                    result = results[0];
                }

            }

            /*
            ====================================================
            VALIDAR RESULTADO
            ====================================================
            */

            if (!result) {

                throw new Error(
                    "Música não encontrada."
                );

            }

            const title =
                result.title ||
                "Vídeo";

            const artist =
                result.artist ||
                "";

            const duration =
                result.duration ||
                null;

            console.log(
                "🆔 Track ID:",
                result.id || trackId || "N/A"
            );

            console.log(
                "🎵 Título:",
                title
            );

            console.log(
                "👤 Artista:",
                artist
            );

            /*
            ====================================================
            PESQUISAR NO YOUTUBE
            ====================================================
            */

            const youtubeQuery =
                `${title} ${artist}`.trim();

            console.log(
                "🔎 YouTube:",
                youtubeQuery
            );

            const youtube =
                await searchYouTube(
                    youtubeQuery,
                    duration
                );

            if (
                !youtube ||
                !youtube.url
            ) {

                throw new Error(
                    "Não foi encontrado vídeo correspondente no YouTube."
                );

            }

            console.log(
                "🎯 YouTube escolhido:",
                youtube.title
            );

            console.log(
                "🔗 URL:",
                youtube.url
            );

            /*
            ====================================================
            NOME DO ARQUIVO
            ====================================================
            */

            const safeTitle =
                String(title)
                    .replace(
                        /[<>:"/\\|?*\x00-\x1F]/g,
                        ""
                    )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim()
                    .slice(0, 150);

            const safeArtist =
                String(artist)
                    .replace(
                        /[<>:"/\\|?*\x00-\x1F]/g,
                        ""
                    )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim()
                    .slice(0, 100);

            const fileName =
                safeArtist
                    ? `${safeTitle} - ${safeArtist}.mp4`
                    : `${safeTitle}.mp4`;

            /*
            ====================================================
            DIRETÓRIO
            ====================================================
            */

            const downloadDir =
                path.join(
                    process.cwd(),
                    "downloads"
                );

            if (
                !fs.existsSync(
                    downloadDir
                )
            ) {

                fs.mkdirSync(
                    downloadDir,
                    {
                        recursive: true
                    }
                );

            }

            const outputPath =
                path.join(
                    downloadDir,
                    fileName
                );

            /*
            ====================================================
            DOWNLOAD MP4
            ====================================================
            */

            console.log(
                "⬇️ Baixando MP4..."
            );

            await downloadMp4(
                youtube.url,
                outputPath
            );

            console.log(
                "✅ MP4 baixado:",
                outputPath
            );

            /*
            ====================================================
            VALIDAR ARQUIVO
            ====================================================
            */

            if (
                !fs.existsSync(
                    outputPath
                )
            ) {

                throw new Error(
                    "O arquivo MP4 não foi criado."
                );

            }

            const stats =
                fs.statSync(
                    outputPath
                );

            if (
                !stats.size
            ) {

                throw new Error(
                    "O arquivo MP4 está vazio."
                );

            }

            console.log(
                "📦 Tamanho:",
                stats.size,
                "bytes"
            );

            /*
            ====================================================
            ENVIAR VÍDEO
            ====================================================
            */

            const video =
                fs.readFileSync(
                    outputPath
                );

            await sock.sendMessage(
                ctx.chat,
                {
                    video,

                    mimetype:
                        "video/mp4",

                    fileName,

                    caption:
                        `🎬 *${title}*\n` +
                        `👤 ${artist || "Artista desconhecido"}`
                },
                {
                    quoted: m
                }
            );

            console.log(
                "✅ MP4 enviado:",
                fileName
            );

            /*
            ====================================================
            LIMPAR TEMPORÁRIO
            ====================================================
            */

            try {

                if (
                    fs.existsSync(
                        outputPath
                    )
                ) {

                    fs.unlinkSync(
                        outputPath
                    );

                    console.log(
                        "🧹 MP4 temporário removido."
                    );

                }

            } catch (
                cleanupError
            ) {

                console.error(
                    "⚠️ Não foi possível remover MP4 temporário:",
                    cleanupError?.message ||
                    cleanupError
                );

            }

        } catch (error) {

            console.error(
                "❌ Erro no comando ytmp4:",
                error?.message ||
                error
            );

            return ctx.reply(
                `❌ *Não foi possível baixar o vídeo.*

🔎 Pesquisa: ${
                    trackId
                        ? `música ID ${trackId}`
                        : query
                }

Tenta novamente.`
            );

        }

    }

};
