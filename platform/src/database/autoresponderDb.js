const db = require("./database");

// ============================================================
// AUTO-RESPONDER
//
// Cada grupo tem a própria lista de termos/respostas, isolada
// dos outros. Suporta múltiplos "gatilhos" pra mesma resposta
// (ex: "preço|preços|tabela" -> mesma resposta).
// ============================================================

function normalizar(texto) {
    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove acentos
        .trim();
}

function garantirEstrutura(groupId) {

    const group = db.group(groupId);

    if (!group.autoResponder) {
        group.autoResponder = {
            ativo: false,
            itens: []
        };
    }

    if (typeof group.autoResponder.ativo !== "boolean") {
        group.autoResponder.ativo = false;
    }

    if (!Array.isArray(group.autoResponder.itens)) {
        group.autoResponder.itens = [];
    }

    return group.autoResponder;
}

function isAtivo(groupId) {
    return garantirEstrutura(groupId).ativo === true;
}

function setAtivo(groupId, valor) {
    garantirEstrutura(groupId).ativo = !!valor;
    db.save();
}

/**
 * Adiciona um novo item. `termos` pode ser um array de
 * palavras-gatilho (ex: ["preço", "preços", "tabela"]).
 * Retorna { sucesso, motivo } — falha se algum termo já
 * estiver a ser usado por outro item.
 */
function adicionar(groupId, termos, resposta, criadoPor) {

    const ac = garantirEstrutura(groupId);

    const termosNormalizados =
        termos
            .map(normalizar)
            .filter(Boolean);

    if (!termosNormalizados.length) {
        return { sucesso: false, motivo: "Nenhum termo válido fornecido." };
    }

    const jaExiste = ac.itens.some(item =>
        item.termos.some(t => termosNormalizados.includes(t))
    );

    if (jaExiste) {
        return { sucesso: false, motivo: "Um ou mais desses termos já estão em uso." };
    }

    const novoItem = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        termos: termosNormalizados,
        termosOriginais: termos,
        resposta,
        criadoPor,
        data: Date.now()
    };

    ac.itens.push(novoItem);
    db.save();

    return { sucesso: true, item: novoItem };
}

/**
 * Remove por termo (qualquer um dos gatilhos) ou por número
 * de posição na lista (1-based, como aparece no .listaauto).
 */
function remover(groupId, termoOuPosicao) {

    const ac = garantirEstrutura(groupId);

    const comoNumero = parseInt(termoOuPosicao, 10);

    let index = -1;

    if (
        !isNaN(comoNumero) &&
        String(comoNumero) === String(termoOuPosicao).trim()
    ) {
        index = comoNumero - 1;
    } else {
        const termoNorm = normalizar(termoOuPosicao);
        index = ac.itens.findIndex(item =>
            item.termos.includes(termoNorm)
        );
    }

    if (index < 0 || index >= ac.itens.length) {
        return { sucesso: false };
    }

    const removido = ac.itens.splice(index, 1)[0];
    db.save();

    return { sucesso: true, item: removido };
}

function listar(groupId) {
    return garantirEstrutura(groupId).itens;
}

/**
 * Procura se o texto recebido contém algum gatilho conhecido.
 * Retorna a resposta correspondente, ou null.
 * Prioridade: primeiro item cadastrado que bater.
 */
function encontrarResposta(groupId, textoRecebido) {

    const ac = garantirEstrutura(groupId);

    if (!ac.ativo || !ac.itens.length) {
        return null;
    }

    const textoNorm = normalizar(textoRecebido);

    if (!textoNorm) return null;

    for (const item of ac.itens) {
        for (const termo of item.termos) {
            if (textoNorm.includes(termo)) {
                return item.resposta;
            }
        }
    }

    return null;
}

module.exports = {
    isAtivo,
    setAtivo,
    adicionar,
    remover,
    listar,
    encontrarResposta
};
