"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const steps = [
  ["Testes automatizados Node.js", ["--test"]],
  ["Sintaxe JavaScript", [path.join(__dirname, "check-source.js")]],
  ["Higiene do pacote de release", [path.join(__dirname, "check-release-hygiene.js")]]
];
let failed = false;
for (const [label, args] of steps) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    failed = true;
    console.error(`[FALHOU] ${label}${result.error ? `: ${result.error.message}` : ""}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}
if (failed) {
  console.error("\nPRÉ-VALIDAÇÃO: existem falhas. Não iniciar operações reais.");
  process.exitCode = 1;
} else {
  console.log("\nPRÉ-VALIDAÇÃO: aprovada. Isto não substitui testes HTTP, Android, WhatsApp, Cloudflare ou rede móvel reais.");
}
