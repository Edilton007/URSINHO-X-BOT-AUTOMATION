const { createSocket } = require("./createSocket");

const sessions = new Map();

async function startSession(
    sessionName = "principal",
    onSocketReady = null,
    onQRCode = null,
    options = {}
) {

    if (sessions.has(sessionName)) {
        return sessions.get(sessionName);
    }

    const sock = await createSocket(
        sessionName,
        async (newSock) => {

            sessions.set(
                sessionName,
                newSock
            );

            if (typeof onSocketReady === "function") {
                await onSocketReady(newSock);
            }
        },
        null,
        onQRCode,
        options
    );

    sessions.set(
        sessionName,
        sock
    );

    return sock;
}

function getSession(sessionName = "principal") {
    return sessions.get(sessionName);
}

function deleteSession(sessionName) {
    sessions.delete(sessionName);
}

module.exports = {
    startSession,
    getSession,
    deleteSession
};
