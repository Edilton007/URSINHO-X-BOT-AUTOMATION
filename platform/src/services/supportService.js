// ============================================================
// SUPORTE COM IA
//
// A pessoa escreve "suporte" (com ou sem pergunta, com ou sem
// prefixo). O bot lê a conversa recente do grupo, a mensagem
// citada (se a pessoa respondeu a alguma) e a lista REAL de
// comandos, e ajuda a resolver — dizendo o comando certo, com
// exemplo, em vez de respostas genéricas.
// ============================================================

const config = require("../config/bot");
const { conversa, nomeDe } = require("./groupBufferService");

const ESPERA_MS = 20000;
const MAX_TEXTO_PEDIDO = 400;

// "suporte", "ajuda", "ajuda ia", "ajuda-ia" — sem prefixo
const GATILHO = /^(suporte|ajuda)(?![a-zà-ÿ])/i;

const ultimoUso = new Map();

let comandosRef = null;

function definirComandos(mapaComandos) {
    comandosRef = mapaComandos;
}

/**
 * "suporte", "ajuda", "Suporte, não consigo baixar música"
 * Só conta se a mensagem COMEÇA por "suporte" e for curta, para
 * não disparar em conversa normal ("o suporte da Vodacom é péssimo...").
 */
function ehPedidoDeSuporte(texto) {

    const t = String(texto || "").trim();

    if (!t || t.length > MAX_TEXTO_PEDIDO) return false;

    return GATILHO.test(t);
}

function extrairPedido(texto) {
    return String(texto || "")
        .trim()
        .replace(/^(suporte|ajuda)(?![a-zà-ÿ])[\s,:;.\-–—!?]*/i, "")
        .replace(/^ia(?![a-zà-ÿ])[\s,:;.\-–—!?]*/i, "")
        .trim();
}

function textoCitado(m) {

    const citada =
        m?.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!citada) return "";

    return String(
        citada.conversation ||
        citada.extendedTextMessage?.text ||
        citada.imageMessage?.caption ||
        citada.videoMessage?.caption ||
        ""
    ).trim().slice(0, 400);
}

function idCitado(m) {
    return m?.message?.extendedTextMessage?.contextInfo?.stanzaId || null;
}

function catalogoDeComandos(permission, prefix) {

    if (!comandosRef) return "";

    const vistos = new Set();
    const linhas = [];

    for (const cmd of comandosRef.values()) {

        if (!cmd?.name || vistos.has(cmd.name)) continue;
        vistos.add(cmd.name);

        // Só mostra à pessoa comandos que ela pode realmente usar
        if (cmd.category === "owner" && permission !== "owner") continue;
        if (cmd.category === "admin" && permission === "user") continue;

        const desc =
            String(cmd.description || "").replace(/\s+/g, " ").slice(0, 70);

        linhas.push(`${prefix}${cmd.name}${desc ? ` — ${desc}` : ""}`);
    }

    return linhas.join("\n");
}

function podeUsarAgora(sender) {

    const agora = Date.now();

    if (agora - (ultimoUso.get(sender) || 0) < ESPERA_MS) return false;

    ultimoUso.set(sender, agora);

    // Limpeza simples para o Map não crescer para sempre
    if (ultimoUso.size > 2000) {
        for (const [k, v] of ultimoUso) {
            if (agora - v > ESPERA_MS) ultimoUso.delete(k);
        }
    }

    return true;
}

/**
 * Devolve o texto da resposta, ou null se estiver em espera
 * (anti-spam: 1 pedido de suporte por pessoa a cada 20 s).
 */
async function responderSuporte({
    askAI,
    texto,
    m,
    chat,
    sender,
    pushName,
    isGroup,
    permission,
    prefix
}) {

    if (!podeUsarAgora(sender)) return null;

    const pedido = extrairPedido(texto);
    const citado = textoCitado(m);
    const idDoCitado = idCitado(m);
    const autorDoCitado = idDoCitado ? nomeDe(chat, idDoCitado) : null;

    // Conversa do grupo (sem os pedidos de suporte em si). Se a pessoa
    // respondeu a uma mensagem, vem desde um pouco antes dela até agora.
    const mensagens =
        isGroup
            ? conversa(chat, idDoCitado).filter(x => !ehPedidoDeSuporte(x.text))
            : [];

    const conversaTexto =
        mensagens.map(x => `${x.name}: ${x.text}`).join("\n");

    const donoWa = `wa.me/${config.OWNER_NUMBER}`;

    const instrucoes = [
        `[MODO SUPORTE] ${pushName || "Um membro"} pediu ajuda ao suporte do bot.`,
        pedido
            ? `Pedido da pessoa: "${pedido}"`
            : "A pessoa só pediu ajuda (\"suporte\"/\"ajuda\"), sem explicar o problema.",
        citado
            ? `A pessoa respondeu a esta mensagem${autorDoCitado ? ` de ${autorDoCitado}` : ""} — é este o assunto a resolver: "${citado}"`
            : "",
        "",
        conversaTexto
            ? `\nConversa do grupo (da mais antiga para a mais recente):\n${conversaTexto}\n`
            : "",
        "Como responder:",
        "- Lê a conversa do grupo desde o início e percebe como se chegou até aqui; depois resolve o problema pelo pedido e pela mensagem citada.",
        "- Se alguém do grupo já resolveu parte do problema, não repitas — continua a partir daí.",
        `- Se houver um comando que resolve, diz o comando EXACTO com o prefixo "${prefix}" e dá um exemplo de uso pronto a copiar.`,
        "- Usa SÓ comandos da lista abaixo. Nunca inventes comandos nem funcionalidades.",
        "- Se faltar informação para ajudar, faz UMA pergunta curta em vez de adivinhar.",
        `- Se for assunto de pagamento, aluguer/licença, venda ou algo que não consegues resolver, manda falar com o proprietário: ${donoWa}`,
        "- Resposta curta para WhatsApp: no máximo 6 linhas, passos numerados se forem vários.",
        "- Não digas que és um modo de suporte nem repitas o pedido; vai direto à solução.",
        "",
        "Comandos disponíveis para esta pessoa:",
        catalogoDeComandos(permission, prefix)
    ].filter(l => l !== "").join("\n");

    const resposta = await askAI(
        instrucoes,
        {
            chat,
            sender,
            isGroup,
            pushName,
            groupContext: mensagens,
            isOwner: permission === "owner"
        }
    );

    return resposta || null;
}

module.exports = {
    definirComandos,
    ehPedidoDeSuporte,
    responderSuporte
};
