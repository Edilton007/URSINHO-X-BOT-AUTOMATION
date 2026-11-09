const fs = require("fs");
const axios = require("axios");

// ============================================================
// INSTÂNCIA COBALT
//
// A instância oficial (cobalt.tools) bloqueou downloads do
// YouTube. Usamos uma instância comunitária como fallback.
// Se essa cair, troca só o COBALT_API_URL no .env — não
// precisa mexer no código.
//
// Lista de instâncias vivas: https://instances.cobalt.best/
// ============================================================

const COBALT_API_URL =
    process.env.COBALT_API_URL || "https://cobalt.meowing.de";

// ============================================================
// RESOLVER LINK DIRETO
// ============================================================

async function cobaltResolve(sourceUrl, mode = "auto") {

    const body = {
        url: sourceUrl,
        downloadMode: mode // "auto" | "audio" | "mute"
    };

    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    // A API do Cobalt mudou de endpoint entre versões:
    // instâncias novas usam POST na raiz ("/"), instâncias
    // mais antigas ainda usam POST em "/api/json". Tentamos
    // as duas pra cobrir mais instâncias.
    const endpointsToTry = [
        COBALT_API_URL,
        `${COBALT_API_URL.replace(/\/$/, "")}/api/json`
    ];

    let lastError = null;

    for (const endpoint of endpointsToTry) {

        try {

            const response = await axios.post(endpoint, body, {
                headers,
                timeout: 30000
            });

            const data = response.data;

            if (!data || data.status === "error") {
                throw new Error(
                    `Cobalt recusou o pedido (${data?.error?.code || "erro desconhecido"}).`
                );
            }

            const directUrl =
                data.url ||
                (Array.isArray(data.picker) && data.picker[0]?.url);

            if (!directUrl) {
                throw new Error("Cobalt não retornou um link de download.");
            }

            return directUrl;

        } catch (error) {
            lastError = error;
            console.warn(
                `⚠️ Cobalt endpoint ${endpoint} falhou:`,
                error?.response?.status || error?.message || error
            );
        }
    }

    throw lastError;
}

// ============================================================
// BAIXAR ARQUIVO VIA COBALT
// ============================================================

async function downloadViaCobalt(sourceUrl, outputPath, mode = "auto") {

    console.log("🔄 Tentando fallback via API Cobalt...");
    console.log("🌐 Instância:", COBALT_API_URL);

    const directUrl = await cobaltResolve(sourceUrl, mode);

    const response = await axios.get(directUrl, {
        responseType: "arraybuffer",
        timeout: 5 * 60 * 1000,
        maxContentLength: 200 * 1024 * 1024,
        headers: {
            "User-Agent": "URSINHO-X-BOT-V2/1.0"
        }
    });

    fs.writeFileSync(outputPath, response.data);

    if (!fs.existsSync(outputPath)) {
        throw new Error("Cobalt: o arquivo não foi salvo.");
    }

    console.log("✅ Fallback Cobalt funcionou.");

    return outputPath;
}

module.exports = {
    downloadViaCobalt
};
