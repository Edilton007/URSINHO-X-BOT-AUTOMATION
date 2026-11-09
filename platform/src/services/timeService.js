// ============================================================
// timeService.js — HORA/DATA DE MOÇAMBIQUE (Africa/Maputo)
//
// PROBLEMA QUE ISTO RESOLVE:
// Até agora, vários comandos usavam `new Date()` e
// `toLocaleTimeString()` diretamente, que usam o fuso horário
// configurado no SISTEMA OPERATIVO do servidor — e isso varia
// de host para host (HeavenCloud, Wispbyte, etc.), nunca é
// garantidamente o horário de Moçambique. Foi por isto que um
// horário configurado para as 00:20 disparou às 06:20 de
// verdade — o servidor não estava a pensar em hora de Maputo.
//
// SOLUÇÃO:
// Moçambique (Africa/Maputo) está sempre em UTC+2, o ano
// inteiro — não tem horário de verão. Por isso, em vez de
// confiar no fuso do servidor, calculamos tudo a partir do
// UTC real (que é sempre correto, universal) + 2 horas fixas.
// Isto funciona da mesma forma em QUALQUER servidor, não
// importa como o host tenha configurado o relógio dele.
//
// REGRA DO PROJETO: qualquer comando/serviço que precise de
// mostrar ou calcular a hora atual deve usar as funções deste
// ficheiro — nunca `new Date().toLocaleTimeString()` direto.
// ============================================================

const FUSO_MAPUTO_OFFSET_HORAS = 2; // Africa/Maputo = UTC+2, sem horário de verão
const FUSO_MAPUTO_OFFSET_MS = FUSO_MAPUTO_OFFSET_HORAS * 60 * 60 * 1000;

/**
 * Devolve um objeto com os campos da hora ATUAL em Maputo,
 * calculados a partir do UTC real — não depende do fuso do
 * servidor.
 */
function agoraMaputo() {

    const agoraMs = Date.now();
    const maputoMs = agoraMs + FUSO_MAPUTO_OFFSET_MS;
    const d = new Date(maputoMs);

    return {
        ano: d.getUTCFullYear(),
        mes: d.getUTCMonth(), // 0-11
        dia: d.getUTCDate(),
        hora: d.getUTCHours(),
        minuto: d.getUTCMinutes(),
        segundo: d.getUTCSeconds(),
        timestampMs: agoraMs
    };
}

/**
 * Converte um timestamp (ms, UTC real) para os campos de hora
 * em Maputo — útil para formatar timestamps já guardados
 * (ex: criadaEmMs de uma operação).
 */
function paraCamposMaputo(timestampMs) {

    const maputoMs = timestampMs + FUSO_MAPUTO_OFFSET_MS;
    const d = new Date(maputoMs);

    return {
        ano: d.getUTCFullYear(),
        mes: d.getUTCMonth(),
        dia: d.getUTCDate(),
        hora: d.getUTCHours(),
        minuto: d.getUTCMinutes(),
        segundo: d.getUTCSeconds()
    };
}

function doisDigitos(n) {
    return String(n).padStart(2, "0");
}

/**
 * "HH:MM:SS" em hora de Maputo. Se não passares timestampMs,
 * usa a hora atual.
 */
function formatarHora(timestampMs) {

    const campos =
        typeof timestampMs === "number"
            ? paraCamposMaputo(timestampMs)
            : agoraMaputo();

    return `${doisDigitos(campos.hora)}:${doisDigitos(campos.minuto)}:${doisDigitos(campos.segundo)}`;
}

/**
 * "DD/MM/AAAA" em hora de Maputo.
 */
function formatarData(timestampMs) {

    const campos =
        typeof timestampMs === "number"
            ? paraCamposMaputo(timestampMs)
            : agoraMaputo();

    return `${doisDigitos(campos.dia)}/${doisDigitos(campos.mes + 1)}/${campos.ano}`;
}

/**
 * "DD/MM/AAAA HH:MM:SS" em hora de Maputo.
 */
function formatarDataHora(timestampMs) {
    return `${formatarData(timestampMs)} ${formatarHora(timestampMs)}`;
}

/**
 * Calcula o timestamp (ms, UTC real — pode ser usado
 * diretamente num setTimeout) do PRÓXIMO disparo de uma hora
 * "HH:MM" em Maputo — hoje, se ainda não passou, senão amanhã.
 */
function proximoDisparoMaputo(hora, minuto) {

    const agora = agoraMaputo();

    // Constrói o alvo "hoje às HH:MM em Maputo", depois
    // converte de volta para um timestamp UTC real, subtraindo
    // o deslocamento fixo de Maputo.
    const alvoComoSeFosseMaputoUTC =
        Date.UTC(agora.ano, agora.mes, agora.dia, hora, minuto, 0, 0);

    let alvoRealUTC =
        alvoComoSeFosseMaputoUTC - FUSO_MAPUTO_OFFSET_MS;

    if (alvoRealUTC <= agora.timestampMs) {
        alvoRealUTC += 24 * 60 * 60 * 1000; // passa para amanhã
    }

    return alvoRealUTC;
}

module.exports = {
    FUSO_MAPUTO_OFFSET_HORAS,
    agoraMaputo,
    paraCamposMaputo,
    formatarHora,
    formatarData,
    formatarDataHora,
    proximoDisparoMaputo
};
