"use strict";
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const forbiddenDirs = new Set([
  ".git", "node_modules", ".gradle", "build", "sessions", "restore-staging",
  "downloads", "tmp", "logs"
]);
const forbiddenFiles = [];
const sensitiveDbNames = new Set([
  "db.json", "sales.json", "automation.json", "automationOrders.json", "usedReceipts.json"
]);
const sensitiveExtensions = new Set([".jks", ".keystore", ".p12", ".pfx", ".pem"]);

function walk(dir, relative = "") {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (error) { forbiddenFiles.push(`${relative || "."}: não foi possível ler (${error.message})`); return; }
  for (const entry of entries) {
    const rel = path.posix.join(relative, entry.name);
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (relative === "" && entry.name === ".git") continue;
      if (forbiddenDirs.has(entry.name)) {
        forbiddenFiles.push(`${rel}/ (diretório de execução/dependências)`);
        continue;
      }
      walk(abs, rel);
      continue;
    }
    if (!entry.isFile()) continue;
    const name = entry.name;
    if ((name === ".env" || name.startsWith(".env.")) && name !== ".env.example") {
      forbiddenFiles.push(`${rel} (ficheiro de ambiente privado)`);
      continue;
    }
    if (sensitiveDbNames.has(name)) forbiddenFiles.push(`${rel} (base operacional; não empacotar)`);
    if (sensitiveExtensions.has(path.extname(name).toLowerCase()) || name === "id_rsa") {
      forbiddenFiles.push(`${rel} (possível chave/certificado privado)`);
    }
    if ([".apk", ".aab"].includes(path.extname(name).toLowerCase())) {
      forbiddenFiles.push(`${rel} (binário Android de build; distribuir separadamente)`);
    }
  }
}

walk(ROOT);
if (forbiddenFiles.length) {
  console.error("HIGIENE DE RELEASE: FALHOU. Remova os seguintes itens antes de empacotar:");
  for (const item of forbiddenFiles) console.error(` - ${item}`);
  process.exitCode = 1;
} else {
  console.log("HIGIENE DE RELEASE: aprovada. Não foram encontrados .env, sessões, bases operacionais, dependências ou chaves privadas no pacote.");
}
