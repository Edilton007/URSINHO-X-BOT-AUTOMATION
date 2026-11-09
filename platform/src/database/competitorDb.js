const db = require("../database/database");

// ============================================================
// CAMADA GLOBAL — memória do próprio bot
//
// Isto NÃO mistura configurações entre grupos (cada grupo
// continua com a sua lista negra e as suas decisões próprias).
// É só o bot a lembrar-se de padrões que ELE MESMO já viu,
// em qualquer grupo que administra — um sinal a mais, nunca
// uma decisão automática sozinha.
// ============================================================

function garantirEstruturaGlobal() {

    if (!db.concorrenciaGlobal) {
        db.concorrenciaGlobal = { observacoes: {} };
    }

    if (!db.concorrenciaGlobal.observacoes) {
        db.concorrenciaGlobal.observacoes = {};
    }

    return db.concorrenciaGlobal;
}

function registarObservacaoGlobal(jid, groupId, trechoMensagem) {

    const global = garantirEstruturaGlobal();

    if (!global.observacoes[jid]) {
        global.observacoes[jid] = {
            gruposVistos: [],
            mensagensSuspeitas: [],
            primeiraDeteccao: Date.now(),
            ultimaAtualizacao: Date.now()
        };
    }

    const registo = global.observacoes[jid];

    if (!registo.gruposVistos.includes(groupId)) {
        registo.gruposVistos.push(groupId);
    }

    if (trechoMensagem) {
        registo.mensagensSuspeitas.push({
            grupo: groupId,
            texto: String(trechoMensagem).slice(0, 200),
            data: Date.now()
        });

        // Mantém só as últimas 5 mensagens suspeitas por pessoa
        registo.mensagensSuspeitas =
            registo.mensagensSuspeitas.slice(-5);
    }

    registo.ultimaAtualizacao = Date.now();

    db.save();
}

function obterObservacaoGlobal(jid) {
    const global = garantirEstruturaGlobal();
    return global.observacoes[jid] || null;
}

// ============================================================
// CAMADA POR GRUPO — configuração, lista negra, revisão
// ============================================================

function garantirEstruturaGrupo(groupId) {

    const group = db.group(groupId);

    if (!group.antiConcorrencia) {
        group.antiConcorrencia = {
            ativo: false,
            grupoConcorrenteConhecido: false,
            blocklist: {},
            whitelist: {},
            pendentes: {},
            historico: []
        };
    }

    // Compatibilidade — garante todos os campos mesmo em
    // grupos criados antes de algum campo novo existir
    const ac = group.antiConcorrencia;

    if (typeof ac.ativo !== "boolean") ac.ativo = false;
    if (typeof ac.grupoConcorrenteConhecido !== "boolean") ac.grupoConcorrenteConhecido = false;
    if (!ac.blocklist) ac.blocklist = {};
    if (!ac.whitelist) ac.whitelist = {};
    if (!ac.pendentes) ac.pendentes = {};
    if (!Array.isArray(ac.historico)) ac.historico = [];

    return ac;
}

function isAtivo(groupId) {
    return garantirEstruturaGrupo(groupId).ativo === true;
}

function setAtivo(groupId, valor) {
    garantirEstruturaGrupo(groupId).ativo = !!valor;
    db.save();
}

function marcarGrupoComoConcorrente(groupId, valor) {
    garantirEstruturaGrupo(groupId).grupoConcorrenteConhecido = !!valor;
    db.save();
}

function isGrupoConcorrenteConhecido(groupId) {
    return garantirEstruturaGrupo(groupId).grupoConcorrenteConhecido === true;
}

// ---- Lista negra ----

function adicionarBlocklist(groupId, jid, motivo, adicionadoPor) {
    const ac = garantirEstruturaGrupo(groupId);
    ac.blocklist[jid] = {
        motivo: motivo || "Sem motivo especificado",
        adicionadoPor,
        data: Date.now()
    };
    delete ac.whitelist[jid];
    db.save();
}

function removerBlocklist(groupId, jid) {
    const ac = garantirEstruturaGrupo(groupId);
    const existia = !!ac.blocklist[jid];
    delete ac.blocklist[jid];
    db.save();
    return existia;
}

function isBlocklisted(groupId, jid) {
    return !!garantirEstruturaGrupo(groupId).blocklist[jid];
}

function listarBlocklist(groupId) {
    const ac = garantirEstruturaGrupo(groupId);
    return Object.entries(ac.blocklist).map(([jid, dados]) => ({
        jid,
        ...dados
    }));
}

// ---- Whitelist (falsos positivos confirmados) ----

function adicionarWhitelist(groupId, jid) {
    const ac = garantirEstruturaGrupo(groupId);
    ac.whitelist[jid] = { data: Date.now() };
    delete ac.pendentes[jid];
    db.save();
}

function isWhitelisted(groupId, jid) {
    return !!garantirEstruturaGrupo(groupId).whitelist[jid];
}

// ---- Pendentes (suspeitos aguardando revisão) ----

function definirPendente(groupId, jid, dados) {
    const ac = garantirEstruturaGrupo(groupId);
    ac.pendentes[jid] = {
        ...(ac.pendentes[jid] || {}),
        ...dados,
        ultimaAtualizacao: Date.now()
    };
    db.save();
    return ac.pendentes[jid];
}

function obterPendente(groupId, jid) {
    return garantirEstruturaGrupo(groupId).pendentes[jid] || null;
}

function removerPendente(groupId, jid) {
    const ac = garantirEstruturaGrupo(groupId);
    delete ac.pendentes[jid];
    db.save();
}

function listarPendentes(groupId) {
    const ac = garantirEstruturaGrupo(groupId);
    return Object.entries(ac.pendentes).map(([jid, dados]) => ({
        jid,
        ...dados
    }));
}

// ---- Histórico de decisões ----

function registarHistorico(groupId, entrada) {
    const ac = garantirEstruturaGrupo(groupId);

    ac.historico.push({
        ...entrada,
        data: Date.now()
    });

    // Mantém só os últimos 200 registos por grupo
    ac.historico = ac.historico.slice(-200);

    db.save();
}

function listarHistorico(groupId, limite = 20) {
    const ac = garantirEstruturaGrupo(groupId);
    return ac.historico.slice(-limite).reverse();
}

module.exports = {
    // global
    registarObservacaoGlobal,
    obterObservacaoGlobal,
    // config
    isAtivo,
    setAtivo,
    marcarGrupoComoConcorrente,
    isGrupoConcorrenteConhecido,
    // blocklist
    adicionarBlocklist,
    removerBlocklist,
    isBlocklisted,
    listarBlocklist,
    // whitelist
    adicionarWhitelist,
    isWhitelisted,
    // pendentes
    definirPendente,
    obterPendente,
    removerPendente,
    listarPendentes,
    // histórico
    registarHistorico,
    listarHistorico
};
