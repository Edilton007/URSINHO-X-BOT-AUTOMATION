const fs = require("fs");

const {
    isFacebookUrl,
    downloadFacebookVideo
} = require("../../services/facebookDownloadService");

module.exports = {
    name: "facebook",
    aliases: ["fb", "fbdown"],
    category: "main",
    description: "Baixa vídeo do Facebook a partir do link",

    async run(sock, m, ctx) {
        const { reply, args, chat } = ctx;

        const url = String((args || [])[0] || "").trim();

        if (!url) {
            return reply(
                "❌ Envia o link do vídeo do Facebook.\n\n" +
                "Exemplo:\n" +
                ".fb https://www.facebook.com/..."
            );
        }

        if (!isFacebookUrl(url)) {
            return reply("❌ Esse link não parece ser do Facebook.");
        }

        await reply("⏳ A baixar o vídeo, aguarda um momento...");

        let video = null;

        try {
            video = await downloadFacebookVideo(url);

            await sock.sendMessage(
                chat,
                {
                    video: fs.readFileSync(video.path),
                    caption:
                        `🐻 URSINHO X BOT V2\n` +
                        `📘 ${video.title}`
                },
                { quoted: m }
            );

        } catch (error) {
            console.error(
                "❌ Erro no download do Facebook:",
                error?.message || error
            );

            await reply(
                "❌ Não consegui baixar esse vídeo.\n\n" +
                "Verifica se o link está correto e se o vídeo é público."
            );

        } finally {
            if (video?.path && fs.existsSync(video.path)) {
                try {
                    fs.unlinkSync(video.path);
                } catch (cleanupError) {
                    console.error(
                        "⚠️ Erro ao remover arquivo temporário:",
                        cleanupError?.message || cleanupError
                    );
                }
            }
        }
    }
};
