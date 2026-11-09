const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { execFile } = require("child_process");
const { promisify } = require("util");
const NodeID3 = require("node-id3");

const {
    obterDoCache,
    marcarEmUso,
    liberar
} = require("./cleanupService");

const { comFila } = require("./downloadQueueService");

const {
    searchMusic,
    getMusicById
} = require("./musicSearchService");

const {
    searchYouTubeOficial
} = require("./youtubeApiService");

const {
    downloadMp3ViaApi,
    temApiConfigurada: temRapidApiConfigurada
} = require("./youtubeMp3ApiService");

// ============================================================
// YOINKU (OPCIONAL)
//
// Se o yoinkuService.js não existir ou der erro ao carregar,
// o bot continua funcionando normalmente sem ele — nunca
// quebra os comandos por causa disso.
// ============================================================

let downloadViaYoinku = null;
let temYoinkuConfigurada = () => false;

try {
    ({
        downloadViaYoinku,
        temApiConfigurada: temYoinkuConfigurada
    } = require("./yoinkuService"));

    console.log(
        "✅ yoinkuService.js carregado. Chave YOINKU_API_KEY detectada:",
        temYoinkuConfigurada() ? "SIM" : "NÃO"
    );
} catch (error) {
    console.warn(
        "⚠️ yoinkuService.js não encontrado ou com erro ao carregar:",
        error?.message || error
    );
}

// ============================================================
// FALLBACK COBALT (OPCIONAL)
//
// Se o cobaltService.js não existir ou der erro ao carregar,
// o bot continua funcionando normalmente só com yt-dlp —
// nunca quebra os comandos por causa disso.
// ============================================================

let downloadViaCobalt = null;

try {
    ({ downloadViaCobalt } = require("./cobaltService"));
    console.log("✅ Fallback Cobalt disponível.");
} catch (error) {
    console.warn(
        "⚠️ cobaltService.js não encontrado — seguindo só com yt-dlp."
    );
}

const execFileAsync = promisify(execFile);

const ROOT_DIR = path.join(__dirname, "../..");
const DOWNLOAD_DIR = path.join(ROOT_DIR, "downloads");

// ============================================================
// TMPDIR PRÓPRIO (disco principal, não o /tmp do sistema)
//
// O yt-dlp standalone (PyInstaller) extrai bibliotecas inteiras
// toda vez que roda, usando /tmp por padrão. Em muitos containers
// Docker (como a Katabump), /tmp é uma partição minúscula e
// separada do disco principal — causando os erros aleatórios de
// "decompression resulted in return code -1" que estávamos vendo.
//
// Aqui forçamos a extração pra uma pasta dentro do próprio
// projeto, no disco principal (que tem mais espaço livre).
// ============================================================

const YTDLP_TMP_DIR = path.join(ROOT_DIR, "tmp");

function ensureTmpDir() {
    if (!fs.existsSync(YTDLP_TMP_DIR)) {
        fs.mkdirSync(YTDLP_TMP_DIR, { recursive: true });
    }
}

function execEnvComTmp() {
    ensureTmpDir();
    return {
        ...process.env,
        TMPDIR: YTDLP_TMP_DIR,
        TMP: YTDLP_TMP_DIR,
        TEMP: YTDLP_TMP_DIR
    };
}
// Preferimos o binário standalone (bin/yt-dlp, sem Python).
// Se ainda não foi baixado, cai pro antigo via youtube-dl-exec.
const STANDALONE_YTDLP = path.join(ROOT_DIR, "bin", "yt-dlp");
const LEGACY_YTDLP = path.join(
    __dirname,
    "..",
    "..",
    "node_modules",
    "youtube-dl-exec",
    "bin",
    "yt-dlp"
);

const YTDLP =
    process.env.YTDLP_PATH ||
    (fs.existsSync(STANDALONE_YTDLP) ? STANDALONE_YTDLP : LEGACY_YTDLP);

const FFMPEG_PATH =
    process.env.FFMPEG_PATH ||
    require("@ffmpeg-installer/ffmpeg").path;

// ============================================================
// COOKIES (opcional — resolve bloqueio "confirme que não é robô")
// ============================================================

const COOKIES_PATH = process.env.COOKIES_PATH || "";

