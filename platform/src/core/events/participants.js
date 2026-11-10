const { getGroup } = require("../../services/groupService");
const customerIdentityService = require("../../automation/services/customerIdentityService");
const { linhaCanal } = require("../../services/channelService");

const {
    verificarNovoMembro
} = require("../../services/competitorDetection");

function replaceVariables(text, data) {
    return String(text)
        .replace(/@user/g, `@${String(data.user).split("@")[0]}`)
        .replace(/\{grupo\}/g, data.group)
        .replace(/\{membros\}/g, String(data.members))
        .replace(/\{data\}/g, data.date)
        .replace(/\{hora\}/g, data.time);
}

async function getProfilePicture(sock, jid) {
    try {
        return await sock.profilePictureUrl(jid, "image");
    } catch {
        return null;
    }
}

async function resolveParticipantUser(sock, participant) {
    if (!participant) return null;

    if (typeof participant === "string") {
        return participant;
    }

    if (participant?.phoneNumber) {
        return participant.phoneNumber;
    }

    const id = participant?.id || participant?.jid;

    if (!id) return null;

    if (id.endsWith("@s.whatsapp.net")) {
        return id;
    }

    if (id.endsWith("@lid")) {
        try {
            const pn =
                await sock?.signalRepository?.lidMapping?.getPNForLID(id);

            if (pn) return pn;
        } catch (error) {
            console.error(
                "[PARTICIPANTS] Erro LID -> PN:",
                error?.message || error
            );
        }
    }

    return id;
}

function formatDateTime() {
    const now = new Date();

    return {
        date: now.toLocaleDateString("pt-PT"),
        time: now.toLocaleTimeString("pt-PT")
    };
}

async function sendX9(sock, chat, text, mentions = [], imageJid = null) {
    try {
        let photo = null;

        if (imageJid) {
            photo = await getProfilePicture(sock, imageJid);
        }

        if (photo) {
            await sock.sendMessage(chat, {
                image: { url: photo },
                caption: text,
                mentions
            });
        } else {
            await sock.sendMessage(chat, {
                text,
                mentions
            });
        }
    } catch (error) {
        console.error(
            "[X9] Erro ao enviar monitoramento:",
            error?.message || error
        );
    }
}

