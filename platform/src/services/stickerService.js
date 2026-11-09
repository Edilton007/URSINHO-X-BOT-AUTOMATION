const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const {
    downloadMediaMessage
} = require("@whiskeysockets/baileys");

const {
    unwrapMessage
} = require("./messageService");

const execFileAsync = promisify(execFile);

const FFMPEG =
    process.env.FFMPEG_PATH ||
    require("@ffmpeg-installer/ffmpeg").path;

const MAX_VIDEO_SECONDS = 10;

function getQuotedMessage(m) {
    const contextInfo =
        m?.message?.extendedTextMessage?.contextInfo ||
        m?.message?.imageMessage?.contextInfo ||
        m?.message?.videoMessage?.contextInfo ||
        m?.message?.viewOnceMessage?.message?.extendedTextMessage?.contextInfo ||
        m?.message?.viewOnceMessage?.message?.imageMessage?.contextInfo ||
        m?.message?.viewOnceMessage?.message?.videoMessage?.contextInfo ||
        m?.message?.viewOnceMessageV2?.message?.extendedTextMessage?.contextInfo ||
        m?.message?.viewOnceMessageV2?.message?.imageMessage?.contextInfo ||
        m?.message?.viewOnceMessageV2?.message?.videoMessage?.contextInfo;

    return contextInfo?.quotedMessage || null;
}

function getMediaMessage(message) {
    const msg = unwrapMessage(message);

    if (msg?.imageMessage) {
        return {
            message: msg,
            type: "image"
        };
    }

    if (msg?.videoMessage) {
        return {
            message: msg,
            type: "video"
        };
    }

    return null;
}

async function downloadTarget(sock, targetMessage) {
    return downloadMediaMessage(
        targetMessage,
        "buffer",
        {},
        {
            logger: {
                info() {},
                error() {},
                warn() {},
                debug() {}
            },
            reuploadRequest: sock.updateMediaMessage
        }
    );
}

async function getMediaDuration(inputPath) {
    try {
        const { stdout } = await execFileAsync(
            FFMPEG,
            [
                "-hide_banner",
                "-i",
                inputPath
            ],
            {
                maxBuffer: 1024 * 1024
            }
        );

        return parseDuration(stdout);
    } catch (error) {
        const output =
            `${error?.stdout || ""}\n${error?.stderr || ""}`;

        return parseDuration(output);
    }
}

function parseDuration(output) {
    const match = String(output || "").match(
        /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i
    );

    if (!match) {
        return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);

    return (
        hours * 3600 +
        minutes * 60 +
        seconds
    );
}

async function convertImageToSticker(inputPath, outputPath) {
    await execFileAsync(
        FFMPEG,
        [
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",

            "-i",
            inputPath,

            "-vf",
            "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",

            "-c:v",
            "libwebp",

            "-lossless",
            "0",

            "-q:v",
            "70",

            "-compression_level",
            "6",

            "-an",

            outputPath
        ],
        {
            maxBuffer: 1024 * 1024 * 4
        }
    );
}

async function convertVideoToSticker(inputPath, outputPath) {
    await execFileAsync(
        FFMPEG,
        [
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",

            "-i",
            inputPath,

            "-t",
            String(MAX_VIDEO_SECONDS),

            "-vf",
            "fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",

            "-c:v",
            "libwebp",

            "-q:v",
            "60",

            "-compression_level",
            "6",

            "-loop",
            "0",

            "-an",

            outputPath
        ],
        {
            maxBuffer: 1024 * 1024 * 4
        }
    );
}

async function createSticker(sock, m) {
    let targetMessage = m;

    const ownMessage = unwrapMessage(m?.message);

    let media = getMediaMessage(ownMessage);

    /*
     * Comando enviado respondendo a uma mídia.
     */
    if (!media) {
        const quotedMessage = getQuotedMessage(m);

        if (quotedMessage) {
            targetMessage = {
                ...m,
                message: quotedMessage
            };

            media = getMediaMessage(targetMessage.message);
        }
    }

    if (!media) {
        const error = new Error(
            "MÍDIA_NÃO_ENCONTRADA"
        );

        error.code = "MÍDIA_NÃO_ENCONTRADA";

        throw error;
    }

    let buffer;

    try {
        buffer = await downloadTarget(
            sock,
            targetMessage
        );
    } catch (error) {
        console.error(
            "❌ Erro ao baixar mídia para sticker:",
            error?.message || error
        );

        const downloadError = new Error(
            "ERRO_DOWNLOAD"
        );

        downloadError.code = "ERRO_DOWNLOAD";

        throw downloadError;
    }

    if (!buffer || !buffer.length) {
        const error = new Error(
            "MÍDIA_VAZIA"
        );

        error.code = "MÍDIA_VAZIA";

        throw error;
    }

    const tempDir = fs.mkdtempSync(
        path.join(
            os.tmpdir(),
            "ursinho-sticker-"
        )
    );

    const inputPath = path.join(
        tempDir,
        media.type === "video"
            ? "input.mp4"
            : "input.jpg"
    );

    const outputPath = path.join(
        tempDir,
        "sticker.webp"
    );

    try {
        fs.writeFileSync(
            inputPath,
            buffer
        );

        /*
         * Vídeo / GIF
         */
        if (media.type === "video") {
            const duration =
                await getMediaDuration(inputPath);

            if (
                duration !== null &&
                duration > MAX_VIDEO_SECONDS
            ) {
                const error = new Error(
                    "VIDEO_MUITO_LONGO"
                );

                error.code = "VIDEO_MUITO_LONGO";
                error.duration = duration;

                throw error;
            }

            await convertVideoToSticker(
                inputPath,
                outputPath
            );
        } else {
            /*
             * Imagem
             */
            await convertImageToSticker(
                inputPath,
                outputPath
            );
        }

        if (
            !fs.existsSync(outputPath)
        ) {
            const error = new Error(
                "STICKER_NÃO_GERADO"
            );

            error.code = "STICKER_NÃO_GERADO";

            throw error;
        }

        const stickerBuffer =
            fs.readFileSync(outputPath);

        if (!stickerBuffer.length) {
            const error = new Error(
                "STICKER_VAZIO"
            );

            error.code = "STICKER_VAZIO";

            throw error;
        }

        return stickerBuffer;
    } finally {
        try {
            fs.rmSync(
                tempDir,
                {
                    recursive: true,
                    force: true
                }
            );
        } catch {}
    }
}

module.exports = {
    createSticker,
    getQuotedMessage,
    getMediaMessage
};
