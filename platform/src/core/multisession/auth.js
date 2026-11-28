"use strict";
const fs = require("fs");
const path = require("path");
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");

function resolveSessionPath(sessionName = "principal") {
    const name = String(sessionName || "").trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(name) || name === "." || name === "..") {
        throw new Error("Nome de sessão inválido.");
    }
    const root = path.resolve(process.env.BAILEYS_SESSION_DIR || path.join(process.cwd(), "sessions"));
    return path.join(root, name);
}

async function getAuth(sessionName = "principal") {
    const sessionPath = resolveSessionPath(sessionName);
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    return { state, saveCreds, sessionPath };
}

module.exports = { getAuth, resolveSessionPath };
