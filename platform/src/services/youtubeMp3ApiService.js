const axios = require("axios");
const fs = require("fs");

// ============================================================
// YOUTUBE-MP36 (via RapidAPI)
//
// Como o servidor da Katabump é fraco demais pra rodar o
// yt-dlp de forma confiável, essa API faz o trabalho pesado
// (conversão) do lado de fora — só baixamos o resultado final.
//
// Cria a chave grátis em rapidapi.com, procura "youtube-mp36",
// assina o plano Free (sem cartão), copia a chave e coloca:
// RAPIDAPI_KEY=a_tua_chave
// ============================================================

const HOST = "youtube-mp36.p.rapidapi.com";

function temApiConfigurada() {
    return !!process.env.RAPIDAPI_KEY;
}

function extractVideoId(url) {
    const match =
        String(url || "").match(
            /(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/
        );

    return match ? match[1] : null;
}

async function downloadMp3ViaApi(videoIdOuUrl, outputPath) {

    if (!temApiConfigurada()) {
        return null;
    }

    const videoId =
        videoIdOuUrl.length === 11
            ? videoIdOuUrl
            : extractVideoId(videoIdOuUrl);

    if (!videoId) {
        throw new Error("Não foi possível identificar o ID do vídeo.");
    }

    const apiKey = process.env.RAPIDAPI_KEY;

    console.log("🌐 Tentando via API externa (youtube-mp36)...");

    let link = null;
    let tentativas = 0;

    // A conversão é assíncrona do lado da API — pode ser preciso
    // perguntar de novo algumas vezes até ela terminar.
    while (tentativas < 10 && !link) {

        tentativas++;

        const response = await axios.get(
            `https://${HOST}/dl`,
            {
                params: { id: videoId },
                headers: {
                    "X-RapidAPI-Key": apiKey,
                    "X-RapidAPI-Host": HOST
                },
                timeout: 20000
            }
        );

        const data = response.data;

        if (data?.status === "ok" && data?.link) {
            link = data.link;
            break;
        }

        if (data?.status === "fail" || data?.status === "error") {
            throw new Error(
                data?.msg || "A API externa recusou o pedido."
            );
        }

        // status "processing" — espera um pouco e tenta de novo
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (!link) {
        throw new Error(
            "A API externa demorou demais a converter."
        );
    }

    const fileResponse = await axios.get(link, {
        responseType: "arraybuffer",
        timeout: 5 * 60 * 1000,
        maxContentLength: 200 * 1024 * 1024,
        headers: {
            "User-Agent": "URSINHO-X-BOT-V2/1.0"
        }
    });

    fs.writeFileSync(outputPath, fileResponse.data);

    if (!fs.existsSync(outputPath)) {
        throw new Error("API externa: o arquivo não foi salvo.");
    }

    console.log("✅ Baixado via API externa.");

    return outputPath;
}

module.exports = {
    downloadMp3ViaApi,
    temApiConfigurada,
    extractVideoId
};
