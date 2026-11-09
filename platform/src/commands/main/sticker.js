const {
    createSticker
} = require("../../services/stickerService");

module.exports = {
    name: "sticker",

    aliases: [
        "s",
        "f",
        "fig"
    ],

    category: "downloads",

    description:
        "Criar figurinha a partir de imagem, GIF ou vídeo.",

    run: async (sock, m, ctx) => {
        try {
            const sticker =
                await createSticker(
                    sock,
                    m
                );

            await sock.sendMessage(
                ctx.chat,
                {
                    sticker
                },
                {
                    quoted: m
                }
            );
        } catch (error) {
            console.error(
                "❌ Erro no comando sticker:",
                error?.message || error
            );

            switch (error?.code) {
                case "MÍDIA_NÃO_ENCONTRADA":
                    return ctx.reply(
                        "🖼️ Responde a uma imagem, GIF ou vídeo com o comando."
                    );

                case "VIDEO_MUITO_LONGO":
                    return ctx.reply(
                        "⏱️ O vídeo deve ter no máximo 10 segundos."
                    );

                case "ERRO_DOWNLOAD":
                    return ctx.reply(
                        "❌ Não consegui obter a mídia."
                    );

                default:
                    return ctx.reply(
                        "❌ Não foi possível criar a figurinha."
                    );
            }
        }
    }
};
