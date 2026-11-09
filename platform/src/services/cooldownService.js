// ============================================================
// COOLDOWN POR COMANDO (anti-spam das cotas)
//
// Cada pessoa tem um tempo de espera por comando. Um comando
// pode declarar o seu próprio `cooldown: 10` (segundos); os
// pesados têm um valor por defeito aqui. O dono nunca espera.
// Estado só em memória.
// ============================================================

// segundos — comandos que gastam cotas (Gemini, Groq, Yoinku...)
const COOLDOWN_PADRAO = {
    ytmp3: 15,
    ytmp4: 20,
    ytdoc: 20,
    play: 15,
    facebook: 15,
    falar: 12,
    imagem: 12,
    ler: 10,
    escrever: 8,
    resumir: 8,
    ai: 6,
    gemini: 6,
    traduzir: 5,
    clima: 5,
    sticker: 5
};

const usos = new Map();   // "pessoa|comando" -> { ate, avisado }

function segundosDe(cmd) {

    if (typeof cmd?.cooldown === "number") return cmd.cooldown;

    return COOLDOWN_PADRAO[cmd?.name] || 0;
}

/**
 * Regista o uso e devolve { bloqueado, restante, avisar }.
 * `avisar` é true só na 1ª vez dentro da janela, para o bot
 * não responder a cada repetição (isso também seria spam).
 */
function verificarCooldown(sender, cmd, permission) {

    const segundos = segundosDe(cmd);

    if (!segundos || permission === "owner") {
        return { bloqueado: false };
    }

    const chave = `${sender}|${cmd.name}`;
    const agora = Date.now();
    const atual = usos.get(chave);

    if (atual && atual.ate > agora) {

        const avisar = !atual.avisado;
        atual.avisado = true;

        return {
            bloqueado: true,
            restante: Math.ceil((atual.ate - agora) / 1000),
            avisar
        };
    }

    usos.set(chave, { ate: agora + segundos * 1000, avisado: false });

    return { bloqueado: false };
}

setInterval(() => {

    const agora = Date.now();

    for (const [k, v] of usos) {
        if (v.ate <= agora) usos.delete(k);
    }

}, 60000).unref();

module.exports = { verificarCooldown };
