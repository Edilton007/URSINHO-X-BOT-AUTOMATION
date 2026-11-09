const { getGroup, updateGroup } = require("../../services/groupService");

function registerGroupUpdate(sock) {
    sock.ev.on("groups.update", async (updates) => {
        for (const update of updates || []) {
            try {
                const chat = update?.id;

                if (!chat || !chat.endsWith("@g.us")) {
                    continue;
                }

                const group = getGroup(chat);

                // Guarda o último subject/desc conhecidos dentro do próprio x9,
                // pra distinguir mudança real de replay do Baileys (ex: após reconexão 408).
                const x9Meta = group?.x9 || {};

                if (!group?.x9?.active) {
                    // Mesmo com X9 desligado, mantém o cache atualizado silenciosamente,
                    // pra não gerar falso positivo se o X9 for ligado depois.
                    const metaUpdate = {};
                    if (update.subject && update.subject !== x9Meta.lastSubject) {
                        metaUpdate.lastSubject = update.subject;
                    }
                    if (typeof update.desc === "string" && update.desc !== x9Meta.lastDesc) {
                        metaUpdate.lastDesc = update.desc;
                    }
                    if (Object.keys(metaUpdate).length > 0) {
                        updateGroup(chat, { x9: { ...x9Meta, ...metaUpdate } });
                    }
                    continue;
                }

                const metaUpdate = {};
                let subjectMudou = false;
                let descMudou = false;

                if (update.subject && update.subject !== x9Meta.lastSubject) {
                    subjectMudou = true;
                    metaUpdate.lastSubject = update.subject;
                }

                if (typeof update.desc === "string" && update.desc !== x9Meta.lastDesc) {
                    descMudou = true;
                    metaUpdate.lastDesc = update.desc;
                }

                if (subjectMudou) {
                    await sock.sendMessage(chat, {
                        text:
`╭━━━〔 🕵️ X9 〕━━━╮
┃
┃ 📝 NOME DO GRUPO ALTERADO
┃
┃ Novo nome:
┃ ${update.subject}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
🐻 URSINHO X BOT V2`
                    });
                }

                if (descMudou) {
                    await sock.sendMessage(chat, {
                        text:
`╭━━━〔 🕵️ X9 〕━━━╮
┃
┃ 📄 DESCRIÇÃO ALTERADA
┃
┃ Nova descrição:
┃ ${update.desc || "(vazia)"}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
🐻 URSINHO X BOT V2`
                    });
                }

                if (Object.keys(metaUpdate).length > 0) {
                    updateGroup(chat, { x9: { ...x9Meta, ...metaUpdate } });
                }

            } catch (error) {
                console.error(
                    "[X9] Erro em groups.update:",
                    error?.message || error
                );
            }
        }
    });
}

module.exports = {
    registerGroupUpdate
};
