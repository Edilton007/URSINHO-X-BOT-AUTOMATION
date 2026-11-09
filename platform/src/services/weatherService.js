// ============================================================
// CLIMA (Open-Meteo — grátis, sem chave de API, sem cartão)
//
// Documentação: https://open-meteo.com
// Não precisa de nada no .env, funciona logo.
// ============================================================

const WMO_DESCRICOES = {
    0: "céu limpo",
    1: "praticamente limpo",
    2: "parcialmente nublado",
    3: "nublado",
    45: "névoa",
    48: "névoa com geada",
    51: "chuvisco fraco",
    53: "chuvisco moderado",
    55: "chuvisco forte",
    61: "chuva fraca",
    63: "chuva moderada",
    65: "chuva forte",
    66: "chuva gelada fraca",
    67: "chuva gelada forte",
    71: "neve fraca",
    73: "neve moderada",
    75: "neve forte",
    80: "aguaceiros fracos",
    81: "aguaceiros moderados",
    82: "aguaceiros fortes",
    95: "trovoada",
    96: "trovoada com granizo fraco",
    99: "trovoada com granizo forte"
};

function descreverTempo(codigo) {
    return WMO_DESCRICOES[codigo] || "condição desconhecida";
}

/**
 * Converte um nome de local (ex: "Maputo", "Beira") em
 * coordenadas, usando a API de geocoding do Open-Meteo.
 */
async function geocodificar(local) {

    const url =
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(local)}&count=1&language=pt`;

    const response = await fetch(url);

    if (!response.ok) {
        return null;
    }

    const data = await response.json();

    const resultado = data?.results?.[0];

    if (!resultado) {
        return null;
    }

    return {
        nome: resultado.name,
        pais: resultado.country,
        latitude: resultado.latitude,
        longitude: resultado.longitude
    };
}

/**
 * Devolve o clima atual (e previsão simples) para um local.
 * Se nenhum local for indicado, usa Maputo por defeito.
 */
async function getClima(local) {

    try {

        const localAlvo = (local || "Maputo").trim();

        const local_geo = await geocodificar(localAlvo);

        if (!local_geo) {
            return `Não consegui encontrar o local "${localAlvo}" para verificar o clima.`;
        }

        const url =
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${local_geo.latitude}&longitude=${local_geo.longitude}` +
            `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
            `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
            `&timezone=auto&forecast_days=1`;

        const response = await fetch(url);

        if (!response.ok) {
            return "Não consegui obter os dados do clima agora, tenta mais tarde.";
        }

        const data = await response.json();

        const atual = data?.current;
        const diario = data?.daily;

        if (!atual) {
            return "Não consegui obter os dados do clima agora, tenta mais tarde.";
        }

        const partes = [
            `Clima em ${local_geo.nome}${local_geo.pais ? `, ${local_geo.pais}` : ""}:`,
            `Agora: ${Math.round(atual.temperature_2m)}°C, ${descreverTempo(atual.weather_code)}, humidade ${atual.relative_humidity_2m}%, vento ${Math.round(atual.wind_speed_10m)} km/h.`
        ];

        if (diario?.temperature_2m_max?.[0] !== undefined) {
            partes.push(
                `Hoje: máxima ${Math.round(diario.temperature_2m_max[0])}°C, mínima ${Math.round(diario.temperature_2m_min[0])}°C.`
            );
        }

        return partes.join("\n");

    } catch (error) {
        console.error(
            "Erro ao obter clima:",
            error?.message || error
        );
        return "Não consegui obter os dados do clima agora, tenta mais tarde.";
    }
}

module.exports = {
    getClima
};
