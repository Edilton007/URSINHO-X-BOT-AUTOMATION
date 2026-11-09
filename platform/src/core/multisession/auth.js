const fs = require("fs");
const path = require("path");
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");

async function getAuth(sessionName = "principal") {

    const sessionPath = path.join(
        process.cwd(),
        "sessions",
        sessionName
    );

    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, {
            recursive: true
        });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    return {
        state,
        saveCreds,
        sessionPath
    };
}

module.exports = {
    getAuth
};