function cookiesArgs() {
    if (COOKIES_PATH && fs.existsSync(COOKIES_PATH)) {
        return ["--cookies", COOKIES_PATH];
    }
    return [];
}

// Ajuda a contornar o bloqueio de bot do YouTube usando outro
// cliente interno. Desligável via .env: YT_EXTRACTOR_ARGS=off
// Evitamos "tv" e "web_safari" — são os mais afetados pelo
// bloqueio SABR atual do YouTube (2026). "android,web_embedded"
// costuma ser mais estável com cookies.
const EXTRACTOR_ARGS =
    process.env.YT_EXTRACTOR_ARGS !== "off"
        ? ["--extractor-args", process.env.YT_EXTRACTOR_ARGS || "youtube:player_client=android,web_embedded"]
        : [];

// ============================================================
// REMOTE COMPONENTS (DESLIGADO POR OMISSÃO)
//
// "--remote-components ejs:github" faz o yt-dlp tentar buscar
// um componente NO GITHUB a cada download. Em hosts onde o
// GitHub não é alcançável (ex: HeavenCloud, erro de DNS
// "getaddrinfo EAI_AGAIN github.com" já confirmado nos logs),
// isto faz o yt-dlp falhar silenciosamente em TODA tentativa
// que chega a este fallback — mesmo que tudo o resto funcione.
//
// Por omissão fica DESLIGADO. Se um dia mudares de host e o
// GitHub ficar acessível, liga com YT_REMOTE_COMPONENTS=on
// no .env para voltar a ativar esse workaround.
// ============================================================

const REMOTE_COMPONENTS_ARGS =
    process.env.YT_REMOTE_COMPONENTS === "on"
        ? ["--remote-components", "ejs:github", "--js-runtimes", "node"]
        : [];

// ============================================================
// DIRETÓRIO
// ============================================================

function ensureDownloadDir() {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
        fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }
}

// ============================================================
// NOME DO ARQUIVO
// ============================================================

function sanitizeFileName(name) {
    return String(name || "music")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180);
}

// ============================================================
// DURAÇÃO
// ============================================================

function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) {
        return null;
    }

    seconds = Number(seconds);

    if (!Number.isFinite(seconds)) {
        return null;
    }

    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);

    return `${min}:${String(sec).padStart(2, "0")}`;
}

// ============================================================
// NORMALIZAR TEXTO
// ============================================================

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// ============================================================
// PALAVRAS DE VERSÕES ALTERNATIVAS
// ============================================================

const ALTERNATIVE_VERSIONS = [
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
    "extended",
    "radio edit",
    "club mix",
    "dance remix",
    "official remix"
];

// ============================================================
// DETECTAR VERSÃO PEDIDA
// ============================================================

function getRequestedVersions(query = "") {
    const normalized = normalizeText(query);

    return ALTERNATIVE_VERSIONS.filter(version => {
        return normalized.includes(normalizeText(version));
    });
}

// ============================================================
// DETECTAR VERSÕES NO RESULTADO
// ============================================================

function getResultVersions(text = "") {
    const normalized = normalizeText(text);

    return ALTERNATIVE_VERSIONS.filter(version => {
        return normalized.includes(normalizeText(version));
    });
}

// ============================================================
// VERIFICAR VERSÃO INDESEJADA
// ============================================================

