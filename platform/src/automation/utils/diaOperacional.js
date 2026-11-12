/**
 * Dia operacional do Backend.
 *
 * O limite diário de transferências por SIM conta por dia local de Maputo
 * (UTC+2, sem horário de verão), não pelo fuso do servidor. Um servidor em UTC
 * viraria o dia às 02:00 locais e abriria uma janela em que o contador estaria
 * misturado entre dois dias.
 *
 * O formato devolvido é o mesmo de Date#toDateString (ex.: "Thu Nov 12 2026"),
 * para que os contadores já gravados no JSON continuem a ser reconhecidos depois
 * da atualização.
 *
 * OPERATION_DAY_OFFSET_MIN permite ajustar o desvio em minutos (padrão 120).
 */
const DIAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function desvioMs() {
    const minutos = Number(process.env.OPERATION_DAY_OFFSET_MIN);
    return Number.isFinite(minutos) && minutos >= -720 && minutos <= 840 ? minutos * 60 * 1000 : 120 * 60 * 1000;
}

function diaOperacional(ms = Date.now()) {
    const base = Number.isFinite(ms) ? ms : 0;
    const d = new Date(base + desvioMs());
    const dia = String(d.getUTCDate()).padStart(2, "0");
    return `${DIAS[d.getUTCDay()]} ${MESES[d.getUTCMonth()]} ${dia} ${d.getUTCFullYear()}`;
}

module.exports = { diaOperacional };
