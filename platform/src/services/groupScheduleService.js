// ============================================================
// HORÁRIO AUTOMÁTICO DE ABRIR/FECHAR GRUPO
//
// Reaproveita o mesmo padrão de temporizadores do
// schedulerService.js (.agendar) — mas em vez de disparar uma
// vez, dispara TODOS OS DIAS à mesma hora (abre/fecha o grupo
// sozinho, sem precisar de um admin acordado para isso).
//
// Reaproveita também a ação exata que já existe em
// abrir.js/fechar.js: sock.groupSettingUpdate(chat, ...).
// ============================================================

const db = require("../database/database");
const timeService = require("./timeService");

// Mantém os temporizadores ativos em memória, para poder
// cancelá-los/reagendá-los se o horário for alterado ou
// desligado, sem precisar reiniciar o bot.
const timersAtivos = new Map();

function chaveTimer(chat, tipo) {
    return `${chat}::${tipo}`;
}

function parseHoraHHMM(texto) {

    const match =
        String(texto || "").trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);

    if (!match) {
        return null;
    }

    return {
        hora: parseInt(match[1], 10),
        minuto: parseInt(match[2], 10)
    };
}

/**
 * Calcula o timestamp do próximo disparo de uma hora HH:MM,
 * EM HORA DE MAPUTO — hoje, se ainda não passou, senão amanhã.
 * Usa timeService, que não depende do fuso horário do servidor.
 */
function calcularProximoDisparo(horaStr) {

    const partes = parseHoraHHMM(horaStr);

    if (!partes) {
        return null;
    }

    return timeService.proximoDisparoMaputo(partes.hora, partes.minuto);
}

async function dispararAcao(sock, chat, tipo) {

    try {

        await sock.groupSettingUpdate(
            chat,
            tipo === "abrir" ? "not_announcement" : "announcement"
        );

        const horaAtual = timeService.formatarHora();

        await sock.sendMessage(chat, {
            text:
                tipo === "abrir"
                    ? `╔══════════════════════╗\n║ 🔓 GRUPO ABERTO (automático)\n╚══════════════════════╝\n\n🎉 Grupo aberto automaticamente, conforme o horário definido.\n\n⏰ ${horaAtual} (hora de Moçambique)\n\n🐻 URSINHO X BOT V2`
                    : `╔══════════════════════╗\n║ 🔒 GRUPO FECHADO (automático)\n╚══════════════════════╝\n\n🔒 Grupo fechado automaticamente, conforme o horário definido.\n\n⏰ ${horaAtual} (hora de Moçambique)\n\n🐻 URSINHO X BOT V2`
        });

    } catch (error) {
        console.error(
            `[HORÁRIO AUTOMÁTICO] Erro ao ${tipo === "abrir" ? "abrir" : "fechar"} o grupo ${chat}:`,
            error?.message || error
        );
    } finally {
        // Volta a armar para amanhã, à mesma hora — é diário,
        // não dispara só uma vez (ao contrário do .agendar).
        armarHorario(sock, chat, tipo);
    }
}

function armarHorario(sock, chat, tipo) {

    const group = db.group(chat);
    const horaStr =
        tipo === "abrir"
            ? group?.horarios?.abrir
            : group?.horarios?.fechar;

    // Se o horário foi removido entretanto, não volta a armar.
    if (!horaStr) {
        return;
    }

    const proximoDisparo = calcularProximoDisparo(horaStr);

    if (!proximoDisparo) {
        return;
    }

    const chave = chaveTimer(chat, tipo);

    // Cancela um temporizador antigo para este grupo/tipo, se
    // existir, antes de armar o novo (evita duplicados).
    if (timersAtivos.has(chave)) {
        clearTimeout(timersAtivos.get(chave));
    }

    const restante = proximoDisparo - Date.now();

    const timer = setTimeout(() => {
        dispararAcao(sock, chat, tipo);
    }, restante);

    timersAtivos.set(chave, timer);
}

/**
 * Define (ou atualiza) o horário de abrir ou fechar um grupo.
 * tipo: "abrir" | "fechar"
 */
function definirHorario(sock, chat, tipo, horaStr) {

    const partes = parseHoraHHMM(horaStr);

    if (!partes) {
        return { sucesso: false, motivo: "hora_invalida" };
    }

    const group = db.group(chat);

    if (!group.horarios || typeof group.horarios !== "object") {
        group.horarios = {};
    }

    const horaFormatada =
        `${String(partes.hora).padStart(2, "0")}:${String(partes.minuto).padStart(2, "0")}`;

    group.horarios[tipo] = horaFormatada;

    db.save();

    armarHorario(sock, chat, tipo);

    return { sucesso: true, hora: horaFormatada };
}

/**
 * Remove o horário automático (abrir ou fechar) de um grupo.
 */
function removerHorario(chat, tipo) {

    const group = db.group(chat);

    if (!group.horarios || !group.horarios[tipo]) {
        return { sucesso: false, motivo: "nao_configurado" };
    }

    delete group.horarios[tipo];
    db.save();

    const chave = chaveTimer(chat, tipo);

    if (timersAtivos.has(chave)) {
        clearTimeout(timersAtivos.get(chave));
        timersAtivos.delete(chave);
    }

    return { sucesso: true };
}

/**
 * Chamado uma vez, ao ligar o bot — rearma todos os horários
 * automáticos já configurados em todos os grupos.
 */
function iniciarHorariosAutomaticosPendentes(sock) {

    let total = 0;

    for (const chat of Object.keys(db.groups || {})) {

        const horarios = db.groups[chat]?.horarios;

        if (!horarios) {
            continue;
        }

        if (horarios.abrir) {
            armarHorario(sock, chat, "abrir");
            total++;
        }

        if (horarios.fechar) {
            armarHorario(sock, chat, "fechar");
            total++;
        }
    }

    if (total > 0) {
        console.log(
            `🔓🔒 ${total} horário(s) automático(s) de abrir/fechar grupo recarregado(s).`
        );
    }
}

module.exports = {
    parseHoraHHMM,
    definirHorario,
    removerHorario,
    iniciarHorariosAutomaticosPendentes
};
