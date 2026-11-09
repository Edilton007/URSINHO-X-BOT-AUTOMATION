const db = require("../database/database");

/*
============================================================
 SESSION REGISTRY SERVICE
 URSINHO X BOT V2
============================================================

 Responsável por:
 - Registrar novas sessões
 - Atualizar estado da sessão
 - Registrar conexão/desconexão
 - Manter histórico
 - Associar licença quando disponível

 NÃO controla o socket.
 NÃO cria conexão.
 NÃO gera QR.
============================================================
*/

function generateSessionId(sessionName = "principal") {
    const timestamp = Date.now().toString(36).toUpperCase();

    return `UXS-${String(sessionName)
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .toUpperCase()}-${timestamp}`;
}

function ensureDatabase() {
    if (!db.botSessions) {
        db.botSessions = {
            active: {},
            history: {}
        };
    }

    if (!db.botSessions.active) {
        db.botSessions.active = {};
    }

    if (!db.botSessions.history) {
        db.botSessions.history = {};
    }
}

function registerSession(data = {}) {
    ensureDatabase();

    const now = Date.now();

    const sessionId =
        data.sessionId ||
        generateSessionId(data.sessionName);

    const session = {
        sessionId,

        sessionName:
            data.sessionName || "principal",

          sessionType:
              data.sessionType ||
              (
                  data.sessionName === "principal"
                      ? "principal"
                      : "rental"
              ),

        status:
            data.status || "connecting",

        phone:
            data.phone || null,

        jid:
            data.jid || null,

        lid:
            data.lid || null,

        groupJid:
            data.groupJid || null,

        licenseCode:
            data.licenseCode || null,

        startedAt:
            data.startedAt || now,

        connectedAt:
            data.connectedAt || null,

        disconnectedAt:
            data.disconnectedAt || null,

        expiresAt:
            data.expiresAt || null,

        warning3dSent: false,

        warning24hSent: false,

        createdAt: now,

        updatedAt: now
    };

    db.botSessions.active[sessionId] = session;

    db.save();

    return session;
}

function updateSession(sessionId, updates = {}) {
    ensureDatabase();

    const session =
        db.botSessions.active[sessionId];

    if (!session) {
        return null;
    }

    Object.assign(
        session,
        updates,
        {
            updatedAt: Date.now()
        }
    );

    db.save();

    return session;
}

function markConnected(sessionId, data = {}) {
    return updateSession(
        sessionId,
        {
            ...data,
            status: "connected",
            connectedAt:
                data.connectedAt || Date.now()
        }
    );
}

function markDisconnected(sessionId, reason = null) {
    ensureDatabase();

    const session =
        db.botSessions.active[sessionId];

    if (!session) {
        return null;
    }

    session.status = "disconnected";

    session.disconnectedAt = Date.now();

    session.disconnectReason =
        reason || null;

    session.updatedAt = Date.now();

    db.botSessions.history[sessionId] = {
        ...session
    };

    delete db.botSessions.active[sessionId];

    db.save();

    return session;
}

function getSession(sessionId) {
    ensureDatabase();

    return (
        db.botSessions.active[sessionId] ||
        db.botSessions.history[sessionId] ||
        null
    );
}

function getActiveSessions() {
    ensureDatabase();

    return Object.values(
        db.botSessions.active
    );
}

function getHistory() {
    ensureDatabase();

    return Object.values(
        db.botSessions.history
    );
}

function removeSession(sessionId) {
    ensureDatabase();

    delete db.botSessions.active[sessionId];

    db.save();

    return true;
}

module.exports = {
    generateSessionId,
    registerSession,
    updateSession,
    markConnected,
    markDisconnected,
    getSession,
    getActiveSessions,
    getHistory,
    removeSession
};
