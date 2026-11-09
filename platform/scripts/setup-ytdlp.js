// ============================================================
// SETUP YT-DLP STANDALONE
//
// A Katabump tem Python 3.9, mas o yt-dlp (via youtube-dl-exec)
// exige Python 3.10+. Como não temos acesso root pra atualizar
// o Python, baixamos o binário "yt-dlp_linux" — uma versão
// standalone que já vem com o próprio interpretador embutido,
// não depende do Python do sistema.
//
// Execução opcional/manual: `npm run setup:media`.
// Não é executado durante a instalação normal para poupar dados e evitar downloads surpresa.
// ============================================================

const fs = require("fs");
const https = require("https");
const path = require("path");

const BIN_DIR = path.join(__dirname, "..", "bin");
const BIN_PATH = path.join(BIN_DIR, "yt-dlp");

const DOWNLOAD_URL =
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

function download(url, destPath, redirectsLeft = 5) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        let expectedSize = 0;
        let receivedSize = 0;

        https
            .get(url, (response) => {
                if (
                    response.statusCode >= 300 &&
                    response.statusCode < 400 &&
                    response.headers.location
                ) {
                    file.close();
                    fs.unlinkSync(destPath);

                    if (redirectsLeft <= 0) {
                        return reject(
                            new Error("Muitos redirecionamentos.")
                        );
                    }

                    return resolve(
                        download(
                            response.headers.location,
                            destPath,
                            redirectsLeft - 1
                        )
                    );
                }

                if (response.statusCode !== 200) {
                    file.close();
                    return reject(
                        new Error(
                            `Falha ao baixar yt-dlp: HTTP ${response.statusCode}`
                        )
                    );
                }

                expectedSize = parseInt(
                    response.headers["content-length"] || "0",
                    10
                );

                response.on("data", (chunk) => {
                    receivedSize += chunk.length;
                });

                response.pipe(file);

                file.on("finish", () => {
                    file.close(() => {
                        // Confere se veio o arquivo inteiro. Se o
                        // download cortou no meio, o binário fica
                        // corrompido e falha só na hora de rodar —
                        // aqui a gente pega isso antes.
                        if (
                            expectedSize > 0 &&
                            receivedSize !== expectedSize
                        ) {
                            fs.unlinkSync(destPath);
                            return reject(
                                new Error(
                                    `Download incompleto (recebido ${receivedSize} de ${expectedSize} bytes).`
                                )
                            );
                        }

                        resolve();
                    });
                });
            })
            .on("error", (error) => {
                file.close();
                reject(error);
            });
    });
}

async function downloadWithRetry(url, destPath, attempts = 3) {
    for (let i = 1; i <= attempts; i++) {
        try {
            await download(url, destPath);
            return;
        } catch (error) {
            console.warn(
                `⚠️ Tentativa ${i}/${attempts} falhou:`,
                error?.message || error
            );

            if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
            }

            if (i === attempts) {
                throw error;
            }
        }
    }
}

async function main() {
    try {
        if (!fs.existsSync(BIN_DIR)) {
            fs.mkdirSync(BIN_DIR, { recursive: true });
        }

        console.log("⬇️  Baixando yt-dlp standalone (sem Python)...");

        await downloadWithRetry(DOWNLOAD_URL, BIN_PATH, 3);

        fs.chmodSync(BIN_PATH, 0o755);

        console.log("✅ yt-dlp standalone pronto em:", BIN_PATH);

    } catch (error) {
        console.warn(
            "⚠️ Não foi possível baixar o yt-dlp standalone:",
            error?.message || error
        );
        console.warn(
            "   O bot vai seguir usando o yt-dlp antigo (via Python) como estava."
        );
        // Não derruba o npm install por causa disso.
        process.exit(0);
    }
}

main();
