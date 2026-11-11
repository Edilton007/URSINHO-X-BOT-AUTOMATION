const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

// ============================================================
// BASE DE DADOS (ficheiro JSON)
//
// Proteções (Fase 2):
//  - Gravação atómica: escreve num temporário e renomeia, por isso
//    uma queda a meio nunca deixa o ficheiro a meio.
//  - Cópias de segurança automáticas (no máximo 1 por hora, guarda as
//    últimas 24) ao lado do ficheiro: automation.json.bak-AAAAMMDD-HHMM
//  - Se o ficheiro ficar ilegível: guarda uma cópia .corrompido-*,
//    tenta restaurar a última cópia válida e, se não houver nenhuma,
//    PARA com erro em vez de arrancar vazio (arrancar vazio e gravar
//    por cima apagaria tenants, licenças e devices).
//
// AUTOMATION_DB_FILE no .env: caminho do ficheiro (útil para pôr os
// dados num volume persistente da hospedagem).
// ============================================================

const DB_FILE = process.env.AUTOMATION_DB_FILE
    ? path.resolve(process.env.AUTOMATION_DB_FILE)
    : path.join(__dirname, "automation.json");

const DB_DIR = path.dirname(DB_FILE);
const DB_NOME = path.basename(DB_FILE);

// Cópias comprimidas (.gz). Padrão: uma a cada 6 h e uma em cada arranque,
// guarda as 8 últimas. Ajuste no .env: AUTOMATION_BACKUP_KEEP e
// AUTOMATION_BACKUP_INTERVAL_MIN. (Cópias horárias de uma base grande
// encheriam o disco de 1 GB.)
const MAX_BACKUPS = Number(process.env.AUTOMATION_BACKUP_KEEP) > 0 ? Number(process.env.AUTOMATION_BACKUP_KEEP) : 8;
const INTERVALO_BACKUP_MS = (Number(process.env.AUTOMATION_BACKUP_INTERVAL_MIN) > 0 ? Number(process.env.AUTOMATION_BACKUP_INTERVAL_MIN) : 360) * 60 * 1000;

const RESET_MARKER = "historicoOperacoesReset_2026_09_24";

const defaultDB = {
  tenants: {},
  licenseCodes: {},
  devices: {},
  sims: {},
  simCounters: {},
  pendingTasks: {},
  operations: {},
  pedidos: {},
  storefronts: {},
  storeProducts: {},
  storeOrders: {},
  customers: {},
  customerTenantRelations: {},
  whatsappTenantGroups: {},
  auditoria: [],
  system: {}
};

let ultimoBackupMs = 0;

function cloneDefault() {
  return JSON.parse(JSON.stringify(defaultDB));
}

