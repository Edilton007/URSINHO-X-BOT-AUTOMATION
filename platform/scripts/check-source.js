"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const ignored = new Set(["node_modules", ".git", "sessions", "downloads", "tmp", "logs", "data"]);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) walk(path.join(dir, entry.name));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(path.join(dir, entry.name));
    }
  }
}
walk(path.join(root, "src"));
walk(path.join(root, "scripts"));
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed++;
    process.stderr.write(`\n[ERRO] ${path.relative(root, file)}\n${result.stderr || result.stdout}`);
  }
}
console.log(`Verificação de sintaxe: ${files.length - failed}/${files.length} ficheiros JavaScript aprovados.`);
process.exitCode = failed ? 1 : 0;
