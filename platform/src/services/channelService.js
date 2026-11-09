/* ============================================================
   CANAL DO WHATSAPP

   Liga o bot ao canal sem incomodar ninguém:
   - linha discreta no rodapé do .menu, licença, aluguer, boas-vindas
   - responde com o link só quando alguém PERGUNTA pelo canal
     (sem comando, sem prefixo)

   O link vem de CHANNEL_URL (.env). Se estiver vazio, tudo isto
   fica desligado e nada aparece.
============================================================ */

const config = require("../config/bot");

function urlCanal() {
    return String(config.CHANNEL_URL || "").trim();
}

function temCanal() {
    return /^https?:\/\//i.test(urlCanal());
}

/** Uma linha só, para pôr no fim de mensagens. Vazia se não houver canal. */
function linhaCanal() {
    return temCanal()
        ? `📢 Siga o nosso canal: ${urlCanal()}`
        : "";
}

/** Junta a linha do canal ao fim de um texto (se houver canal). */
function comLinhaCanal(texto) {
    const linha = linhaCanal();
    return linha ? `${texto}\n\n${linha}` : texto;
}

function normalizar(texto) {
    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Só dispara com perguntas CLARAS sobre o canal. Conversa normal
 * que apenas contém a palavra "canal" não dispara nada.
 *
 *   "canal"                        -> sim
 *   "link do canal" / "qual o canal" -> sim
 *   "onde vejo as novidades?"      -> sim
 *   "o canal de tv está mau"       -> não
 */
function ehPerguntaDeCanal(texto) {

    const t = normalizar(texto);

    if (!t || t.length > 60) return false;

    const palavras = t.split(" ").length;
    if (palavras > 8) return false;

    if (/^(o |a )?canal( do bot| do whatsapp| de novidades| oficial)?$/.test(t)) {
        return true;
    }

    if (/^(qual|cade|onde|manda|envia|passa|mande|me da|me passa|quero|tem)( \w+){0,3} (o )?(link do |o )?canal( do bot| do whatsapp| oficial)?$/.test(t)) {
        return true;
    }

    if (/^(link|ligacao|endereco) (do|de) canal( do bot| oficial)?$/.test(t)) {
        return true;
    }

    if (/^(onde|como) (eu )?(vejo|ver|sigo|seguir|fico sabendo|acompanho|acompanhar) (as |os )?(novidades|promocoes|tabelas|avisos|atualizacoes)( do bot)?$/.test(t)) {
        return true;
    }

    return false;
}

function mensagemCanal() {
    return (
`📢 *CANAL OFICIAL*

Novidades, promoções, tabelas e avisos do bot ficam aqui:

${urlCanal()}

Toque no link e carregue em *Seguir*.`
    );
}

// Anti-spam: no máximo 1 resposta por grupo a cada 3 minutos
const ultimaPorChat = new Map();

function podeResponderCanal(chat, esperaMs = 3 * 60 * 1000) {

    const agora = Date.now();

    if (agora - (ultimaPorChat.get(chat) || 0) < esperaMs) {
        return false;
    }

    ultimaPorChat.set(chat, agora);

    if (ultimaPorChat.size > 300) {
        for (const [chave, tempo] of ultimaPorChat) {
            if (agora - tempo > esperaMs) ultimaPorChat.delete(chave);
        }
    }

    return true;
}

module.exports = {
    urlCanal,
    temCanal,
    linhaCanal,
    comLinhaCanal,
    ehPerguntaDeCanal,
    mensagemCanal,
    podeResponderCanal
};
