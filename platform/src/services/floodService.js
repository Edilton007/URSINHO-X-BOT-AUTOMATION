/* ============================================================
   ANTI-FLOOD

   Deteta quando um utilizador envia mensagens demais num
   curto espaço de tempo dentro de um grupo.

   Isto é estado em memória (não vai para o db.json) porque
   é informação efémera — só interessa "agora", não precisa
   sobreviver a um reinício do bot.
============================================================ */

const floodMap = new Map();

const DEFAULT_MAX_MESSAGES = 6;
const DEFAULT_WINDOW_MS = 8000;


function checkFlood(
    chat,
    sender,
    {
        maxMessages = DEFAULT_MAX_MESSAGES,
        windowMs = DEFAULT_WINDOW_MS
    } = {}
) {

    const key = `${chat}:${sender}`;

    const now = Date.now();

    const timestamps =
        (floodMap.get(key) || [])
            .filter(ts => now - ts < windowMs);

    timestamps.push(now);

    floodMap.set(key, timestamps);

    return timestamps.length > maxMessages;
}


/* limpa entradas antigas periodicamente para não crescer
   sem controlo em memória num bot com muitos grupos ativos */

setInterval(() => {

    const now = Date.now();

    for (const [key, timestamps] of floodMap.entries()) {

        const recent =
            timestamps.filter(
                ts => now - ts < 60000
            );

        if (recent.length === 0) {
            floodMap.delete(key);
        } else {
            floodMap.set(key, recent);
        }
    }

}, 60000);


module.exports = {
    checkFlood
};
