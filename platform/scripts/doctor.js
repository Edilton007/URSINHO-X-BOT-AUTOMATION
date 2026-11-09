"use strict";
require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const backup = require("../src/services/offsiteBackupService");

let failed = false;
let pending = 0;
function check(label, ok, detail = "", optional = false) {
    console.log(`${ok ? "[✓]" : optional ? "[i]" : "[!]"} ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok && optional) pending += 1;
    else if (!ok) failed = true;
}
function safePath(value, fallback) {
    return path.resolve(process.cwd(), value || fallback);
}

console.log("URSINHO X BOT AUTOMATION • DIAGNÓSTICO LOCAL\n");
check("Node.js >= 20", Number(process.versions.node.split(".")[0]) >= 20, process.version);
check("OWNER configurado", /^\d{9,15}$/.test(String(process.env.OWNER || "").replace(/\D/g, "")));
check("API_KEY distinta de ADMIN_API_KEY", !!process.env.API_KEY && !!process.env.ADMIN_API_KEY && process.env.API_KEY !== process.env.ADMIN_API_KEY);
check("AUTOMATION_ALLOW_EXECUTION desativado", String(process.env.AUTOMATION_ALLOW_EXECUTION || "false").toLowerCase() !== "true");
check("PORT/API_PORT válido", Number(process.env.PORT || process.env.API_PORT || 3000) > 0);

for (const [name, fallback] of [
    ["BOT_DB_FILE", "./src/database/db.json"],
    ["AUTOMATION_DB_FILE", "./src/automation/database/automation.json"],
    ["AUTOMATION_ORDERS_FILE", "./src/database/automationOrders.json"],
    ["SALES_DB_FILE", "./src/database/sales.json"]
]) {
    const target = safePath(process.env[name], fallback);
    const dir = path.dirname(target);
    try {
        fs.mkdirSync(dir, { recursive: true });
        fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
        check(`${name} em pasta acessível`, true, path.relative(process.cwd(), target) || target);
    } catch (error) {
        check(`${name} em pasta acessível`, false, error.message);
    }
}

const sessionDir = safePath(process.env.OFFSITE_BACKUP_SESSION_DIR, "./sessions/principal");
check("Pasta de sessão Baileys", fs.existsSync(sessionDir), path.relative(process.cwd(), sessionDir), true);
const cfAny = !!(process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_KV_NAMESPACE_ID || process.env.CLOUDFLARE_API_TOKEN);
const cfReady = !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_KV_NAMESPACE_ID && process.env.CLOUDFLARE_API_TOKEN);
check("Credenciais Cloudflare configuradas", cfReady, cfReady ? "valores presentes; não exibidos" : cfAny ? "configuração parcial; backup desativado até completar" : "backup externo opcional ainda não configurado", true);
let keyReady = false;
try { keyReady = backup.parseEncryptionKey().length === 32; } catch {}
check("Chave AES-256-GCM", keyReady, keyReady ? "32 bytes Base64; valor ocultado" : "backup cifrado opcional ainda não configurado ou chave inválida", true);
check("OWNER_NUMBER para alertas", /^\d{9,15}$/.test(String(process.env.OWNER_NUMBER || process.env.OWNER || "").replace(/\D/g, "")), "se vazio, usa OWNER", true);

if (failed) {
    console.log(`\nDIAGNÓSTICO: existem requisitos locais por corrigir (${pending} itens opcionais também pendentes). Não ative operações reais.`);
    process.exitCode = 1;
} else if (pending) {
    console.log(`\nDIAGNÓSTICO: requisitos locais essenciais aprovados; ${pending} item(ns) opcional(is) ainda não configurado(s). Isso não confirma conectividade externa, WhatsApp, Cloudflare ou USSD real.`);
} else {
    console.log("\nDIAGNÓSTICO: verificações locais aprovadas. Isso não confirma conectividade externa, WhatsApp, Cloudflare ou USSD real.");
}
