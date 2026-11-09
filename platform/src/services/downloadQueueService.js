// ============================================================
// FILA DE DOWNLOADS
//
// Limita quantos downloads/conversões correm ao mesmo tempo
// (padrão 2) para não rebentar a RAM/CPU de uma hospedagem
// pequena. Os restantes esperam a vez, por ordem de chegada.
//
// .env: DOWNLOAD_CONCURRENCY=2
// ============================================================

const { garantirEspaco } = require("./cleanupService");

function limite() {
    const n = parseInt(process.env.DOWNLOAD_CONCURRENCY || "2", 10);
    return Number.isFinite(n) && n > 0 ? n : 2;
}

let ativos = 0;
const espera = [];

function proximo() {

    while (ativos < limite() && espera.length) {

        const tarefa = espera.shift();

        ativos++;

        tarefa()
            .finally(() => {
                ativos--;
                proximo();
            });
    }
}

/**
 * Executa `fn` respeitando o limite de downloads simultâneos.
 */
function enfileirar(fn) {

    return new Promise((resolve, reject) => {

        espera.push(async () => {

            try {
                garantirEspaco();
                resolve(await fn());
            } catch (error) {
                reject(error);
            }
        });

        proximo();
    });
}

function comFila(fn) {
    return (...args) => enfileirar(() => fn(...args));
}

function estadoDaFila() {
    return { ativos, aEsperar: espera.length, limite: limite() };
}

module.exports = {
    enfileirar,
    comFila,
    estadoDaFila
};
