// ============================================================
// AUTO-LIMPEZA DE DOWNLOADS E TEMPORÁRIOS
//
// - downloads/  : ficheiros baixados (música, vídeo, documentos).
//                 Apagados quando passam de DOWNLOAD_TTL_HOURS
//                 (padrão 48 h) sem serem usados.
// - tmp/        : temporários (yt-dlp, áudios de voz...). Apagados
//                 após TMP_TTL_HOURS (padrão 3 h).
// - Parciais    : .part/.ytdl/.temp com mais de 30 min.
// - Limite      : se downloads/ passar de DOWNLOAD_MAX_MB (padrão
//                 1000), apaga os mais antigos primeiro.
//
// Um ficheiro reaproveitado do cache é "tocado" (mtime = agora),
// por isso músicas pedidas com frequência ficam disponíveis.
//
// .env (tudo opcional):
//   DOWNLOAD_TTL_HOURS=48
//   TMP_TTL_HOURS=3
//   DOWNLOAD_MAX_MB=1000
//   CLEANUP_INTERVAL_MINUTES=60
//   CLEANUP_ENABLED=true
// ============================================================

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..", "..");
const DOWNLOAD_DIR = path.join(ROOT_DIR, "downloads");
const TMP_DIR = path.join(ROOT_DIR, "tmp");

const HORA = 60 * 60 * 1000;
const MINUTO = 60 * 1000;

