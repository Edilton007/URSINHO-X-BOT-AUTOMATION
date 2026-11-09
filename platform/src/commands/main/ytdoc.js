const fs = require("fs");

const {
    downloadMusic,
    downloadMusicById
} = require("../../services/musicDownloadService");

module.exports = {

    name: "ytdoc",

    aliases: [
        "doc"
    ],

    category: "downloads",

    description: "Baixar música como documento",

    run: async (sock, m, ctx) => {

        const args = [...ctx.args];

        let trackId = null;

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

        if (!query && !trackId) {

            return ctx.reply(
                `📄 *YTDOC — BAIXAR COMO DOCUMENTO*

Escreve o nome da música ou usa o ID.

Exemplo:
${ctx.prefix}ytdoc --id 1614063459

🐻 URSINHO X BOT V2`
            );
        }

        await ctx.reply(
            `📄 *A preparar o documento...*

🔎 Pesquisa: ${
                trackId
                    ? `música ID ${trackId}`
                    : query
            }

⏳ Aguarda um momento...`
        );

        try {

            console.log("================================");
            console.log("📄 YTDOC");
            console.log(
                "🔎 Pesquisa:",
                trackId
                    ? `música ID ${trackId}`
                    : query
            );
            console.log("================================");

            const result = trackId
                ? await downloadMusicById(trackId)
                : await downloadMusic(query);

            if (
                !result ||
                !result.path ||
                !fs.existsSync(result.path)
            ) {
                throw new Error(
                    "O arquivo MP3 não foi encontrado."
                );
            }

            console.log(
                "📦 Documento:",
                result.fileName
            );

            const audio = fs.readFileSync(
                result.path
            );

            await sock.sendMessage(
                ctx.chat,
                {
                    document: audio,

                    mimetype: "audio/mpeg",

                    fileName: result.fileName,

                    caption:
                        `📄 *${result.title}*\n` +
                        `👤 ${result.artist || "Artista desconhecido"}`
                },
                {
                    quoted: m
                }
            );

            console.log(
                "✅ Documento enviado:",
                result.fileName
            );

        } catch (error) {

            console.error(
                "❌ Erro no comando ytdoc:",
                error?.message || error
            );

            return ctx.reply(
                `❌ *Não foi possível enviar o documento.*

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
