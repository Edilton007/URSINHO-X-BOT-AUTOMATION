// ============================================================
// CONTAGEM DE MENSAGENS — resposta determinística
//
// A IA não tem um contador real — só vê uma janela curta de
// contexto (últimas 6-8 mensagens) e, se perguntada "quantas
// mensagens já trocámos", tende a confundir o tamanho dessa
// janela com o total real, respondendo um número inventado
// com total confiança.
//
// Por isso, este tipo de pergunta é respondido diretamente
// pelo código, usando o contador REAL (totalMensagensIA, que
// nunca encolhe) guardado na base de dados — nunca pela IA.
// ============================================================

const PADROES_CONTAGEM = [
    /quantas\s+mensagens\s+(já\s+)?(trocámos|trocamos|enviei|mandei)/i,
    /qu[aá]ntas\s+vezes\s+(já\s+)?(falei|conversei)\s+contigo/i,
    /n[úu]mero\s+(total\s+)?de\s+mensagens/i,
    /total\s+de\s+mensagens\s+(trocadas|que\s+trocámos|que\s+trocamos)/i
];

function ehPerguntaDeContagem(texto) {

    const t = String(texto || "").trim();

    if (!t) {
        return false;
    }

    return PADROES_CONTAGEM.some(padrao => padrao.test(t));
}

/**
 * Devolve a resposta com o número REAL, guardado em base de
 * dados — nunca estimado ou inventado pela IA.
 */
function responderContagem(totalReal) {

    const total = Number(totalReal) || 0;

    if (total <= 1) {
        return `Esta é a nossa primeira troca de mensagens com o Chat IA — ainda não tenho histórico contigo além desta conversa.`;
    }

    return `Já trocámos *${total}* mensagens comigo através do Chat IA (contando com esta). Isto é uma contagem real, guardada no sistema — não é uma estimativa.`;
}

module.exports = {
    ehPerguntaDeContagem,
    responderContagem
};
