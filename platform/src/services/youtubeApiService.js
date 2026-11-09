const axios = require("axios");

// ============================================================
// YOUTUBE DATA API v3 (oficial, grátis, sem cartão)
//
// Cria a chave em: console.cloud.google.com
// 1. Cria um projeto novo (ou usa um existente)
// 2. Vai em "APIs e serviços" → "Biblioteca"
// 3. Procura "YouTube Data API v3" → Ativar
// 4. Vai em "Credenciais" → "Criar credenciais" → "Chave de API"
// 5. Cota grátis: 10.000 unidades/dia (dá pra muitas buscas)
//
// Coloca no .env:
// YOUTUBE_API_KEY=a_tua_chave
// ============================================================

function temApiConfigurada() {
    return !!process.env.YOUTUBE_API_KEY;
}

// Converte duração ISO 8601 (ex: "PT3M45S") para segundos
function parseISO8601Duration(duration) {
    if (!duration) return null;

    const match = duration.match(
        /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
    );

    if (!match) return null;

    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);

    return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Pesquisa vídeos no YouTube via API oficial, já trazendo
 * visualizações reais e duração exata — sem precisar do
 * yt-dlp pra pesquisar (só pra baixar depois).
 *
 * Retorna null se a API não estiver configurada ou falhar,
 * pra quem chamar cair automaticamente no método antigo
 * (yt-dlp), sem quebrar nada.
 */
async function searchYouTubeOficial(query, maxResults = 15) {

    if (!temApiConfigurada()) {
        return null;
    }

    const apiKey = process.env.YOUTUBE_API_KEY;

    try {

        // 1) Buscar candidatos (categoria 10 = Música)
        const searchResponse = await axios.get(
            "https://www.googleapis.com/youtube/v3/search",
            {
                params: {
                    part: "snippet",
                    q: query,
                    type: "video",
                    videoCategoryId: "10",
                    maxResults,
                    key: apiKey
                },
                timeout: 15000
            }
        );

        const items =
            searchResponse.data?.items || [];

        const videoIds =
            items
                .map(item => item.id?.videoId)
                .filter(Boolean);

        if (!videoIds.length) {
            return [];
        }

        // 2) Buscar estatísticas reais (views) + duração exata
        const statsResponse = await axios.get(
            "https://www.googleapis.com/youtube/v3/videos",
            {
                params: {
                    part: "statistics,contentDetails,snippet",
                    id: videoIds.join(","),
                    key: apiKey
                },
                timeout: 15000
            }
        );

        const statsItems =
            statsResponse.data?.items || [];

        return statsItems.map(item => ({
            id: item.id,
            title: item.snippet?.title || "",
            uploader:
                item.snippet?.channelTitle || "",
            duration: parseISO8601Duration(
                item.contentDetails?.duration
            ),
            view_count: Number(
                item.statistics?.viewCount || 0
            ),
            url: `https://www.youtube.com/watch?v=${item.id}`
        }));

    } catch (error) {
        console.error(
            "Erro na busca oficial do YouTube:",
            error?.response?.data?.error?.message ||
                error?.message ||
                error
        );

        return null;
    }
}

module.exports = {
    searchYouTubeOficial,
    temApiConfigurada
};
