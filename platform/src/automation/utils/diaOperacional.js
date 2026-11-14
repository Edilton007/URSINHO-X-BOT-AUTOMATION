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
 * OPERATION_DAY_OFFSET_MIN permite ajustar o desvio em minutos (padrão 120);
 * valores ausentes, vazios ou inválidos usam o padrão.
 */
const DIAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DESVIO_PADRAO_MIN = 120;

/**
 * Lê OPERATION_DAY_OFFSET_MIN. Ausente, vazia, só com espaços, não inteira ou
 * fora de -720..840 usa o padrão de Maputo (120). Number("") vale 0, por isso
 * uma variável criada e deixada em branco no painel do servidor viraria UTC
 * em silêncio se o valor fosse convertido sem verificar o texto antes.
 * Um "0" escrito de propósito continua a ser aceite.
 */
function desvioMs() {
    const texto = String(process.env.OPERATION_DAY_OFFSET_MIN ?? "").trim();
    if (!/^[+-]?\d+$/.test(texto)) return DESVIO_PADRAO_MIN * 60 * 1000;

    const minutos = Number(texto);
    if (minutos < -720 || minutos > 840) return DESVIO_PADRAO_MIN * 60 * 1000;
    return minutos * 60 * 1000;
}

function diaOperacional(ms = Date.now()) {
    const base = Number.isFinite(ms) ? ms : 0;
    const d = new Date(base + desvioMs());
    const dia = String(d.getUTCDate()).padStart(2, "0");
    return `${DIAS[d.getUTCDay()]} ${MESES[d.getUTCMonth()]} ${dia} ${d.getUTCFullYear()}`;
}

module.exports = { diaOperacional };
