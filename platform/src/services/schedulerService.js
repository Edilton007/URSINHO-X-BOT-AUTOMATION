const schedulerDb = require("../database/schedulerDb");

// Limite máximo do setTimeout do Node (~24.8 dias). Agendamentos
// mais longos que isso são feitos em pedaços encadeados.
const MAX_TIMEOUT = 2147483647;

function parseTempo(texto) {

    const match =
        String(texto || "").trim().match(/^(\d+)\s?(s|m|h|d)$/i);

    if (!match) {
        return null;
    }

    const valor = parseInt(match[1], 10);
    const unidade = match[2].toLowerCase();

    const multiplicadores = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };

    return valor * multiplicadores[unidade];
}

async function dispararAgendamento(sock, item) {

    try {

        await sock.sendMessage(item.chat, {
            text: `⏰ *Mensagem agendada:*\n\n${item.texto}`
        });

    } catch (error) {

        console.error(
            "[AGENDAMENTOS] Erro ao enviar mensagem agendada:",
            error?.message || error
        );

    } finally {

        schedulerDb.marcarDisparado(item.id);
    }
}

function armarTimer(sock, item) {

    const restante = item.disparoEm - Date.now();

    if (restante <= 0) {
        // Já passou da hora (ex: bot esteve desligado) —
        // dispara agora, atrasado, em vez de perder de vez.
        dispararAgendamento(sock, item);
        return;
    }

    if (restante > MAX_TIMEOUT) {
        setTimeout(() => armarTimer(sock, item), MAX_TIMEOUT);
        return;
    }

    setTimeout(() => dispararAgendamento(sock, item), restante);
}

/**
 * Cria um novo agendamento e já arma o temporizador.
 */
function agendar(sock, chat, texto, criadoPor, tempoTexto) {

    const ms = parseTempo(tempoTexto);

    if (ms === null) {
        return { sucesso: false, motivo: "tempo_invalido" };
    }

    if (ms <= 0) {
        return { sucesso: false, motivo: "tempo_invalido" };
    }

    if (!texto || !texto.trim()) {
        return { sucesso: false, motivo: "mensagem_vazia" };
    }

    const disparoEm = Date.now() + ms;

    const item =
        schedulerDb.adicionar(chat, texto.trim(), criadoPor, disparoEm);

    armarTimer(sock, item);

    return { sucesso: true, item };
}

/**
 * Chamado uma vez, ao ligar o bot — recarrega os agendamentos
 * que ainda não dispararam e volta a armar os temporizadores.
 */
function iniciarAgendamentosPendentes(sock) {

    schedulerDb.limparAntigos();

    const pendentes = schedulerDb.listarPendentes();

    for (const item of pendentes) {
        armarTimer(sock, item);
    }

    if (pendentes.length > 0) {
        console.log(
            `⏰ ${pendentes.length} agendamento(s) pendente(s) recarregado(s).`
        );
    }
}

module.exports = {
    parseTempo,
    agendar,
    iniciarAgendamentosPendentes
};