function registerParticipants(sock) {
    sock.ev.on(
        "group-participants.update",
        async (update) => {
            try {
                const chat = update?.id;

                if (!chat || !chat.endsWith("@g.us")) {
                    return;
                }

                const group = getGroup(chat);
                const action = String(update.action || "").toLowerCase();

                // Sincroniza a relação cliente-Tenant também para grupos que
                // não estão registados no módulo legado do Bot V2.
                if (["add", "remove", "leave"].includes(action)) {
                    for (const participant of update.participants || []) {
                        try {
                            const user = await resolveParticipantUser(sock, participant);
                            if (!user) continue;
                            customerIdentityService.atualizarMembroGrupo(
                                chat,
                                user,
                                participant?.notify || "",
                                action === "add"
                            );
                        } catch (identityError) {
                            console.error(
                                "[TENANT IDENTITY] Erro ao sincronizar membro:",
                                identityError?.message || identityError
                            );
                        }
                    }
                }

                // O módulo legado só processa os seus próprios grupos.
                // A sincronização de identidade acima também atende grupos
                // associados exclusivamente a um Tenant Automation.
                if (!group) return;

                /*
                 * ============================================================
                 * ANTI-CONCORRÊNCIA
                 * ============================================================
                 *
                 * Roda antes de tudo (X9, boas-vindas), pra saber se a
                 * pessoa foi removida e não mandar boas-vindas pra quem
                 * já não está mais no grupo.
                 *
                 * Marca quem foi removido, pra pular o resto do fluxo
                 * de entrada só pra essas pessoas.
                 */

                const removidosPorConcorrencia = new Set();

                if (action === "add") {

                    for (const participant of update.participants || []) {

                        try {

                            const user =
                                await resolveParticipantUser(
                                    sock,
                                    participant
                                );

                            if (!user) continue;

                            const { removido } =
                                await verificarNovoMembro(
                                    sock,
                                    chat,
                                    user,
                                    null // pushName não vem neste evento
                                );

                            if (removido) {
                                removidosPorConcorrencia.add(user);
                            }

                        } catch (error) {
                            console.error(
                                "[ANTI-CONCORRÊNCIA] Erro ao verificar novo membro:",
                                error?.message || error
                            );
                        }
                    }
                }

                /*
                 * ============================================================
                 * X9
                 * ============================================================
                 *
                 * O X9 observa o mesmo evento que o sistema de entrada/saída.
                 * Não criamos outro listener.
                 */

                if (group.x9?.active === true) {
                    let metadata = null;

                    try {
                        metadata = await sock.groupMetadata(chat);
                    } catch (error) {
                        console.error(
                            "[X9] Erro ao obter metadata:",
                            error?.message || error
                        );
                    }

                    const { date, time } = formatDateTime();
                    const groupName =
                        metadata?.subject || "Grupo";

                    /*
                     * ========================================================
                     * ENTRADA
                     * ========================================================
                     */

                    if (action === "add") {
                        for (const participant of update.participants || []) {
                            const user =
                                await resolveParticipantUser(
                                    sock,
                                    participant
                                );

                            if (!user) continue;

                            await sendX9(
                                sock,
                                chat,
`╭━━━〔 🕵️ X9 • MONITORAMENTO 〕━━━╮
┃
┃ 👋 NOVO MEMBRO DETECTADO
┃
┃ 👤 Membro:
┃ @${String(user).split("@")[0]}
┃
┃ 🏷️ Grupo:
┃ ${groupName}
┃
┃ 👥 Membros agora:
┃ ${metadata?.participants?.length || "—"}
┃
┃ 📅 Data: ${date}
┃ ⏰ Hora: ${time}
┃
┃ 🎉 Bem-vindo à comunidade!
┃ O X9 já registou a entrada. 👀
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🐻 URSINHO X BOT V2`,
                                [user],
                                user
                            );
                        }
                    }

                    /*
                     * ========================================================
                     * SAÍDA / EXPULSÃO
                     * ========================================================
                     */

                    if (
                        action === "remove" ||
                        action === "leave"
                    ) {
                        for (const participant of update.participants || []) {
                            const user =
                                await resolveParticipantUser(
                                    sock,
                                    participant
                                );

                            if (!user) continue;

                            const isKick = action === "remove";

                            await sendX9(
                                sock,
                                chat,
`╭━━━〔 🕵️ X9 • MONITORAMENTO 〕━━━╮
┃
┃ ${isKick ? "🚪 MEMBRO REMOVIDO" : "👋 MEMBRO SAIU"}
┃
┃ 👤 Pessoa:
┃ @${String(user).split("@")[0]}
┃
┃ 🏷️ Grupo:
┃ ${groupName}
┃
┃ 👥 Membros agora:
┃ ${metadata?.participants?.length || "—"}
┃
┃ 📅 Data: ${date}
┃ ⏰ Hora: ${time}
┃
┃ ${isKick
    ? "⚠️ A pessoa foi removida do grupo."
    : "A saída foi registada pelo X9."}
┃
┃ 👀 O X9 viu. O X9 registou.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🐻 URSINHO X BOT V2`,
                                [user],
                                user
                            );
                        }
                    }

                    /*
                     * ========================================================
                     * PROMOÇÃO
                     * ========================================================
                     */

                    if (action === "promote") {
                        for (const participant of update.participants || []) {
                            const user =
                                await resolveParticipantUser(
                                    sock,
                                    participant
                                );

                            if (!user) continue;

                            const actor =
                                await resolveParticipantUser(
                                    sock,
                                    update.author
                                );

                            const mentions = [user];

                            let actorLine =
                                "👤 Responsável: não informado pelo evento";

                            if (actor) {
                                mentions.push(actor);

                                actorLine =
`👮 Responsável:
┃ @${String(actor).split("@")[0]}`;
                            }

                            await sendX9(
                                sock,
                                chat,
`╭━━━〔 🕵️ X9 • MONITORAMENTO 〕━━━╮
┃
┃ 🟢 MEMBRO PROMOVIDO
┃
┃ 👤 Promovido:
┃ @${String(user).split("@")[0]}
┃
┃ ${actorLine}
┃
┃ 🏷️ Grupo:
┃ ${groupName}
┃
┃ 📅 Data: ${date}
┃ ⏰ Hora: ${time}
┃
┃ 🎖️ Agora faz parte da administração.
┃
┃ ⚠️ Use os poderes com sabedoria...
┃ O X9 está de olho. 👀
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🐻 URSINHO X BOT V2`,
                                mentions,
                                user
                            );
                        }
                    }

                    /*
                     * ========================================================
                     * REBAIXAMENTO
                     * ========================================================
                     */

                    if (action === "demote") {
                        for (const participant of update.participants || []) {
                            const user =
                                await resolveParticipantUser(
                                    sock,
                                    participant
                                );

                            if (!user) continue;

                            const actor =
                                await resolveParticipantUser(
                                    sock,
                                    update.author
                                );

                            const mentions = [user];

                            let actorLine =
                                "👤 Responsável: não informado pelo evento";

                            if (actor) {
                                mentions.push(actor);

                                actorLine =
`👮 Responsável:
┃ @${String(actor).split("@")[0]}`;
                            }

                            await sendX9(
                                sock,
                                chat,
`╭━━━〔 🕵️ X9 • MONITORAMENTO 〕━━━╮
┃
┃ 🔴 MEMBRO REBAIXADO
┃
┃ 👤 Pessoa:
┃ @${String(user).split("@")[0]}
┃
┃ ${actorLine}
┃
┃ 🏷️ Grupo:
┃ ${groupName}
┃
┃ 📅 Data: ${date}
┃ ⏰ Hora: ${time}
┃
┃ 📉 O cargo administrativo foi removido.
┃
┃ 😶 Fim da era... pelo menos por enquanto.
┃
┃ 👀 O X9 registou tudo.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🐻 URSINHO X BOT V2`,
                                mentions,
                                user
                            );
                        }
                    }
                }

                /*
                 * ============================================================
                 * SISTEMA DE BOAS-VINDAS EXISTENTE
                 * ============================================================
                 */

                const isAdd =
                    action === "add" &&
                    group.bemvindo?.enabled;

                const isRemove =
                    (action === "remove" || action === "leave") &&
                    group.saida?.enabled;

                if (!isAdd && !isRemove) {
                    return;
                }

                let metadata;

                try {
                    metadata = await sock.groupMetadata(chat);
                } catch (error) {
                    console.error(
                        "[PARTICIPANTS] Erro ao obter metadata:",
                        error?.message || error
                    );

                    return;
                }

                const now = new Date();

                /*
                 * ============================================================
                 * ENTRADA — SISTEMA EXISTENTE
                 * ============================================================
                 */

                if (isAdd) {
                    for (const participant of update.participants || []) {
                        const user =
                            await resolveParticipantUser(
                                sock,
                                participant
                            );

                        if (!user) continue;

                        // Não manda boas-vindas pra quem já foi
                        // removido pelo anti-concorrência
                        if (removidosPorConcorrencia.has(user)) continue;

                        // Só na mensagem padrão; textos personalizados
                        // do admin ficam exatamente como ele escreveu.
                        const linhaCanalBoasVindas =
                            linhaCanal() ? `\n\n${linhaCanal()}` : "";

                        const message =
                            group.bemvindo.message ||
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ ✨ SISTEMA DE BOAS-VINDAS V2 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

👤 Novo membro entrou!

Olá, @user 👋

🎉 Seja muito bem-vindo(a) ao grupo:

🏷️ {grupo}

Aqui construímos uma comunidade baseada em:

◆ Respeito
◆ União
◆ Participação
◆ Boa convivência

╭━━━〔 📊 INFORMAÇÕES 〕━━━╮
┃ 👥 Membros atuais:
┃ {membros}
┃
┃ 📅 Data de entrada:
┃ {data}
┃
┃ ⏰ Hora de entrada:
┃ {hora}
╰━━━━━━━━━━━━━━━━━━━━━━╯

🛡️ Primeiros passos:

✓ Leia as regras do grupo
✓ Respeite todos os membros
✓ Evite spam

🚀 A tua presença torna a comunidade mais forte.

🤖 Sistema automático:
🐻 URSINHO X BOT V2${linhaCanalBoasVindas}`;

                        const text = replaceVariables(
                            message,
                            {
                                user,
                                group: metadata.subject,
                                members:
                                    metadata.participants.length,
                                date:
                                    now.toLocaleDateString("pt-PT"),
                                time:
                                    now.toLocaleTimeString("pt-PT")
                            }
                        );

                        let photo = null;

                        try {
                            photo =
                                await getProfilePicture(
                                    sock,
                                    user
                                );
                        } catch {
                            photo = null;
                        }

                        try {
                            await sock.sendMessage(
                                chat,
                                photo
                                    ? {
                                        image: { url: photo },
                                        caption: text,
                                        mentions: [user]
                                    }
                                    : {
                                        text,
                                        mentions: [user]
                                    }
                            );
                        } catch (error) {
                            console.error(
                                "[PARTICIPANTS] Erro ao enviar entrada:",
                                error?.message || error
                            );
                        }
                    }
                }

                /*
                 * ============================================================
                 * SAÍDA — SISTEMA EXISTENTE
                 * ============================================================
                 */

                if (isRemove) {
                    for (const participant of update.participants || []) {
                        const user =
                            await resolveParticipantUser(
                                sock,
                                participant
                            );

                        if (!user) continue;

                        const message =
                            group.saida.message ||
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 👋 SISTEMA DE SAÍDA V2 🐻
╰━━━━━━━━━━━━━━━━━━━━━━╯

👤 Um membro deixou a comunidade.

Até breve, @user 👋

A tua saída foi registada com sucesso.

Agradecemos por teres feito parte desta comunidade.
Esperamos que tenhas tido uma boa experiência e que um dia possas regressar.

╭━━━〔 📊 INFORMAÇÕES 〕━━━╮
┃ 🏷️ Grupo:
┃ {grupo}
┃
┃ 👥 Membros atuais:
┃ {membros}
┃
┃ 📅 Data da saída:
┃ {data}
┃
┃ ⏰ Hora da saída:
┃ {hora}
╰━━━━━━━━━━━━━━━━━━━━━━╯

💙 Desejamos muito sucesso na tua caminhada.

🚪 As portas desta comunidade estarão sempre abertas para o teu regresso.

🤖 Sistema automático por:
🐻 URSINHO X BOT V2
⚡ Tecnologia • Segurança • Gestão`;

                        const text = replaceVariables(
                            message,
                            {
                                user,
                                group: metadata.subject,
                                members: Math.max(
                                    0,
                                    metadata.participants.length - 1
                                ),
                                date:
                                    now.toLocaleDateString("pt-PT"),
                                time:
                                    now.toLocaleTimeString("pt-PT")
                            }
                        );

                        let photo = null;

                        try {
                            photo =
                                await getProfilePicture(
                                    sock,
                                    user
                                );
                        } catch {
                            photo = null;
                        }

                        try {
                            await sock.sendMessage(
                                chat,
                                photo
                                    ? {
                                        image: { url: photo },
                                        caption: text,
                                        mentions: [user]
                                    }
                                    : {
                                        text,
                                        mentions: [user]
                                    }
                            );
                        } catch (error) {
                            console.error(
                                "[PARTICIPANTS] Erro ao enviar saída:",
                                error?.message || error
                            );
                        }
                    }
                }

            } catch (error) {
                console.error(
                    "ERRO PARTICIPANTS EVENT:",
                    error?.message || error
                );
            }
        }
    );
}

module.exports = {
    registerParticipants
};
