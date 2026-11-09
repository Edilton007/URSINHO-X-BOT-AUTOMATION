const fs = require("fs");
const path = require("path");

const DB_FILE = process.env.BOT_DB_FILE
  ? path.resolve(process.env.BOT_DB_FILE)
  : path.join(__dirname, "db.json");

const defaultDB = {

  stats: {
    messages: 0,
    commands: 0
  },

  owner: {
    claimed: false,
    name: "",
    lid: "",
    jid: "",
    sub: [],
    claimedAt: null
  },

  groups: {},

  // Memória do Chat IA para conversas privadas (1-a-1), que
  // antes não existia (aiUser era sempre null fora de grupos).
  privateUsers: {},

  rental: {
    codes: {},
    failures: {},
    blockedGroups: {},
    unlock: {}
  },

  botSessions: {
    active: {},
    history: {}
  },

  pending: {},

  autocmds: {},

  knowledge: {},

  ratings: []

};


function load() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    const fresh = JSON.parse(JSON.stringify(defaultDB));
    persist(fresh);
    return fresh;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("a raiz da base não é um objeto");
    }
    for (const field of ["groups", "privateUsers", "rental", "botSessions", "pending", "autocmds", "knowledge"]) {
      if (data[field] !== undefined && (!data[field] || typeof data[field] !== "object" || Array.isArray(data[field]))) {
        throw new Error(`coleção ${field} inválida`);
      }
    }
    if (data.ratings !== undefined && !Array.isArray(data.ratings)) {
      throw new Error("coleção ratings inválida");
    }
  } catch (err) {
    const backup = `${DB_FILE}.corrompido-${Date.now()}`;
    try { fs.copyFileSync(DB_FILE, backup); } catch {}
    throw new Error(
      `A base principal do Bot está ilegível (${err?.message || err}). ` +
      `Foi tentada uma cópia de preservação em ${backup}. O Bot foi bloqueado para não ` +
      `sobrescrever os dados com uma base vazia.`
    );
  }

  return {
    ...JSON.parse(JSON.stringify(defaultDB)),
    ...data,
    owner: { ...defaultDB.owner, ...(data.owner || {}) },
    stats: { ...defaultDB.stats, ...(data.stats || {}) },
    rental: { ...defaultDB.rental, ...(data.rental || {}) },
    botSessions: { ...defaultDB.botSessions, ...(data.botSessions || {}) }
  };
}

function persist(data) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, JSON.stringify(data, null, 2), "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, DB_FILE);
}

const db = load();


function save() {
  // Escrita atómica + fsync para reduzir risco de perda em encerramento abrupto.
  persist(db);
}


db.save = save;



db.group = (jid) => {

  if (typeof jid !== "string" || !jid.endsWith("@g.us")) {
    throw new Error(`db.group() recebeu JID que não é grupo: ${jid}`);
  }


  if (!db.groups[jid]) {

    db.groups[jid] = {

      welcome: false,

      muted: [],

      warns: {},

      anti: {},

      rentalActive: false,

      rentalExpiresAt: null,
      font: "serif",
      x9: {
        active: false
      },
      users: {}

    };

  }


  if (typeof db.groups[jid].font !== "string") {
    db.groups[jid].font = "serif";
  }

  return db.groups[jid];

};




db.groupUser = (groupId, jid) => {
  if (!groupId || !jid) {
    return null;
  }

  const group = db.group(groupId);

  if (!group.users || typeof group.users !== "object") {
    group.users = {};
  }

  if (!group.users[jid]) {
    group.users[jid] = {
      name: "",
      lid: "",
      msgs: 0,
      cmdsUsed: 0,
      warns: 0,
      balance: 0,
      // Contador REAL (nunca encolhe) de trocas com o Chat IA,
      // separado do aiHistory (que é só uma janela curta de
      // contexto). Usado para responder com exatidão a
      // perguntas como "quantas mensagens já trocámos".
      totalMensagensIA: 0,
      // Resumo condensado do que já foi conversado antes da
      // janela curta do aiHistory — para não "esquecer" tudo
      // de repente em conversas longas.
      resumoAnterior: null
    };
  }

  if (typeof group.users[jid].totalMensagensIA !== "number") {
    group.users[jid].totalMensagensIA = 0;
  }

  if (!("resumoAnterior" in group.users[jid])) {
    group.users[jid].resumoAnterior = null;
  }

  return group.users[jid];
};

// ============================================================
// USUÁRIO EM CONVERSA PRIVADA (1-a-1 com o bot)
//
// Antes disto, conversas privadas não tinham NENHUMA memória
// entre mensagens — aiUser era sempre null fora de grupos.
// Esta função dá à conversa privada a mesma memória real que
// já existia em grupo (aiHistory + contador total real).
// ============================================================

db.privateUser = (jid) => {
  if (!jid) {
    return null;
  }

  if (!db.privateUsers[jid]) {
    db.privateUsers[jid] = {
      name: "",
      msgs: 0,
      cmdsUsed: 0,
      aiHistory: [],
      totalMensagensIA: 0,
      resumoAnterior: null
    };
  }

  if (typeof db.privateUsers[jid].totalMensagensIA !== "number") {
    db.privateUsers[jid].totalMensagensIA = 0;
  }

  if (!("resumoAnterior" in db.privateUsers[jid])) {
    db.privateUsers[jid].resumoAnterior = null;
  }

  if (!Array.isArray(db.privateUsers[jid].aiHistory)) {
    db.privateUsers[jid].aiHistory = [];
  }

  return db.privateUsers[jid];
};

module.exports = db;
