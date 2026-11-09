const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const ROOT_DIR = path.join(__dirname, "../..");
const DOWNLOAD_DIR = path.join(ROOT_DIR, "downloads");
// Preferimos o binário standalone (bin/yt-dlp, sem Python).
// Se ainda não foi baixado, cai pro antigo via youtube-dl-exec.
const STANDALONE_YTDLP = path.join(ROOT_DIR, "bin", "yt-dlp");
const LEGACY_YTDLP = path.join(
    ROOT_DIR,
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

// Desligado por omissão — depende do GitHub, que este host não
// alcança (ver musicDownloadService.js para a explicação completa).
const REMOTE_COMPONENTS_ARGS =
    process.env.YT_REMOTE_COMPONENTS === "on"
        ? ["--remote-components", "ejs:github", "--js-runtimes", "node"]
        : [];

// Cookies opcionais (mesma lógica do musicDownloadService.js)
const COOKIES_PATH = process.env.COOKIES_PATH || "";

function cookiesArgs() {
    if (COOKIES_PATH && fs.existsSync(COOKIES_PATH)) {
        return ["--cookies", COOKIES_PATH];
    }
    return [];
}

const EXTRACTOR_ARGS =
    process.env.YT_EXTRACTOR_ARGS !== "off"
        ? ["--extractor-args", process.env.YT_EXTRACTOR_ARGS || "youtube:player_client=android,web_embedded"]
        : [];

// TMPDIR próprio (disco principal, não o /tmp limitado do sistema)
// — mesma correção do musicDownloadService.js
const YTDLP_TMP_DIR = path.join(ROOT_DIR, "tmp");

function execEnvComTmp() {
    if (!fs.existsSync(YTDLP_TMP_DIR)) {
        fs.mkdirSync(YTDLP_TMP_DIR, { recursive: true });
    }
    return {
        ...process.env,
        TMPDIR: YTDLP_TMP_DIR,
        TMP: YTDLP_TMP_DIR,
        TEMP: YTDLP_TMP_DIR
    };
}

const INFO_TIMEOUT = 60 * 1000;
const DOWNLOAD_TIMEOUT = 10 * 60 * 1000;
const MAX_BUFFER = 10 * 1024 * 1024;

function ensureDownloadDir() {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

function isFacebookUrl(url) {
    return /^https?:\/\/(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch)\//i.test(
        String(url || "").trim()
    );
}

function sanitizeFileName(name) {
    return String(name || "facebook-video")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "facebook-video";
}

async function getVideoInfo(url) {
    if (!isFacebookUrl(url)) {
        throw new Error("URL inválida do Facebook.");
    }

    const { stdout } = await execFileAsync(
        YTDLP,
        [
            ...REMOTE_COMPONENTS_ARGS,
            "--dump-single-json",
            "--skip-download",
            "--no-warnings",
            ...cookiesArgs(),
            ...EXTRACTOR_ARGS,
            url
        ],
        {
            timeout: INFO_TIMEOUT,
            maxBuffer: MAX_BUFFER,
            env: execEnvComTmp()
        }
    );

    try {
        return JSON.parse(stdout);
    } catch {
        throw new Error("O yt-dlp não retornou informações válidas.");
    }
}

async function validarVideo(filePath) {

    try {

        await execFileAsync(
            FFMPEG_PATH,
            [
                "-v", "error",
                "-i", filePath,
                "-t", "1",
                "-f", "null",
                "-"
            ],
            {
                timeout: 30000,
                env: execEnvComTmp()
            }
        );

        return true;

    } catch (error) {

        console.error(
            "⚠️ Vídeo do Facebook parece corrompido:",
            error?.message || error
        );

        return false;
    }
}

async function downloadFacebookVideo(url) {
    if (!isFacebookUrl(url)) {
        throw new Error("Este link não é do Facebook.");
    }

    ensureDownloadDir();

    const info = await getVideoInfo(url);

    if (!info) {
        throw new Error("Não foi possível obter informações do vídeo.");
    }

    const title = info.title || "video-facebook";
    const safeTitle = sanitizeFileName(title);

    // ID + timestamp evita colisões entre downloads
    const uniqueId = info.id || Date.now().toString();

    const baseName = `facebook-${uniqueId}-${Date.now()}`;
    const outputTemplate = path.join(DOWNLOAD_DIR, `${baseName}.%(ext)s`);

    console.log("================================");
    console.log("📘 FACEBOOK DOWNLOAD");
    console.log("Título:", title);
    console.log("URL:", url);

    await execFileAsync(
        YTDLP,
        [
            ...REMOTE_COMPONENTS_ARGS,

            "-f", "bv*+ba/b",
            "--merge-output-format", "mp4",
            "--ffmpeg-location", FFMPEG_PATH,

            "--no-playlist",
            "--no-warnings",
            ...cookiesArgs(),
            ...EXTRACTOR_ARGS,

            "-o", outputTemplate,

            url
        ],
        {
            timeout: DOWNLOAD_TIMEOUT,
            maxBuffer: MAX_BUFFER,
            env: execEnvComTmp()
        }
    );

    const files = fs.readdirSync(DOWNLOAD_DIR);

    const downloadedFile = files.find((file) =>
        file.startsWith(`${baseName}.`)
    );

    if (!downloadedFile) {
        throw new Error("O vídeo não foi encontrado após o download.");
    }

    const sourcePath = path.join(DOWNLOAD_DIR, downloadedFile);

    // Renomeia para um nome amigável sem perder a unicidade
    const finalName = `${safeTitle}-${uniqueId}.mp4`;
    const finalPath = path.join(DOWNLOAD_DIR, finalName);

    if (sourcePath !== finalPath) {
        fs.renameSync(sourcePath, finalPath);
    }

    // Confirma que o vídeo não veio corrompido antes de mandar
    const valido = await validarVideo(finalPath);

    if (!valido) {

        try { fs.unlinkSync(finalPath); } catch {}

        throw new Error(
            "O vídeo baixado veio corrompido/incompleto (o Facebook às vezes bloqueia parte do stream). Tenta novamente ou usa outro link."
        );
    }

    console.log("✅ Download concluído.");
    console.log("Arquivo:", finalName);
    console.log("================================");

    return {
        path: finalPath,
        fileName: finalName,
        title,
        duration: info.duration || null,
        thumbnail: info.thumbnail || null,
        id: info.id || null
    };
}

const { comFila } = require("./downloadQueueService");

module.exports = {
    isFacebookUrl,
    downloadFacebookVideo: comFila(downloadFacebookVideo),
    getVideoInfo
};
