const axios = require("axios");
const fs = require("fs");

// ============================================================
// YOINKU API (gratuita, sem cartão — yoinku.com/en/api)
//
// Faz o trabalho pesado do lado de fora — nosso servidor só
// baixa o arquivo já pronto. Cobre YouTube, TikTok e Instagram,
// em MP3 e MP4.
//
// Limites: 5 pedidos/min por IP, 30 downloads/dia por conta.
//
// Cria a chave grátis em yoinku.com/en/account e coloca no .env:
// YOINKU_API_KEY=yk_xxxxxxxx
// ============================================================

const BASE_URL = "https://yoinku.com/api/v1";

function temApiConfigurada() {
    return !!process.env.YOINKU_API_KEY;
}

function headers() {
    return {
        "x-api-key": process.env.YOINKU_API_KEY
    };
}

function extrairErroYoinku(error) {

    const dadosErro = error?.response?.data?.error;

    if (dadosErro?.message) {
        return `Yoinku (${dadosErro.code || error.response.status}): ${dadosErro.message}`;
    }

    if (error?.response?.status) {
        return `Yoinku: HTTP ${error.response.status}`;
    }

    return error?.message || String(error);
}

async function getInfo(youtubeUrl) {

    try {

        const response = await axios.get(`${BASE_URL}/info`, {
            params: { url: youtubeUrl },
            headers: headers(),
            timeout: 30000
        });

        if (!response.data?.ok) {
            throw new Error(
                response.data?.error?.message || "Yoinku: erro ao obter info."
            );
        }

        return response.data.data;

    } catch (error) {
        throw new Error(extrairErroYoinku(error));
    }
}

function escolherFormato(formats, kind) {

    if (!Array.isArray(formats)) {
        return null;
    }

    if (kind === "audio") {
        return (
            formats.find(f => f.id === "a-mp3") ||
            formats.find(f => f.kind === "audio")
        );
    }

    // vídeo: prefere até 720p (mais rápido/leve pro nosso servidor)
    const videos = formats.filter(f => f.kind === "video");

    return (
        videos.find(f => f.id === "v-720") ||
        videos.find(f => f.id === "v-480") ||
        videos.find(f => f.id === "v-360") ||
        videos[0] ||
        null
    );
}

async function downloadViaYoinku(youtubeUrl, outputPath, kind = "audio") {

    if (!temApiConfigurada()) {
        return null;
    }

    console.log(`🌐 Tentando via API externa (Yoinku - ${kind})...`);

    const info = await getInfo(youtubeUrl);

    const formato = escolherFormato(info?.formats, kind);

    if (!formato) {
        throw new Error(
            "Yoinku: nenhum formato compatível encontrado."
        );
    }

    const downloadResponse = await axios.get(`${BASE_URL}/download`, {
        params: {
            url: youtubeUrl,
            format: formato.id
        },
        headers: headers(),
        timeout: 30000
    }).catch(error => {
        throw new Error(extrairErroYoinku(error));
    });

    if (!downloadResponse.data?.ok || !downloadResponse.data?.url) {
        throw new Error(
            downloadResponse.data?.error?.message ||
                "Yoinku: não retornou link de download."
        );
    }

    const fileResponse = await axios.get(downloadResponse.data.url, {
        responseType: "arraybuffer",
        timeout: 5 * 60 * 1000,
        maxContentLength: 300 * 1024 * 1024
    });

    fs.writeFileSync(outputPath, fileResponse.data);

    if (!fs.existsSync(outputPath)) {
        throw new Error("Yoinku: o arquivo não foi salvo.");
    }

    console.log("✅ Baixado via Yoinku.");

    return outputPath;
}

module.exports = {
    downloadViaYoinku,
    temApiConfigurada
};
