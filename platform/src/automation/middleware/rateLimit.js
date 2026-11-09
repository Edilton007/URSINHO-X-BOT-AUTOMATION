// Limite de tentativas falhadas nas rotas administrativas.
//
// Depois de ADMIN_MAX_FALHAS (padrão 10) respostas 401/403 do mesmo IP
// em 10 minutos, o IP fica bloqueado 15 minutos (429). Tudo em memória:
// reiniciar o servidor zera os contadores.
//
// IP: por padrão usa o endereço da ligação (não confia em cabeçalhos que o
// cliente pode forjar). Atrás de um proxy todos os pedidos podem chegar com
// o mesmo IP; se tiver CERTEZA de que o servidor só é acessível através de
// um proxy que acrescenta X-Forwarded-For, defina ADMIN_TRUST_PROXY=true e
// será usado o ÚLTIMO valor desse cabeçalho (o do proxy mais próximo).

const FALHAS_MAX = Number(process.env.ADMIN_MAX_FALHAS) > 0 ? Number(process.env.ADMIN_MAX_FALHAS) : 10;
const JANELA_MS = 10 * 60 * 1000;
const BLOQUEIO_MS = 15 * 60 * 1000;

const registos = new Map();

function ipDe(req) {
    if (String(process.env.ADMIN_TRUST_PROXY || "").toLowerCase() === "true") {
        const xff = String(req.headers["x-forwarded-for"] || "");
        const ultimo = xff.split(",").map((s) => s.trim()).filter(Boolean).pop();
        if (ultimo) return ultimo;
    }
    return (req.socket && req.socket.remoteAddress) || "desconhecido";
}

function limpar(agora) {
    if (registos.size < 1000) return;
    for (const [ip, r] of registos) {
        if (r.bloqueadoAte < agora && r.falhas.every((t) => agora - t > JANELA_MS)) registos.delete(ip);
    }
}

function limitarTentativasAdmin(req, res, next) {
    const agora = Date.now();
    const ip = ipDe(req);
    const registo = registos.get(ip) || { falhas: [], bloqueadoAte: 0 };

    if (registo.bloqueadoAte > agora) {
        res.set("Retry-After", String(Math.ceil((registo.bloqueadoAte - agora) / 1000)));
        return res.status(429).json({ ok: false, code: "RATE_LIMIT", error: "Muitas tentativas. Tente mais tarde." });
    }

    res.on("finish", () => {
        if (res.statusCode !== 401 && res.statusCode !== 403) return;

        const t = Date.now();
        registo.falhas = registo.falhas.filter((x) => t - x < JANELA_MS);
        registo.falhas.push(t);

        if (registo.falhas.length >= FALHAS_MAX) {
            registo.bloqueadoAte = t + BLOQUEIO_MS;
            registo.falhas = [];
            console.warn(`[SEGURANÇA] IP ${ip} bloqueado em /admin por ${BLOQUEIO_MS / 60000} min (tentativas falhadas).`);
        }

        registos.set(ip, registo);
        limpar(t);
    });

    next();
}

module.exports = { limitarTentativasAdmin };
