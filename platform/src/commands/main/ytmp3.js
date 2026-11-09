const fs = require("fs");

const {
    downloadMusic,
    downloadMusicById
} = require("../../services/musicDownloadService");

module.exports = {

    name: "ytmp3",

    aliases: [
        "audio"
    ],

    category: "downloads",

    description: "Baixar música em MP3",

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
                `🎵 *YTMP3 — BAIXAR MÚSICA*

Escreve o nome da música e, de preferência, o artista.

Exemplo:
${ctx.prefix}ytmp3 Calm Down Rema

🐻 URSINHO X BOT V2`
            );
        }

        await ctx.reply(
            `🎵 *A preparar o MP3...*

🔎 Pesquisa: ${trackId ? `música ID ${trackId}` : query}

⏳ Aguarda um momento...`
        );

        const tentarDownload = async () => {
            return trackId
                ? await downloadMusicById(trackId)
                : await downloadMusic(query);
        };

        let result = null;
        let ultimoErro = null;

        // Até 2 tentativas no total — cobre falhas momentâneas
        // (rede, API externa instável) sem precisar o utilizador
        // repetir o comando manualmente.
        for (let tentativa = 1; tentativa <= 2; tentativa++) {

            try {

                console.log("================================");
                console.log(`🎵 YTMP3 (tentativa ${tentativa}/2)`);
                console.log("🔎 Pesquisa:", trackId ? `ID ${trackId}` : query);
                console.log("================================");

                result = await tentarDownload();

                if (
                    !result ||
                    !result.path ||
                    !fs.existsSync(result.path)
                ) {
                    throw new Error("O arquivo MP3 não foi encontrado.");
                }

                break; // sucesso, sai do loop

            } catch (error) {

                ultimoErro = error;

                console.error(
                    `❌ Erro no comando ytmp3 (tentativa ${tentativa}/2):`,
                    error?.message || error
                );

                if (tentativa === 1) {
                    // pequena pausa antes de tentar de novo
                    await new Promise(r => setTimeout(r, 1500));
                }
            }
        }

        if (!result) {

            return ctx.reply(
                `❌ *Não foi possível baixar a música.*

🔎 Pesquisa: ${trackId ? `música ID ${trackId}` : query}

_Motivo técnico: ${ultimoErro?.message || "desconhecido"}_

Tenta novamente ou tenta outro nome/artista.`
            );
        }

        try {

            // Envia a partir de um stream em disco em vez de
            // carregar o ficheiro inteiro em memória de uma vez —
            // mais leve no RAM limitado da hospedagem.
            await sock.sendMessage(
                ctx.chat,
                {
                    audio: fs.createReadStream(result.path),
                    mimetype: "audio/mpeg",
                    fileName: result.fileName,
                    ptt: false
                },
                {
                    quoted: m
                }
            );

            console.log("✅ MP3 enviado:", result.fileName);

        } catch (error) {

            console.error(
                "❌ Erro ao enviar MP3 já baixado:",
                error?.message || error
            );

            return ctx.reply(
                `❌ *A música foi baixada, mas falhou ao enviar.*

_Motivo técnico: ${error?.message || "desconhecido"}_

Tenta novamente.`
            );
        }
    }
};