function hasBadVersion(text = "") {
    return getResultVersions(text).length > 0;
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

function artistSimilarity(title, uploader, artist) {
    const normalizedArtist = normalizeText(artist);
    const normalizedUploader = normalizeText(uploader);
    const normalizedTitle = normalizeText(title);

    if (!normalizedArtist) {
        return 0;
    }

    let score = 0;

    if (normalizedUploader === normalizedArtist) {
        score += 1;
    } else if (
        normalizedUploader.includes(normalizedArtist) ||
        normalizedArtist.includes(normalizedUploader)
    ) {
        score += 0.8;
    }

    if (normalizedTitle.includes(normalizedArtist)) {
        score += 0.5;
    }

    return Math.min(score, 1);
}

// ============================================================
// EXTRAIR POSSÍVEL ARTISTA DA PESQUISA
//
// Exemplo:
// "Calm Down Rema"
// → título provável: "Calm Down"
// → artista provável: "Rema"
// ============================================================

function extractArtistFromQuery(query = "") {
    const words = normalizeText(query)
        .split(/\s+/)
        .filter(Boolean);

    if (words.length < 2) {
        return "";
    }

    const possibleArtists = [
        words.slice(-1).join(" "),
        words.slice(-2).join(" "),
        words.slice(-3).join(" ")
    ];

    return possibleArtists
        .sort((a, b) => b.length - a.length)[0] || "";
}

// ============================================================
// PONTUAÇÃO DO CANAL / ARTISTA
// ============================================================

function getChannelArtistScore(uploader = "", query = "", title = "") {
    const normalizedUploader = normalizeText(uploader);
    const normalizedQuery = normalizeText(query);
    const normalizedTitle = normalizeText(title);

    if (!normalizedUploader) {
        return 0;
    }

    const requestedArtist = extractArtistFromQuery(query);

    let score = 0;

    // Canal exatamente igual ao artista
    if (
        requestedArtist &&
        normalizedUploader === requestedArtist
    ) {
        score += 220;
    }

    // Canal contém o nome do artista
    if (
        requestedArtist &&
        normalizedUploader.includes(requestedArtist)
    ) {
        score += 150;
    }

    // Nome do artista contém o canal
    if (
        requestedArtist &&
        requestedArtist.includes(normalizedUploader)
    ) {
        score += 100;
    }

    // O nome do canal aparece no título
    if (
        normalizedUploader &&
        normalizedTitle.includes(normalizedUploader)
    ) {
        score += 30;
    }

    return score;
}

// ============================================================
// RESULTADO OFICIAL
// ============================================================

function getOfficialScore(title = "", uploader = "") {
    const normalizedTitle = normalizeText(title);
    const normalizedUploader = normalizeText(uploader);

    let score = 0;

    // Prioridade forte para versões oficiais (geralmente as mais ouvidas)
    if (normalizedTitle.includes("official audio")) {
        score += 160;
    } else if (normalizedTitle.includes("official music video")) {
        score += 140;
    } else if (normalizedTitle.includes("official video")) {
        score += 110;
    } else if (normalizedTitle.includes("official")) {
        score += 50;
    }

    // Canais oficiais do artista costumam ter as versões mais ouvidas
    if (
        normalizedUploader.includes("topic") ||
        normalizedUploader.includes("vevo") ||
        normalizedUploader.endsWith(" - topic")
    ) {
        score += 40;
    }

    // Evitar favorecer canais conhecidos por reposts / baixa qualidade
    const suspiciousChannels = [
        "latin hype",
        "7clouds",
        "nightcore",
        "lyrics",
        "lyric",
        "sped up",
        "slowed",
        "bass boosted"
    ];

    for (const channel of suspiciousChannels) {
        if (normalizedUploader.includes(channel)) {
            score -= 50;
        }
    }

    return score;
}

// ============================================================
// PESO DA VERSÃO
// ============================================================

function getVersionScore(query, resultText) {
    const requestedVersions = getRequestedVersions(query);
    const resultVersions = getResultVersions(resultText);

    // Usuário pediu uma versão específica
    if (requestedVersions.length > 0) {
        let matched = 0;
        let unwanted = 0;

        for (const version of resultVersions) {
            if (requestedVersions.includes(version)) {
                matched++;
            } else {
                unwanted++;
            }
        }

        if (matched > 0) {
            return 120;
        }

        if (unwanted > 0) {
            return -180;
        }

        return -30;
    }

    // Usuário não pediu versão alternativa
    if (resultVersions.length === 0) {
        return 80;
    }

    return -120;
}

// ============================================================
// PESQUISAR VÁRIOS RESULTADOS NO YOUTUBE
// ============================================================

async function searchYouTube(query, targetDuration = null) {

    // Prioriza versões oficiais / mais populares quando o usuário não pediu remix etc.
    const requestedVersions = getRequestedVersions(query);
    let finalQuery = query;

    if (requestedVersions.length === 0) {
        // Ajuda o YouTube a trazer as versões mais ouvidas / oficiais
        finalQuery = `${query} official audio`;
    }

    let entries = [];

    // ============================================================
    // 1ª TENTATIVA: API OFICIAL DO YOUTUBE (visualizações reais)
    // ============================================================

    const resultadosOficiais =
        await searchYouTubeOficial(finalQuery, 15);

    if (resultadosOficiais && resultadosOficiais.length > 0) {

        console.log(
            "🔎 YouTube (API oficial):", finalQuery
        );

        entries = resultadosOficiais;

    } else {

        // ============================================================
        // FALLBACK: yt-dlp (sem API oficial configurada ou ela falhou)
        // ============================================================

        const searchQuery = `ytsearch15:${finalQuery}`;

        console.log("🔎 YouTube (yt-dlp):", finalQuery);

        const { stdout } = await execFileAsync(
            YTDLP,
            [
                ...REMOTE_COMPONENTS_ARGS,
                searchQuery,
                "--dump-single-json",
                "--skip-download",
                "--flat-playlist",
                "--no-warnings",
                ...cookiesArgs(),
                ...EXTRACTOR_ARGS
            ],
            {
                timeout: 90000,
                maxBuffer: 15 * 1024 * 1024,
                env: execEnvComTmp()
            }
        );

        let data;

        try {
            data = JSON.parse(stdout);
        } catch {
            throw new Error(
                "Não foi possível interpretar os resultados do YouTube."
            );
        }

        entries = Array.isArray(data.entries)
            ? data.entries
            : [];
    }

    if (!entries.length) {
        throw new Error(
            "Música não encontrada no YouTube."
        );
    }

    const normalizedQuery = normalizeText(query);

    console.log(
        "🎯 Versão solicitada:",
        getRequestedVersions(query).length
            ? getRequestedVersions(query).join(", ")
            : "ORIGINAL / NORMAL"
    );

    const candidates = entries
        .filter(entry => entry && entry.id)
        .map(entry => {

            const title = entry.title || "";

            const uploader =
                entry.uploader ||
                entry.channel ||
                "";

            const duration =
                Number(entry.duration) || null;

            const text = `${title} ${uploader}`;

            let score = 0;

            // ==================================================
            // PRIORIDADE: MAIS OUVIDAS (view_count quando disponível)
            // ==================================================
            const views = Number(entry.view_count) || 0;

            if (views > 0) {
                if (views >= 100_000_000) score += 200;
                else if (views >= 50_000_000) score += 160;
                else if (views >= 20_000_000) score += 130;
                else if (views >= 10_000_000) score += 110;
                else if (views >= 5_000_000) score += 90;
                else if (views >= 1_000_000) score += 70;
                else if (views >= 500_000) score += 45;
                else if (views >= 100_000) score += 25;
                else score += 10;
            }

            // ==================================================
            // TÍTULO
            // ==================================================

            const titleSimilarity =
                textSimilarity(
                    title,
                    query
                );

            score += titleSimilarity * 120;

            // ==================================================
            // ARTISTA
            // ==================================================

            const artistScore =
                artistSimilarity(
                    title,
                    uploader,
                    query
                );

            score += artistScore * 40;

            // ==================================================
            // PALAVRAS DA PESQUISA
            // ==================================================

            const queryWords =
                normalizedQuery
                    .split(" ")
                    .filter(Boolean);

            const normalizedResult =
                normalizeText(text);

            let matchedWords = 0;

            for (const word of queryWords) {
                if (normalizedResult.includes(word)) {
                    matchedWords++;
                }
            }

            if (queryWords.length > 0) {
                score +=
                    (matchedWords / queryWords.length) * 50;
            }

            // ==================================================
            // DURAÇÃO
            // ==================================================

            if (
                targetDuration &&
                duration
            ) {

                const difference =
                    Math.abs(
                        duration - targetDuration
                    );

                console.log(
                    `🎚️ ${title} | ${formatDuration(duration)} | diferença: ${difference}s`
                );

                if (difference <= 3) {
                    score += 150;
                } else if (difference <= 5) {
                    score += 130;
                } else if (difference <= 10) {
                    score += 100;
                } else if (difference <= 20) {
                    score += 60;
                } else if (difference <= 40) {
                    score += 20;
                } else {
                    score -= 80;
                }
            }

            // ==================================================
            // VERSÃO
            // ==================================================

            score += getVersionScore(
                query,
                text
            );

            // ==================================================
            // CANAL / ARTISTA
            // ==================================================

            const channelScore =
                getChannelArtistScore(
                    uploader,
                    query,
                    title
                );

            score += channelScore;

            // ==================================================
            // OFICIAL
            // ==================================================

            const officialScore =
                getOfficialScore(
                    title,
                    uploader
                );

            score += officialScore;

            // ==================================================
            // PENALIZAR RESULTADOS SUSPEITOS
            // ==================================================

            const normalizedTitle =
                normalizeText(title);

            if (
                normalizedTitle.includes("lyrics") &&
                !normalizedTitle.includes("official audio")
            ) {
                score -= 20;
            }

            if (
                normalizedTitle.includes("8d")
            ) {
                score -= 30;
            }

            if (
                normalizedTitle.includes("bass boosted")
            ) {
                score -= 30;
            }

            return {
                id: entry.id,
                title,
                uploader,
                duration,
                view_count: views,
                url:
                    entry.webpage_url ||
                    entry.url ||
                    `https://www.youtube.com/watch?v=${entry.id}`,
                score,
                versions:
                    getResultVersions(text)
            };
        })
        .sort(
            (a, b) => b.score - a.score
        );

    if (!candidates.length) {
        throw new Error(
            "Nenhum resultado válido encontrado no YouTube."
        );
    }

    // ============================================================
    // RESULTADOS
    // ============================================================

    console.log(
        "\n🎯 RESULTADOS YOUTUBE:"
    );

    candidates.forEach(
        (item, index) => {

            console.log(
                `${index + 1}. ${item.title}`
            );

            console.log(
                `   Canal: ${item.uploader}`
            );

            console.log(
                `   Duração: ${formatDuration(item.duration)}`
            );

            console.log(
                `   Views: ${item.view_count ? item.view_count.toLocaleString() : "N/A"}`
            );

            console.log(
                `   Versão: ${
                    item.versions.length
                        ? item.versions.join(", ")
                        : "normal"
                }`
            );

            console.log(
                `   Score: ${item.score}`
            );
        }
    );

    // ============================================================
    // ESCOLHA FINAL
    // ============================================================

    const selected = candidates[0];

    if (!selected) {
        throw new Error(
            "Não foi possível escolher uma música."
        );
    }

    console.log(
        "\n🎵 YOUTUBE ESCOLHIDO:"
    );

    console.log(
        "Título:",
        selected.title
    );

    console.log(
        "Canal:",
        selected.uploader
    );

    console.log(
        "Duração:",
        formatDuration(selected.duration)
    );

    console.log(
        "Versão:",
        selected.versions.length
            ? selected.versions.join(", ")
            : "normal"
    );

    console.log(
        "Score:",
        selected.score
    );

    console.log(
        "ID:",
        selected.id
    );

    return selected;
}

// ============================================================
// DOWNLOAD MP3
// ============================================================

async function downloadMp3(
    youtubeUrl,
    outputPath
) {

    console.log(
        "[DOWNLOAD DEBUG] Yoinku configurada:",
        temYoinkuConfigurada(),
        "| RapidAPI configurada:",
        temRapidApiConfigurada()
    );

    // ============================================================
    // 1ª TENTATIVA: YOINKU (API externa, MP3+MP4, mais leve)
    // ============================================================

    if (temYoinkuConfigurada()) {

        try {

            return await downloadViaYoinku(
                youtubeUrl,
                outputPath,
                "audio"
            );

        } catch (yoinkuError) {

            console.error(
                "⚠️ Yoinku falhou no MP3, tentando próxima opção:",
                yoinkuError?.message || yoinkuError
            );
        }
    }

    // ============================================================
    // 2ª TENTATIVA: youtube-mp36 (API externa, só MP3)
    // ============================================================

    if (temRapidApiConfigurada()) {

        try {

            return await downloadMp3ViaApi(
                youtubeUrl,
                outputPath
            );

        } catch (apiError) {

            console.error(
                "⚠️ API externa falhou no MP3, tentando yt-dlp:",
                apiError?.message || apiError
            );
        }
    }

    try {

        await execFileAsync(
            YTDLP,
            [
                ...REMOTE_COMPONENTS_ARGS,
                "--no-playlist",
                "-f",
                "ba/b",
                "-x",
                "--audio-format",
                "mp3",
                "--audio-quality",
                "0",
                "--ffmpeg-location",
                FFMPEG_PATH,
                ...cookiesArgs(),
                ...EXTRACTOR_ARGS,
                "-o",
                outputPath,
                youtubeUrl
            ],
            {
                timeout: 10 * 60 * 1000,
                maxBuffer: 5 * 1024 * 1024,
                env: execEnvComTmp()
            }
        );

        if (!fs.existsSync(outputPath)) {
            throw new Error(
                "O MP3 não foi criado."
            );
        }

        return outputPath;

    } catch (error) {

        console.error(
            "⚠️ yt-dlp falhou no MP3, tentando fallback:",
            error?.message || error
        );

        if (!downloadViaCobalt) {
            throw error;
        }

        try {

            return await downloadViaCobalt(
                youtubeUrl,
                outputPath,
                "audio"
            );

        } catch (cobaltError) {

            console.error(
                "❌ Fallback Cobalt também falhou:",
                cobaltError?.message || cobaltError
            );

            throw error;
        }
    }
}

// ============================================================
// MP4
// ============================================================

async function downloadMp4(
    youtubeUrl,
    outputPath
) {

    // ============================================================
    // 1ª TENTATIVA: YOINKU (API externa, mais leve)
    // ============================================================

    if (temYoinkuConfigurada()) {

        try {

            return await downloadViaYoinku(
                youtubeUrl,
                outputPath,
                "video"
            );

        } catch (yoinkuError) {

            console.error(
                "⚠️ Yoinku falhou no MP4, tentando próxima opção:",
                yoinkuError?.message || yoinkuError
            );
        }
    }

    try {

        await execFileAsync(
            YTDLP,
            [
                ...REMOTE_COMPONENTS_ARGS,
                "-f",
                "bv*+ba/b",
                "--merge-output-format",
                "mp4",
                "--ffmpeg-location",
                FFMPEG_PATH,
                ...cookiesArgs(),
                ...EXTRACTOR_ARGS,
                "-o",
                outputPath,
                youtubeUrl
            ],
            {
                timeout: 15 * 60 * 1000,
                maxBuffer: 10 * 1024 * 1024,
                env: execEnvComTmp()
            }
        );

        if (!fs.existsSync(outputPath)) {
            throw new Error(
                "O MP4 não foi criado."
            );
        }

        return outputPath;

    } catch (error) {

        console.error(
            "⚠️ yt-dlp falhou no MP4, tentando fallback:",
            error?.message || error
        );

        if (!downloadViaCobalt) {
            throw error;
        }

        try {

            return await downloadViaCobalt(
                youtubeUrl,
                outputPath,
                "auto"
            );

        } catch (cobaltError) {

            console.error(
                "❌ Fallback Cobalt também falhou:",
                cobaltError?.message || cobaltError
            );

            throw error;
        }
    }
}

// ============================================================
// CAPA
// ============================================================

async function downloadCover(
    url,
    outputPath
) {

    if (!url) {
        return false;
    }

    try {

        const response =
            await axios.get(
                url,
                {
                    responseType:
                        "arraybuffer",

                    timeout: 20000,

                    headers: {
                        "User-Agent":
                            "URSINHO-X-BOT-V2/1.0"
                    }
                }
            );

        fs.writeFileSync(
            outputPath,
            response.data
        );

        return true;

    } catch (error) {

        console.error(
            "Erro ao baixar capa:",
            error.response?.status ||
            error.message
        );

        return false;
    }
}

// ============================================================
// ID3
// ============================================================

function applyID3(
    mp3Path,
    music,
    coverBuffer = null
) {

    const tags = {

        title:
            music.title,

        artist:
            music.artist,

        album:
            music.album || "",

        year:
            music.date
                ? String(
                    music.date
                ).slice(0, 4)
                : "",

        genre:
            "Music"
    };

    if (coverBuffer) {

        tags.image = {

            mime:
                "image/jpeg",

            type: {
                id: 3,
                name: "front cover"
            },

            description:
                "Cover",

            imageBuffer:
                coverBuffer
        };
    }

    const result =
        NodeID3.update(
            tags,
            mp3Path
        );

    if (!result) {
        throw new Error(
            "Não foi possível gravar as informações ID3."
        );
    }

    return true;
}

// ============================================================
// DOWNLOAD COMPLETO
// ============================================================

async function downloadMusic(query) {

    if (!query || !query.trim()) {
        throw new Error(
            "Informe o nome da música."
        );
    }

    ensureDownloadDir();

    const pesquisa =
        query.trim();

    console.log(
        "================================"
    );

    console.log(
        "🎵 PESQUISA:",
        pesquisa
    );

    // ========================================================
    // ITUNES
    // ========================================================

    const results =
        await searchMusic(
            pesquisa,
            5
        );

    if (
        !results ||
        !results.length
    ) {
        throw new Error(
            "Música não encontrada no serviço musical."
        );
    }

    const music =
        results[0];

    console.log(
        "🎼 Música escolhida:"
    );

    console.log(
        "Título:",
        music.title
    );

    console.log(
        "Artista:",
        music.artist
    );

    console.log(
        "Álbum:",
        music.album || "N/A"
    );

    console.log(
        "Duração:",
        formatDuration(
            music.duration
        )
    );

    console.log(
        "Capa:",
        music.coverUrl
            ? "SIM"
            : "NÃO"
    );

    // ========================================================
    // CACHE: música já baixada nas últimas horas é reaproveitada
    // (poupa pedidos às APIs externas e é instantâneo)
    // ========================================================

    {
        const cacheNome =
            `${sanitizeFileName(music.title)} - ${sanitizeFileName(music.artist)}.mp3`;

        const emCache =
            obterDoCache(path.join(DOWNLOAD_DIR, cacheNome));

        if (emCache) {

            console.log("♻️ Música em cache, a reutilizar:", cacheNome);

            return {
                path: emCache,
                fileName: cacheNome,
                title: music.title,
                artist: music.artist,
                album: music.album || "",
                duration: music.duration,
                durationText: formatDuration(music.duration),
                coverUrl: music.coverUrl || null,
                youtubeUrl: null,
                youtubeId: null,
                fromCache: true
            };
        }
    }

    // ========================================================
    // YOUTUBE
    // ========================================================

    const youtubeQuery =
        `${music.title} ${music.artist}`;

    const youtube =
        await searchYouTube(
            youtubeQuery,
            music.duration
        );

    // ========================================================
    // NOME DOS ARQUIVOS
    // ========================================================

    const fileName =
        `${sanitizeFileName(
            music.title
        )} - ${sanitizeFileName(
            music.artist
        )}.mp3`;

    const mp3Path =
        path.join(
            DOWNLOAD_DIR,
            fileName
        );

    const coverPath =
        path.join(
            DOWNLOAD_DIR,
            `${sanitizeFileName(
                music.title
            )}-cover.jpg`
        );

    // ========================================================
    // MP3
    // ========================================================

    marcarEmUso(mp3Path);

    console.log(
        "⬇️ Baixando MP3..."
    );

    await downloadMp3(
        youtube.url,
        mp3Path
    );

    console.log(
        "✅ MP3 baixado."
    );

    // ========================================================
    // CAPA
    // ========================================================

    let coverBuffer = null;

    if (music.coverUrl) {

        console.log(
            "🖼️ Baixando capa..."
        );

        const coverOk =
            await downloadCover(
                music.coverUrl,
                coverPath
            );

        if (coverOk) {

            coverBuffer =
                fs.readFileSync(
                    coverPath
                );

            console.log(
                "✅ Capa baixada."
            );
        }
    }

    // ========================================================
    // ID3
    // ========================================================

    console.log(
        "🏷️ Aplicando informações ID3..."
    );

    applyID3(
        mp3Path,
        music,
        coverBuffer
    );

    console.log(
        "✅ ID3 aplicado."
    );

    liberar(mp3Path);

    // ========================================================
    // REMOVER CAPA TEMPORÁRIA
    // ========================================================

    if (
        fs.existsSync(
            coverPath
        )
    ) {

        fs.unlinkSync(
            coverPath
        );
    }

    console.log(
        "================================"
    );

    return {

        path:
            mp3Path,

        fileName,

        title:
            music.title,

        artist:
            music.artist,

        album:
            music.album || "",

        duration:
            music.duration,

        durationText:
            formatDuration(
                music.duration
            ),

        coverUrl:
            music.coverUrl || null,

        youtubeUrl:
            youtube.url,

        youtubeId:
            youtube.id
    };
}


// ============================================================
// DOWNLOAD COMPLETO PELO ID DO ITUNES
// ============================================================

async function downloadMusicById(trackId) {

    if (!trackId) {
        throw new Error("ID da música não informado.");
    }

    ensureDownloadDir();

    console.log("================================");
    console.log("🎵 DOWNLOAD PELO ID");
    console.log("🆔 Track ID:", trackId);

    // ========================================================
    // BUSCAR MÚSICA EXATA NO ITUNES
    // ========================================================

    const music = await getMusicById(trackId);

    if (!music || !music.title || !music.artist) {
        throw new Error("Música não encontrada pelo ID.");
    }

    console.log("🎼 Música encontrada:");
    console.log("Título:", music.title);
    console.log("Artista:", music.artist);
    console.log("Álbum:", music.album || "N/A");
    console.log("Duração:", formatDuration(music.duration));
    console.log("Capa:", music.coverUrl ? "SIM" : "NÃO");

    // ========================================================
    // CACHE: música já baixada nas últimas horas é reaproveitada
    // (poupa pedidos às APIs externas e é instantâneo)
    // ========================================================

    {
        const cacheNome =
            `${sanitizeFileName(music.title)} - ${sanitizeFileName(music.artist)}.mp3`;

        const emCache =
            obterDoCache(path.join(DOWNLOAD_DIR, cacheNome));

        if (emCache) {

            console.log("♻️ Música em cache, a reutilizar:", cacheNome);

            return {
                path: emCache,
                fileName: cacheNome,
                title: music.title,
                artist: music.artist,
                album: music.album || "",
                duration: music.duration,
                durationText: formatDuration(music.duration),
                coverUrl: music.coverUrl || null,
                youtubeUrl: null,
                youtubeId: null,
                trackId: String(trackId),
                fromCache: true
            };
        }
    }

    // ========================================================
    // YOUTUBE — USAR A MÚSICA EXATA ENCONTRADA
    // ========================================================

    const youtubeQuery = `${music.title} ${music.artist}`;

    const youtube = await searchYouTube(
        youtubeQuery,
        music.duration
    );

    if (!youtube || !youtube.url) {
        throw new Error("Não foi encontrado vídeo correspondente.");
    }

    // ========================================================
    // NOME DOS ARQUIVOS
    // ========================================================

    const fileName =
        `${sanitizeFileName(music.title)} - ${sanitizeFileName(music.artist)}.mp3`;

    const mp3Path = path.join(
        DOWNLOAD_DIR,
        fileName
    );

    const coverPath = path.join(
        DOWNLOAD_DIR,
        `${sanitizeFileName(music.title)}-cover.jpg`
    );

    // ========================================================
    // MP3
    // ========================================================

    marcarEmUso(mp3Path);

    console.log("⬇️ Baixando MP3...");

    await downloadMp3(
        youtube.url,
        mp3Path
    );

    console.log("✅ MP3 baixado.");

    // ========================================================
    // CAPA
    // ========================================================

    let coverBuffer = null;

    if (music.coverUrl) {

        console.log("🖼️ Baixando capa...");

        const coverOk = await downloadCover(
            music.coverUrl,
            coverPath
        );

        if (coverOk) {

            coverBuffer = fs.readFileSync(
                coverPath
            );

            console.log("✅ Capa baixada.");
        }
    }

    // ========================================================
    // ID3
    // ========================================================

    console.log("🏷️ Aplicando informações ID3...");

    applyID3(
        mp3Path,
        music,
        coverBuffer
    );

    console.log("✅ ID3 aplicado.");

    liberar(mp3Path);

    // ========================================================
    // REMOVER CAPA TEMPORÁRIA
    // ========================================================

    if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
    }

    console.log("================================");

    return {
        path: mp3Path,
        fileName,
        title: music.title,
        artist: music.artist,
        album: music.album || "",
        duration: music.duration,
        durationText: formatDuration(music.duration),
        coverUrl: music.coverUrl || null,
        youtubeUrl: youtube.url,
        youtubeId: youtube.id,
        trackId: String(trackId)
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    // Downloads passam pela fila (limite de simultâneos)
    downloadMusic: comFila(downloadMusic),
    downloadMusicById: comFila(downloadMusicById),
    searchYouTube,
    downloadMp3,
    downloadMp4: comFila(downloadMp4),
    downloadCover,
    applyID3

};