function numeroEnv(nome, padrao) {
    const valor = parseFloat(process.env[nome]);
    return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

function config() {
    return {
        ativo:
            String(process.env.CLEANUP_ENABLED || "true")
                .toLowerCase() !== "false",
        ttlDownloads: numeroEnv("DOWNLOAD_TTL_HOURS", 48) * HORA,
        ttlTmp: numeroEnv("TMP_TTL_HOURS", 3) * HORA,
        maxBytes: numeroEnv("DOWNLOAD_MAX_MB", 1000) * 1024 * 1024,
        intervalo: numeroEnv("CLEANUP_INTERVAL_MINUTES", 60) * MINUTO
    };
}

// Ficheiros que estão a ser escritos/enviados neste momento.
// A marca expira sozinha (15 min) para nunca ficar presa se um
// download falhar a meio.
const emUso = new Map();

const VALIDADE_USO = 15 * MINUTO;

function marcarEmUso(ficheiro) {
    if (!ficheiro) return;
    emUso.set(path.resolve(ficheiro), Date.now() + VALIDADE_USO);
}

function liberar(ficheiro) {
    if (!ficheiro) return;
    emUso.delete(path.resolve(ficheiro));
}

function estaEmUso(ficheiro) {

    const chave = path.resolve(ficheiro);

    const expira = emUso.get(chave);

    if (!expira) return false;

    if (expira < Date.now()) {
        emUso.delete(chave);
        return false;
    }

    return true;
}

function formatarMB(bytes) {
    return (bytes / 1024 / 1024).toFixed(1);
}

// Lista todos os ficheiros (recursivo, sem seguir links simbólicos)
function listarFicheiros(dir) {

    const resultado = [];

    let entradas = [];

    try {
        entradas = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return resultado;
    }

    for (const entrada of entradas) {

        if (entrada.name.startsWith(".")) continue;

        const caminho = path.join(dir, entrada.name);

        try {

            const info = fs.lstatSync(caminho);

            if (info.isSymbolicLink()) continue;

            if (info.isDirectory()) {
                resultado.push(...listarFicheiros(caminho));
            } else if (info.isFile()) {
                resultado.push({
                    caminho,
                    tamanho: info.size,
                    modificado: info.mtimeMs
                });
            }

        } catch {}
    }

    return resultado;
}

// Apaga pastas vazias dentro de `raiz` (nunca a própria raiz)
function removerPastasVazias(raiz) {

    let entradas = [];

    try {
        entradas = fs.readdirSync(raiz, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entrada of entradas) {

        if (!entrada.isDirectory() || entrada.isSymbolicLink()) continue;

        const sub = path.join(raiz, entrada.name);

        removerPastasVazias(sub);

        try {
            if (fs.readdirSync(sub).length === 0) {
                fs.rmdirSync(sub);
            }
        } catch {}
    }
}

function apagar(ficheiro, resumo) {

    try {
        fs.unlinkSync(ficheiro.caminho);
        resumo.removidos++;
        resumo.bytes += ficheiro.tamanho;
    } catch {}
}

const PARCIAL = /\.(part|ytdl|temp|tmp|crdownload)$/i;

/**
 * Faz uma limpeza.
 * opcoes.minIdade: ignora ficheiros mais novos que isto (ms)
 *   (usado pelo comando manual; padrão = regras normais)
 */
function limparAgora(opcoes = {}) {

    const cfg = config();

    const resumo = { removidos: 0, bytes: 0 };

    const agora = Date.now();

    const forcado = typeof opcoes.minIdade === "number";

    const usavel = (f) => !estaEmUso(f.caminho);

    // ---- downloads/: por idade
    const downloads = listarFicheiros(DOWNLOAD_DIR);

    for (const f of downloads) {

        if (!usavel(f)) continue;

        const idade = agora - f.modificado;

        const limite =
            forcado
                ? opcoes.minIdade
                : PARCIAL.test(f.caminho)
                    ? 30 * MINUTO
                    : cfg.ttlDownloads;

        if (idade >= limite) {
            apagar(f, resumo);
        }
    }

    // ---- tmp/: temporários antigos
    for (const f of listarFicheiros(TMP_DIR)) {

        if (!usavel(f)) continue;

        const idade = agora - f.modificado;

        const limite = forcado ? opcoes.minIdade : cfg.ttlTmp;

        if (idade >= limite) {
            apagar(f, resumo);
        }
    }

    // ---- limite de tamanho em downloads/ (mais antigos primeiro)
    let restantes = listarFicheiros(DOWNLOAD_DIR);

    let total = restantes.reduce((soma, f) => soma + f.tamanho, 0);

    if (total > cfg.maxBytes) {

        restantes.sort((a, b) => a.modificado - b.modificado);

        for (const f of restantes) {

            if (total <= cfg.maxBytes * 0.8) break;

            // nunca apaga o que acabou de ser mexido (pode estar a ser usado)
            if (!usavel(f) || agora - f.modificado < 10 * MINUTO) continue;

            apagar(f, resumo);
            total -= f.tamanho;
        }
    }

    removerPastasVazias(DOWNLOAD_DIR);
    removerPastasVazias(TMP_DIR);

    return resumo;
}

function estatisticas() {

    const cfg = config();

    const ficheiros = listarFicheiros(DOWNLOAD_DIR);
    const temporarios = listarFicheiros(TMP_DIR);

    const soma = (lista) =>
        lista.reduce((s, f) => s + f.tamanho, 0);

    const maisAntigo =
        ficheiros.length
            ? Math.min(...ficheiros.map(f => f.modificado))
            : null;

    return {
        downloads: ficheiros.length,
        downloadsMB: formatarMB(soma(ficheiros)),
        temporarios: temporarios.length,
        temporariosMB: formatarMB(soma(temporarios)),
        maisAntigoHoras:
            maisAntigo
                ? ((Date.now() - maisAntigo) / HORA).toFixed(1)
                : null,
        ttlHoras: cfg.ttlDownloads / HORA,
        limiteMB: cfg.maxBytes / 1024 / 1024
    };
}

/**
 * Chamada antes de um download: se a pasta já passou do limite,
 * limpa primeiro para não encher o disco da hospedagem.
 */
function garantirEspaco() {

    try {

        const cfg = config();

        const total = listarFicheiros(DOWNLOAD_DIR)
            .reduce((s, f) => s + f.tamanho, 0);

        if (total > cfg.maxBytes) {
            const r = limparAgora();
            if (r.removidos) {
                console.log(
                    `🧹 Disco: limpeza antes do download (${r.removidos} ficheiros, ${formatarMB(r.bytes)} MB).`
                );
            }
        }

    } catch {}
}

/**
 * Devolve o caminho se existir um ficheiro válido em cache
 * (completo, não está a ser escrito e não expirou); renova a
 * validade. Caso contrário devolve null.
 */
function obterDoCache(ficheiro, tamanhoMinimo = 50 * 1024) {

    try {

        if (!ficheiro || estaEmUso(ficheiro) || !fs.existsSync(ficheiro)) {
            return null;
        }

        const info = fs.statSync(ficheiro);

        if (
            !info.isFile() ||
            info.size < tamanhoMinimo ||
            Date.now() - info.mtimeMs > config().ttlDownloads
        ) {
            return null;
        }

        const agora = new Date();
        fs.utimesSync(ficheiro, agora, agora);

        return ficheiro;

    } catch {
        return null;
    }
}

let temporizador = null;

function iniciarLimpezaAutomatica() {

    const cfg = config();

    if (!cfg.ativo || temporizador) {
        return;
    }

    const executar = () => {

        try {

            const r = limparAgora();

            if (r.removidos) {
                console.log(
                    `🧹 Auto-limpeza: ${r.removidos} ficheiro(s) apagado(s), ${formatarMB(r.bytes)} MB libertados.`
                );
            }

        } catch (error) {
            console.error(
                "❌ Erro na auto-limpeza:",
                error?.message || error
            );
        }
    };

    // Primeira passagem pouco depois de arrancar (apanha o que ficou
    // de antes de reiniciar) e depois periodicamente.
    setTimeout(executar, 30 * 1000).unref();

    temporizador = setInterval(executar, cfg.intervalo);
    temporizador.unref();

    console.log(
        `🧹 Auto-limpeza ativa: downloads apagados após ${cfg.ttlDownloads / HORA} h, limite ${cfg.maxBytes / 1024 / 1024} MB.`
    );
}

module.exports = {
    iniciarLimpezaAutomatica,
    limparAgora,
    estatisticas,
    garantirEspaco,
    obterDoCache,
    marcarEmUso,
    liberar
};