function carimbo(data = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${data.getFullYear()}${p(data.getMonth() + 1)}${p(data.getDate())}-${p(data.getHours())}${p(data.getMinutes())}`;
}

function listarBackups() {
  try {
    return fs.readdirSync(DB_DIR)
      .filter((nome) => nome.startsWith(`${DB_NOME}.bak-`))
      .sort()
      .reverse()
      .map((nome) => path.join(DB_DIR, nome));
  } catch {
    return [];
  }
}

function fazerBackupSeNecessario() {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    if (ultimoBackupMs !== 0 && Date.now() - ultimoBackupMs < INTERVALO_BACKUP_MS) return;

    fs.writeFileSync(`${DB_FILE}.bak-${carimbo()}.gz`, zlib.gzipSync(fs.readFileSync(DB_FILE)));
    ultimoBackupMs = Date.now();

    for (const antigo of listarBackups().slice(MAX_BACKUPS)) {
      try { fs.unlinkSync(antigo); } catch {}
    }
  } catch (err) {
    console.error("Aviso: não foi possível criar a cópia de segurança:", err?.message || err);
  }
}

function persist(data) {
  fs.mkdirSync(DB_DIR, { recursive: true });

  fazerBackupSeNecessario();

  const tmp = `${DB_FILE}.tmp`;
  const fd = fs.openSync(tmp, "w");

  try {
    fs.writeSync(fd, JSON.stringify(data, null, 2), null, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  fs.renameSync(tmp, DB_FILE);
}

const COLECOES_OBJETO = ["tenants", "licenseCodes", "devices", "sims", "simCounters", "pendingTasks", "operations", "pedidos", "storefronts", "storeProducts", "storeOrders", "customers", "customerTenantRelations", "whatsappTenantGroups", "system"];

function lerJsonValido(caminho) {
  let bruto = fs.readFileSync(caminho);

  if (caminho.endsWith(".gz")) bruto = zlib.gunzipSync(bruto);

  const data = JSON.parse(bruto.toString("utf8"));

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("conteúdo não é um objeto");
  }

  // Coleções com tipo errado contam como corrupção (nunca viram base vazia).
  for (const nome of COLECOES_OBJETO) {
    const v = data[nome];
    if (v !== undefined && (v === null || typeof v !== "object" || Array.isArray(v))) {
      throw new Error(`coleção "${nome}" inválida`);
    }
  }

  if (data.auditoria !== undefined && !Array.isArray(data.auditoria)) {
    throw new Error('coleção "auditoria" inválida');
  }

  return data;
}

function completarComPadroes(data) {
  const base = cloneDefault();

  const merged = {
    ...base,
    ...data,
    system: {
      ...base.system,
      ...(data.system || {})
    }
  };

  if (!merged.pedidos || typeof merged.pedidos !== "object") merged.pedidos = {};
  if (!Array.isArray(merged.auditoria)) merged.auditoria = [];

  return merged;
}

function carregarDeBackups() {
  for (const backup of listarBackups()) {
    try {
      const data = lerJsonValido(backup);
      console.warn(`⚠️ Dados restaurados da cópia de segurança: ${path.basename(backup)}`);
      return data;
    } catch {}
  }
  return null;
}

function load() {
  if (!fs.existsSync(DB_FILE)) {
    // Ficheiro em falta mas há cópias: restaura em vez de começar vazio.
    const backupsExistentes = listarBackups();
    const restaurado = carregarDeBackups();

    if (restaurado) {
      const merged = completarComPadroes(restaurado);
      persist(merged);
      return merged;
    }

    if (backupsExistentes.length > 0) {
      throw new Error(`${DB_NOME} está ausente e existem cópias de segurança, mas nenhuma é válida. O Backend não arranca para preservar a integridade dos dados.`);
    }

    const fresh = cloneDefault();
    fresh.system[RESET_MARKER] = true;
    persist(fresh);
    return fresh;
  }

  let data;

  try {
    data = lerJsonValido(DB_FILE);
  } catch (err) {
    const copia = `${DB_FILE}.corrompido-${Date.now()}`;

    try { fs.copyFileSync(DB_FILE, copia); } catch {}

    console.error(`❌ ${DB_NOME} ilegível (${err?.message}). Cópia guardada em ${path.basename(copia)}.`);

    const restaurado = carregarDeBackups();

    if (!restaurado) {
      throw new Error(
        `${DB_NOME} está ilegível e não há cópia de segurança válida. ` +
        `O Backend não arranca para não apagar os seus dados. ` +
        `Confira o ficheiro ${path.basename(copia)} ou apague ${DB_NOME} para começar vazio.`
      );
    }

    data = restaurado;
  }

  const merged = completarComPadroes(data);

  /*
   * Marcador de migração antigo.
   *
   * Antes: se o marcador não existisse, apagava operations, pendingTasks
   * e pedidos (e isso acontecia no primeiro reinício depois de um banco
   * novo, porque o banco novo nascia sem o marcador).
   *
   * Agora: só regista o marcador. Nenhum dado de operação é apagado por
   * esta rotina, em nenhuma circunstância.
   */
  if (!merged.system[RESET_MARKER]) {
    merged.system[RESET_MARKER] = true;
    merged.system.marcadorMigracaoRegistadoEmMs = Date.now();
  }

  persist(merged);

  return merged;
}

const db = load();

function save() {
  persist(db);
}

db.save = save;

db.system = db.system || {};

/** Regista uma ação administrativa/humana (máx. 5000 entradas). */
db.auditar = function auditar(entrada) {
  db.auditoria.push({ emMs: Date.now(), ...entrada });

  if (db.auditoria.length > 5000) {
    db.auditoria.splice(0, db.auditoria.length - 5000);
  }
};

module.exports = db;
