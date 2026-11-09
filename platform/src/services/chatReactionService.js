// ============================================================
// REAÇÕES DO CHAT IA
//
// Além de responder em texto, o bot reage com emoji (❤️😂👍
// etc.) à mensagem da pessoa quando faz sentido — como um
// humano reage no WhatsApp. Não reage a tudo (seria cansativo),
// só quando a mensagem tem um sinal claro de emoção/intenção.
// ============================================================

const REGRAS = [
    // [padrão, emoji]
    [/\b(kk+|haha+|hihi+|lol|rs+)\b/i, "😂"],
    [/\b(obrigad[oa]|valeu|thanks|grata)\b/i, "🙏"],
    [/\b(parabéns|parabens|feliz anivers[aá]rio)\b/i, "🎉"],
    [/\b(bom dia)\b/i, "☀️"],
    [/\b(boa noite)\b/i, "🌙"],
    [/\b(boa tarde)\b/i, "🌤️"],
    [/\b(te amo|amo-te|apaixonad[oa])\b/i, "❤️"],
    [/\b(triste|chateado|chateada|deprimid[oa])\b/i, "😔"],
    [/\b(fantástico|fantastico|incrível|incrivel|excelente|brutal)\b/i, "🔥"],
    [/\b(mt bom|muito bom|adorei|gostei muito)\b/i, "😍"],
    [/\?{2,}|confus[oa]/i, "🤔"],
    [/\b(parabéns pelo bot|bot bom|bot inteligente)\b/i, "🥹"]
];

/**
 * Devolve o emoji mais apropriado para reagir a esta mensagem,
 * ou null se nenhuma regra fizer sentido (não reage a tudo).
 */
function escolherReacao(texto) {

    const t = String(texto || "");

    if (!t.trim()) {
        return null;
    }

    for (const [padrao, emoji] of REGRAS) {
        if (padrao.test(t)) {
            return emoji;
        }
    }

    return null;
}

module.exports = {
    escolherReacao
};
