const axios = require("axios");

/*
============================================================
URSINHO X BOT V2
MUSIC SEARCH SERVICE
Fonte principal: iTunes Search API
Sem API Key
============================================================
*/

const ITUNES_URL = "https://itunes.apple.com/search";

const HEADERS = {
    "User-Agent": "URSINHO-X-BOT-V2/1.0 (music search service)",
    "Accept": "application/json"
};

// ============================================================
// NORMALIZAR TEXTO
// ============================================================

function normalizeText(text = "") {
    return String(text)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// ============================================================
// PARSE DA PESQUISA
// ============================================================

function parseQuery(query) {
    const clean = String(query || "").trim();

    const patterns = [
        /^(.+?)\s+-\s+(.+)$/,
        /^(.+?)\s+by\s+(.+)$/i,
        /^(.+?)\s+ft\.?\s+(.+)$/i,
        /^(.+?)\s+feat\.?\s+(.+)$/i
    ];

    for (const pattern of patterns) {
        const match = clean.match(pattern);

        if (match) {
            return {
                title: match[1].trim(),
                artist: match[2].trim(),
                explicit: true
            };
        }
    }

    return {
        title: clean,
        artist: "",
        explicit: false
    };
}

// ============================================================
// POSSÍVEIS DIVISÕES
//
// Exemplo:
// Calm Down Rema
//
// Tenta:
// Calm | Down Rema
// Calm Down | Rema
// ============================================================

function buildPossibleSplits(query) {
    const words = String(query || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const splits = [];

    if (words.length < 2) {
        return splits;
    }

    const maxArtistWords = Math.min(4, words.length - 1);

    for (let artistWords = 1; artistWords <= maxArtistWords; artistWords++) {
        const titleWords = words.slice(0, -artistWords);
        const artistParts = words.slice(-artistWords);

        if (!titleWords.length || !artistParts.length) {
            continue;
        }

        splits.push({
            title: titleWords.join(" "),
            artist: artistParts.join(" ")
        });
    }

    return splits;
}

// ============================================================
// VERSÕES QUE NÃO QUEREMOS PRIORIZAR
// ============================================================

function hasBadVersion(text = "") {
    const value = normalizeText(text);

    const badWords = [
        "remix",
        "remixed",
        "live",
        "acoustic",
        "karaoke",
        "cover",
        "instrumental",
        "sped up",
        "slowed",
        "nightcore",
        "edit",
        "bootleg",
        "mashup",
        "mix",
        "version",
        "demo",
        "rehearsal",
        "8d",
        "bass boosted",
        "extended"
    ];

    return badWords.some(word =>
        value.includes(normalizeText(word))
    );
}

// ============================================================
// SIMILARIDADE
// ============================================================

function textSimilarity(a, b) {
    const aa = normalizeText(a);
    const bb = normalizeText(b);

    if (!aa || !bb) {
        return 0;
    }

    if (aa === bb) {
        return 1;
    }

    if (aa.includes(bb) || bb.includes(aa)) {
        return 0.85;
    }

    const wordsA = new Set(aa.split(" "));
    const wordsB = new Set(bb.split(" "));

    let common = 0;

    for (const word of wordsA) {
        if (wordsB.has(word)) {
            common++;
        }
    }

    return common / Math.max(wordsA.size, wordsB.size);
}

// ============================================================
// ARTISTA
// ============================================================

function getArtist(result) {
    return (
        result.artistName ||
        ""
    ).trim();
}

// ============================================================
// ARTISTA MATCH
// ============================================================

function artistMatches(artist, requestedArtist) {
    const a = normalizeText(artist);
    const r = normalizeText(requestedArtist);

    if (!a || !r) {
        return false;
    }

    if (a === r) {
        return true;
    }

    return (
        a.includes(r) ||
        r.includes(a)
    );
}

// ============================================================
// DURAÇÃO
// ============================================================

function durationScore(duration, requestedDuration) {
    if (!duration || !requestedDuration) {
        return 0;
    }

    const difference = Math.abs(
        Number(duration) - Number(requestedDuration)
    );

    if (difference <= 3) {
        return 150;
    }

    if (difference <= 5) {
        return 130;
    }

    if (difference <= 10) {
        return 100;
    }

    if (difference <= 20) {
        return 60;
    }

    if (difference <= 40) {
        return 20;
    }

    return -100;
}

// ============================================================
// SCORE
// ============================================================

function calculateScore(result, parsed, originalQuery) {
    const title = normalizeText(result.trackName);
    const artist = normalizeText(getArtist(result));

    const requestedTitle = normalizeText(parsed.title);
    const requestedArtist = normalizeText(parsed.artist);

    let score = 0;

    // ========================================================
    // TÍTULO
    // ========================================================

    if (title === requestedTitle) {
        score += 300;
    } else {
        score += textSimilarity(
            title,
            requestedTitle
        ) * 150;
    }

    // ========================================================
    // ARTISTA
    // ========================================================

    if (requestedArtist) {
        if (artistMatches(artist, requestedArtist)) {
            score += 400;
        } else {
            score -= 300;
        }
    } else {
        /*
        Quando o usuário escreve:

        Calm Down Rema

        o artista pode estar no final da pesquisa.
        */

        const queryNormalized = normalizeText(originalQuery);

        if (artist && queryNormalized.includes(artist)) {
            score += 250;
        }
    }

    // ========================================================
    // VERSÃO ORIGINAL
    // ========================================================

    const versionText = `
        ${result.trackName || ""}
        ${result.collectionName || ""}
        ${result.artistName || ""}
    `;

    if (hasBadVersion(versionText)) {
        score -= 300;
    }

    // ========================================================
    // TRACK EXPLÍCITA
    // ========================================================

    if (result.wrapperType === "track") {
        score += 20;
    }

    // ========================================================
    // DURAÇÃO
    // ========================================================

    score += durationScore(
        result.trackTimeMillis
            ? Math.round(result.trackTimeMillis / 1000)
            : null,
        parsed.duration
    );

    // ========================================================
    // ÁLBUM
    // ========================================================

    if (result.collectionName) {
        score += 10;
    }

    // ========================================================
    // ARTWORK
    // ========================================================

    if (result.artworkUrl100) {
        score += 20;
    }

    return score;
}

// ============================================================
// ARTWORK
// ============================================================

function getArtworkUrl(result) {
    const url =
        result.artworkUrl100 ||
        result.artworkUrl60 ||
        null;

    if (!url) {
        return null;
    }

    /*
    A iTunes normalmente devolve artwork 100x100.
    Trocamos para uma versão maior quando disponível.
    */

    return url
        .replace("100x100bb", "1000x1000bb")
        .replace("60x60bb", "1000x1000bb")
        .replace(/^http:\/\//i, "https://");
}

// ============================================================
// TRANSFORMAR RESULTADO
// ============================================================

function mapResult(result, parsed, originalQuery) {
    const duration = result.trackTimeMillis
        ? Math.round(result.trackTimeMillis / 1000)
        : null;

    return {
        id: result.trackId
            ? String(result.trackId)
            : null,

        title:
            result.trackName ||
            "",

        artist:
            getArtist(result),

        duration,

        album:
            result.collectionName ||
            null,

        releaseId:
            result.collectionId
                ? String(result.collectionId)
                : null,

        date:
            result.releaseDate ||
            null,

        coverUrl:
            getArtworkUrl(result),

        score:
            calculateScore(
                {
                    ...result
                },
                {
                    ...parsed,
                    duration: parsed.duration || null
                },
                originalQuery
            )
    };
}

// ============================================================
// BUSCAR NO ITUNES
// ============================================================

async function searchITunes(term) {
    const response = await axios.get(
        ITUNES_URL,
        {
            params: {
                term,
                media: "music",
                entity: "song",
                country: "US",
                limit: 50
            },

            headers: HEADERS,

            timeout: 15000
        }
    );

    return Array.isArray(response.data?.results)
        ? response.data.results
        : [];
}

// ============================================================
// PESQUISAR MÚSICAS
// ============================================================

async function searchMusic(query, limit = 5) {
    if (!query || !query.trim()) {
        return [];
    }

    const originalQuery = query.trim();

    console.log(
        "🎵 Pesquisa musical:",
        originalQuery
    );

    const parsed = parseQuery(originalQuery);

    const searchTerms = [];

    // ========================================================
    // PESQUISA PRINCIPAL
    // ========================================================

    searchTerms.push(
        originalQuery
    );

    // ========================================================
    // SE HOUVER ARTISTA EXPLÍCITO
    // ========================================================

    if (parsed.explicit) {
        searchTerms.push(
            `${parsed.title} ${parsed.artist}`
        );
    }

    // ========================================================
    // TENTAR DESCOBRIR ARTISTA
    // ========================================================

    const splits = buildPossibleSplits(
        originalQuery
    );

    for (const split of splits) {
        searchTerms.push(
            `${split.title} ${split.artist}`
        );
    }

    const uniqueTerms = [
        ...new Set(
            searchTerms
                .map(term => term.trim())
                .filter(Boolean)
        )
    ];

    const allResults = [];

    // ========================================================
    // EXECUTAR PESQUISAS
    // ========================================================

    for (const term of uniqueTerms) {
        try {
            console.log(
                "🔎 iTunes:",
                term
            );

            const results =
                await searchITunes(term);

            for (const result of results) {
                if (!result?.trackName) {
                    continue;
                }

                const resultParsed = {
                    title:
                        parsed.explicit
                            ? parsed.title
                            : (
                                term === originalQuery
                                    ? parsed.title
                                    : parseQuery(term).title
                            ),

                    artist:
                        parsed.explicit
                            ? parsed.artist
                            : "",

                    duration: null
                };

                const mapped =
                    mapResult(
                        result,
                        resultParsed,
                        originalQuery
                    );

                if (
                    mapped.title &&
                    mapped.artist
                ) {
                    allResults.push(
                        mapped
                    );
                }
            }

        } catch (error) {
            console.error(
                "iTunes:",
                error.response?.status ||
                error.message
            );
        }
    }

    // ========================================================
    // ORDENAR
    // ========================================================

    allResults.sort(
        (a, b) =>
            b.score - a.score
    );

    // ========================================================
    // REMOVER DUPLICADOS
    // ========================================================

    const unique = [];
    const seen = new Set();

    for (const result of allResults) {
        const key = [
            normalizeText(result.title),
            normalizeText(result.artist),
            result.duration || 0
        ].join("|");

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        unique.push(result);

        if (unique.length >= limit) {
            break;
        }
    }

    // ========================================================
    // LOG
    // ========================================================

    console.log(
        "\n🎯 RESULTADOS MUSICAIS:"
    );

    unique.forEach(
        (item, index) => {
            console.log(
                `${index + 1}. ${item.title}`
            );

            console.log(
                `   Artista: ${item.artist}`
            );

            console.log(
                `   Álbum: ${item.album || "N/A"}`
            );

            console.log(
                `   Duração: ${
                    item.duration
                        ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, "0")}`
                        : "N/A"
                }`
            );

            console.log(
                `   Capa: ${
                    item.coverUrl
                        ? "SIM"
                        : "NÃO"
                }`
            );

            console.log(
                `   Score: ${item.score}`
            );
        }
    );

    return unique;
}

// ============================================================
// BUSCAR MÚSICA PELO ID
// ============================================================

async function getMusicById(trackId) {
    if (!trackId) {
        return null;
    }

    try {
        const response = await axios.get(
            "https://itunes.apple.com/lookup",
            {
                params: {
                    id: trackId,
                    entity: "song",
                    country: "US"
                },
                headers: HEADERS,
                timeout: 15000
            }
        );

        const result = response.data?.results?.find(
            item =>
                item.wrapperType === "track" &&
                item.trackId &&
                String(item.trackId) === String(trackId)
        );

        if (!result) {
            return null;
        }

        const duration = result.trackTimeMillis
            ? Math.round(result.trackTimeMillis / 1000)
            : null;

        return {
            id: String(result.trackId),

            title:
                result.trackName ||
                "",

            artist:
                getArtist(result),

            duration,

            album:
                result.collectionName ||
                null,

            releaseId:
                result.collectionId
                    ? String(result.collectionId)
                    : null,

            date:
                result.releaseDate ||
                null,

            coverUrl:
                getArtworkUrl(result)
        };

    } catch (error) {
        console.error(
            "Erro ao buscar música por ID:",
            error.response?.status ||
            error.message
        );

        return null;
    }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    searchMusic,
    getMusicById
};
