async function react(sock, m, emoji) {
    try {
        await sock.sendMessage(
            m.key.remoteJid,
            {
                react: {
                    text: emoji,
                    key: m.key
                }
            }
        );
    } catch (e) {
        console.log("Erro reação:", e.message);
    }
}

module.exports = {
    react
};
