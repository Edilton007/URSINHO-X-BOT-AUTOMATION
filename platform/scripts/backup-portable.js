"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const cwd = process.cwd();
const root = path.resolve(process.env.BACKUP_ROOT || path.resolve(cwd, "..", "..", "ursinho-backups"));
const rel = path.relative(cwd, root);
if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
  throw new Error("BACKUP_ROOT tem de ficar fora da pasta da aplicação.");
}
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const targetRoot = path.join(root, `ursinho-${stamp}`);
fs.mkdirSync(targetRoot, { recursive: true });

function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function filesIn(target) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) return [];
  if (stat.isFile()) return [{ path: path.basename(target), size: stat.size, sha256: hash(target) }];
  if (!stat.isDirectory()) return [];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name);
    if (entry.isSymbolicLink()) return [];
    return filesIn(child).map((item) => ({ ...item, path: path.join(entry.name, item.path) }));
  });
}
const inputs = [
  { name: "config/.env", source: ".env" },
  { name: "data/bot-db.json", source: process.env.BOT_DB_FILE || "./src/database/db.json" },
  { name: "data/automation.json", source: process.env.AUTOMATION_DB_FILE || "./src/automation/database/automation.json" },
  { name: "data/sales.json", source: process.env.SALES_DB_FILE || "./src/database/sales.json" },
  { name: "sessions", source: process.env.BAILEYS_SESSION_DIR || "./sessions" }
];
const manifest = { createdAt: new Date().toISOString(), files: [], warnings: [] };
for (const item of inputs) {
  const source = path.resolve(cwd, item.source);
  const target = path.join(targetRoot, item.name);
  if (!fs.existsSync(source)) {
    manifest.files.push({ name: item.name, status: "absent" });
    manifest.warnings.push(`Origem ausente: ${item.name}`);
    continue;
  }
  if (fs.lstatSync(source).isSymbolicLink()) throw new Error(`Origem não pode ser link simbólico: ${item.name}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, dereference: false, force: true });
  const entries = filesIn(target);
  manifest.files.push({ name: item.name, status: "copied", entries: entries.length,
    bytes: entries.reduce((sum, entry) => sum + entry.size, 0), sha256: entries });
}
fs.writeFileSync(path.join(targetRoot, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
fs.writeFileSync(path.join(targetRoot, "RESTORE-LEIA-PRIMEIRO.txt"),
  "Backup URSINHO X BOT AUTOMATION.\n\nEste backup pode conter .env e sessão WhatsApp. Mantenha-o privado e cifrado.\n" +
  "A restauração é manual: pare o serviço, valide os hashes do manifest.json, reponha os ficheiros e execute npm run preflight antes de iniciar.\n" +
  "Não copie bases enquanto o processo está activo. Não active execução telecom durante a recuperação.\n", { mode: 0o600 });
console.log(`Backup concluído: ${targetRoot}`);
console.log(`Itens copiados: ${manifest.files.filter((entry) => entry.status === "copied").length}/${manifest.files.length}`);
if (manifest.warnings.length) console.log(`Avisos: ${manifest.warnings.length} origem(ns) não existentes.`);
