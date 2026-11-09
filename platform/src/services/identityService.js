// ============================================================
// IDENTIDADE DO DONO — verificação determinística
//
// A IA (Gemini/Groq/Claude) não é confiável para responder
// "quem sou eu" ou "quem é o dono do bot", porque tende a
// concordar com quem pergunta (sycophancy), mesmo quando o
// prompt diz para só tratar como dono quem realmente é.
//
// Por isso, estas perguntas são detetadas ANTES de chegarem à
// IA, e respondidas diretamente com base na verificação real
// de identidade (isOwner), que usa o JID/LID verdadeiro do
// WhatsApp — não pode ser manipulado pela mensagem da pessoa.
// ============================================================

// Cobre "teu", "seu", "dele", "do bot", "deste bot", "desse bot"
// ou nada — as formas possessivas mais comuns em português,
// incluindo as diferenças entre Portugal/Brasil/Moçambique.
const POSSESSIVO = "(teu\\s+|seu\\s+|dele\\s+|d[eo]\\s+bot\\s+|deste\\s+bot\\s+|desse\\s+bot\\s+)?";

const PADROES_IDENTIDADE = [
    /quem\s+sou\s+eu/i,
    /sabes\s+quem\s+eu\s+sou/i,
    /tu\s+sabes\s+quem\s+eu\s+sou/i,
    new RegExp(`quem\\s+é\\s+o\\s+${POSSESSIVO}dono`, "i"),
    new RegExp(`quem\\s+é\\s+${POSSESSIVO}dono`, "i"),
    new RegExp(`quem\\s+é\\s+o\\s+${POSSESSIVO}propriet[aá]rio`, "i"),
    new RegExp(`quem\\s+é\\s+${POSSESSIVO}propriet[aá]rio`, "i"),
    new RegExp(`quem\\s+é\\s+o\\s+${POSSESSIVO}criador`, "i"),
    new RegExp(`quem\\s+é\\s+${POSSESSIVO}criador`, "i"),
    /quem\s+é\s+que\s+manda\s+em\s+ti/i,
    /quem\s+administra\s+(este|esse|o)\s+bot/i,
    /quem\s+te\s+criou/i,
    /quem\s+te\s+fez/i,
    /quem\s+te\s+desenvolveu/i,
    /quem\s+te\s+programou/i,
    /quem\s+criou\s+(este|esse|o)\s+bot/i,
    /quem\s+fez\s+(este|esse|o)\s+bot/i,
    /quem\s+desenvolveu\s+(este|esse|o)\s+bot/i,
    new RegExp(`qual\\s+é\\s+o\\s+nome\\s+d[eo]\\s+${POSSESSIVO}dono`, "i"),
    new RegExp(`qual\\s+é\\s+o\\s+nome\\s+d[eo]\\s+${POSSESSIVO}propriet[aá]rio`, "i"),
    /eu\s+sou\s+(o\s+)?(teu\s+|seu\s+)?dono/i,
    /eu\s+sou\s+(o\s+)?propriet[aá]rio/i,
    /sou\s+(o\s+)?(teu|seu)\s+dono/i,
    /sou\s+(o\s+)?propriet[aá]rio/i
];

// ============================================================
// INFORMAÇÃO PÚBLICA DO CRIADOR
//
// Nome e alcunhas são informação pública — qualquer pessoa
// pode perguntar e o bot responde. O número de telefone NUNCA
// é revelado aqui (prompt/IA); só é confirmado quando o
// próprio dono pergunta, e mesmo assim por verificação real
// (isOwner), nunca porque alguém afirmou ser ele.
// ============================================================

const CRIADOR = {
    nome: "Edilton Ronaldo",
    alcunhas: ["MZ_URSINHO", "SERNIC 2.0"]
};

/**
 * Verifica se o texto é uma pergunta/afirmação sobre a
 * identidade do utilizador ou sobre quem é o dono do bot.
 */
function ehPerguntaDeIdentidade(texto) {

    const t = String(texto || "").trim();

    if (!t) {
        return false;
    }

    return PADROES_IDENTIDADE.some(padrao => padrao.test(t));
}

// Número do dono — NUNCA fica num prompt de IA, só aqui no
// código. Só sai na resposta quando isOwner(sender) confirma
// que é mesmo ele a perguntar.
const config = require("../config/bot");
const NUMERO_DONO = config.OWNER_NUMBER;

/**
 * Devolve a resposta correta e determinística, baseada na
 * identidade REAL do remetente (isOwner), nunca no que a
 * mensagem diz ou sugere.
 */
function responderIdentidade(ehDonoReal, pushName) {

    const infoPublica =
        `O meu criador é *${CRIADOR.nome}*, também conhecido como *${CRIADOR.alcunhas.join("* ou *")}*.`;

    if (ehDonoReal) {
        return `👑 Sim, tu és o *proprietário/dono* deste bot, ${pushName || ""}! Tenho confiança total em ti e podes usar todos os comandos administrativos.\n\n${infoPublica}\nNúmero registado como dono: wa.me/${NUMERO_DONO}`.replace("  ", " ");
    }

    return `🙂 Eu tenho um único dono/proprietário, e não és tu. ${infoPublica}\n\nFica à vontade — posso ajudar-te à mesma com o que precisares!`;
}

module.exports = {
    ehPerguntaDeIdentidade,
    responderIdentidade
};
