const db = require("./database");

// ============================================================
// AGENDAMENTOS DE MENSAGEM
//
// Guardados na base de dados (não só em memória) — assim, se
// o bot reiniciar antes da hora chegar, o agendamento não se
// perde. Ao ligar de novo, o bot recarrega os pendentes.
// ============================================================

function garantirEstrutura() {
    if (!Array.isArray(db.agendamentos)) {
        db.agendamentos = [];
    }
    return db.agendamentos;
}

function adicionar(chat, texto, criadoPor, disparoEm) {

    const lista = garantirEstrutura();

    const item = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        chat,
        texto,
        criadoPor,
        criadoEm: Date.now(),
        disparoEm,
        disparado: false
    };

    lista.push(item);
    db.save();

    return item;
}

function listarPendentes() {
    return garantirEstrutura().filter(a => !a.disparado);
}

function listarPorChat(chat) {
    return garantirEstrutura().filter(a => a.chat === chat && !a.disparado);
}

function marcarDisparado(id) {

    const lista = garantirEstrutura();
    const item = lista.find(a => a.id === id);

    if (item) {
        item.disparado = true;
        db.save();
    }
}

function remover(id) {

    const lista = garantirEstrutura();
    const index = lista.findIndex(a => a.id === id && !a.disparado);

    if (index < 0) {
        return false;
    }

    lista.splice(index, 1);
    db.save();

    return true;
}

// Limpa agendamentos já disparados há mais de 7 dias, pra não
// crescer a base de dados pra sempre
function limparAntigos() {

    const lista = garantirEstrutura();
    const seteDialsAtras = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const restantes = lista.filter(a =>
        !a.disparado || a.disparoEm > seteDialsAtras
    );

    if (restantes.length !== lista.length) {
        db.agendamentos = restantes;
        db.save();
    }
}

module.exports = {
    adicionar,
    listarPendentes,
    listarPorChat,
    marcarDisparado,
    remover,
    limparAntigos
};
