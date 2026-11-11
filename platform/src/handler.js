const fs = require("fs");

const { react } = require("./lib/reactions");

const {
    addMessage,
    addCommand
} = require("./services/statsService");

const {
    updateUser,
    addMessage: addUserMessage,
    addCommand: addUserCommand
} = require("./services/userService");

const { getPrefix } =
    require("./services/settingsService");

const {
    sendMenuMedia,
    sendMenuNative
} = require("./services/mediaService");

const { createCommandContext } =
    require("./services/contextService");

const { extractText } =
    require("./services/messageService");

const {
    isAdmin,
    isOwner,
    getGroupMetadataCached
} = require("./services/permissionService");

const {
    checkMessageProtection
} = require("./services/protectionMiddlewareService");

const {
    checkRentalMiddleware
} = require("./services/rentalMiddlewareService");

/* ============================================================
   CHAT IA
============================================================ */

const { askAI } =
    require("./services/aiService");

const {
    ehPerguntaDeIdentidade,
    responderIdentidade
} = require("./services/identityService");

const {
    ehPerguntaDeContagem,
    responderContagem
} = require("./services/messageCountService");

const {
    resumirTrecho
} = require("./services/conversationSummaryService");

const {
    escolherReacao
} = require("./services/chatReactionService");

const {
    extractAIMedia,
    downloadAIMediaBase64
} = require("./services/aiMediaService");

const {
    generateSpeech,
    temTtsConfigurado
} = require("./services/ttsService");

const {
    verificarMensagem: verificarMensagemConcorrencia
} = require("./services/competitorDetection");

const autoResponderDb = require("./database/autoresponderDb");

const db =
    require("./database/database");

/* ============================================================
   VENDAIA
============================================================ */

const {
    processVendaIA
} = require("./services/vendaIAService");

/* ============================================================
   DETECTOR DE COMPROVATIVOS
============================================================ */

const {
    analyzeReceipt,
    formatReceiptResult
} = require("./services/receiptDetectorService");

const {
    savePendingPayment,
    getLatestPendingPayment,
    setPendingRecipientNumber
} = require("./services/salesService");

/* ============================================================
   NÚMERO DO CLIENTE — PAGAMENTO PENDENTE
============================================================ */

function extractClientRecipientNumber(
    text,
    excludedNumber = null
) {
    const value =
        String(text || "");

    /*
     * Aceita:
     *
     * 851234567
     * 258851234567
     * +258 851234567
     * 258-851234567
     * 85 123 4567
     */

    const matches =
        value.match(
            /(?<!\d)(?:\+?258[\s-]*)?8[2-7](?:[\s-]*\d){7}(?!\d)/g
        ) || [];

    const excluded =
        String(excludedNumber || "")
            .replace(/\D/g, "");

    const excludedLocal =
        excluded.startsWith("258") &&
        excluded.length === 12
            ? excluded.slice(3)
            : excluded;

    for (const match of matches) {

        const digits =
            match.replace(/\D/g, "");

        let number =
            digits;

        if (
            number.startsWith("258") &&
            number.length === 12
        ) {
            number =
                number.slice(3);
        }

        if (!/^8[2-7]\d{7}$/.test(number)) {
            continue;
        }

        if (
            excludedLocal &&
            number === excludedLocal
        ) {
            continue;
        }

        return number;
    }

    return null;
}

/* ============================================================
   VERIFICAÇÃO DE MENSAGEM RECENTE
============================================================ */

function isRecentMessage(m, sock) {

    const timestamp =
        m?.messageTimestamp;

    if (!timestamp) {
        return false;
    }

    let messageTime;

    if (
        typeof timestamp === "number"
    ) {

        messageTime =
            timestamp * 1000;

    } else if (
        typeof timestamp === "object" &&
        typeof timestamp.toNumber === "function"
    ) {

        messageTime =
            timestamp.toNumber() * 1000;

    } else {

        return false;
    }

    if (
        !Number.isFinite(messageTime) ||
        messageTime <= 0
    ) {

        return false;
    }

    /*
    ============================================================
    FILTRO DE HISTÓRICO
    ============================================================

    O bot só processa mensagens recebidas depois
    do momento em que a conexão foi estabelecida.
    ============================================================
    */

    const connectionStart =
        sock?.__ursinhoMessageWindowStart;

    if (
        !Number.isFinite(connectionStart)
    ) {

        return false;
    }

    if (
        messageTime >= connectionStart
    ) {

        return true;
    }

    return false;
}

/* ============================================================
   HANDLER PRINCIPAL
============================================================ */

const {
    sugerirComandos,
    montarMensagemSugestao,
    ehPerguntaDePrefixo,
    montarMensagemPrefixo,
    detectarPrefixoErrado,
    montarMensagemPrefixoErrado,
    parecePedidoDeComando
} = require("./services/commandSuggestionService");

const groupBuffer = require("./services/groupBufferService");
const tenantPrivateChatService = require("./automation/services/tenantPrivateChatService");
const alertasDono = require("./services/alertService");
const { temPermissao, mensagemNegado } = require("./services/commandPermissionService");
const { verificarCooldown } = require("./services/cooldownService");
const {
    definirComandos: definirComandosSuporte,
    ehPedidoDeSuporte,
    responderSuporte
} = require("./services/supportService");

const { status: rentalStatus } = require("./services/rentalService");
const {
    mensagemSemLicenca,
    mensagemPrivado
} = require("./services/licenseMessages");
const {
    ehPerguntaDeCanal,
    mensagemCanal,
    temCanal,
    urlCanal: urlCanalBot,
    podeResponderCanal
} = require("./services/channelService");

// Evita responder várias vezes seguidas à mesma pessoa
const ultimaAjudaPorPessoa = new Map();

function podeAjudarAgora(sender, esperaMs = 8000) {

    const agora = Date.now();

    if (agora - (ultimaAjudaPorPessoa.get(sender) || 0) < esperaMs) {
        return false;
    }

    ultimaAjudaPorPessoa.set(sender, agora);

    if (ultimaAjudaPorPessoa.size > 500) {
        for (const [chave, tempo] of ultimaAjudaPorPessoa) {
            if (agora - tempo > 60000) ultimaAjudaPorPessoa.delete(chave);
        }
    }

    return true;
}

/**
 * Detecta pedidos como "responde em áudio", "manda áudio",
 * "fala comigo", "diz isso por voz".
 */
function pediuRespostaEmAudio(texto) {

    const t = String(texto || "").toLowerCase();

    return (
        /\b(em|por|com|numa?|na)\s+(um\s+)?(áudio|audio|voz|nota de voz)\b/.test(t) ||
        /\b(manda|envia|responde|fala|diz|lê|le)\b[^.!?\n]{0,30}\b(áudio|audio|voz)\b/.test(t) ||
        /\bfala\s+(comigo|isso|em voz)\b/.test(t)
    );
}

function buildHandler(commands, config, commandCount) {

    definirComandosSuporte(commands);

    return async function handle(sock, m) {

        if (config.DEBUG) {
        console.log(
            "[HANDLER DEBUG] mensagem recebida:",
            JSON.stringify({
                remoteJid:
                    m?.key?.remoteJid,

                fromMe:
                    m?.key?.fromMe,

                id:
                    m?.key?.id,

                participant:
                    m?.key?.participant,

                participantAlt:
                    m?.key?.participantAlt,

                messageTypes:
                    Object.keys(
                        m?.message || {}
                    )
            })
        );
        }

        try {

            /* ========================================================
               FILTRO INICIAL
            ======================================================== */

            if (
                !m ||
                !m.message ||
                m.key?.fromMe
            ) {

                return;
            }

            /* ========================================================
               DADOS DA MENSAGEM
            ======================================================== */

            const chat =
                m.key?.remoteJid;

            if (!chat) {
                return;
            }

            /* ========================================================
               IDENTIFICAR GRUPO
            ======================================================== */

            const isGroup =
                chat.endsWith("@g.us");

            /* ========================================================
               BLOQUEAR STATUS ORIGINAL
            ========================================================

               status@broadcast é o Status original.

               NÃO deve entrar no pipeline normal.

               O Anti-Status trabalha com o evento
               groupStatusMentionMessage recebido no JID
               real do grupo.
            ======================================================== */

            if (
                chat === "status@broadcast" ||
                chat.endsWith("@broadcast")
            ) {

                if (config.DEBUG) {
                console.log(
                    "[HANDLER] STATUS ORIGINAL IGNORADO:",
                    chat
                );
                }

                return;
            }

            /* ========================================================
               ANTI-STATUS
               MARCAÇÃO REAL DO GRUPO
            ========================================================

               O ponto importante:

               Não dependemos mais somente de:

               protocolMessage.type ===
               "STATUS_MENTION_MESSAGE"

               O evento já é identificado pela existência de:

               m.message.groupStatusMentionMessage

               Isso torna o detector compatível com a estrutura
               realmente entregue pelo Baileys nesta mensagem.
            ======================================================== */

            const groupStatusMention =
                m.message?.groupStatusMentionMessage;

            if (
                isGroup &&
                groupStatusMention
            ) {

                if (config.DEBUG) {
                console.log(
                    "\n================================================"
                );
                }

                if (config.DEBUG) {
                console.log(
                    "[ANTISTATUS] 🚨 GROUP STATUS MENTION DETECTADO"
                );
                }

                if (config.DEBUG) {
                console.log(
                    "[ANTISTATUS] GRUPO:",
                    chat
                );
                }

                if (config.DEBUG) {
                console.log(
                    "[ANTISTATUS] PARTICIPANT:",
                    m.key?.participant
                );
                }

                if (config.DEBUG) {
                console.log(
                    "[ANTISTATUS] PARTICIPANT ALT:",
                    m.key?.participantAlt
                );
                }

                if (config.DEBUG) {
                console.log(
                    "[ANTISTATUS] TIPOS:",
                    Object.keys(
                        m.message || {}
                    )
                );
                }

                if (config.DEBUG) {
                console.log(
                    "[ANTISTATUS] ESTRUTURA:",
                    JSON.stringify(
                        groupStatusMention,
                        null,
                        2
                    )
                );
                }

                if (config.DEBUG) {
                console.log(
                    "================================================\n"
                );
                }

                /* ====================================================
                   CARREGAR GRUPO
                ==================================================== */

                let group;

                try {

                    group =
                        db.group(chat);

                } catch (error) {

                    console.error(
                        "[ANTISTATUS] ❌ Erro ao carregar grupo:",
                        error?.message || error
                    );

                    return;
                }

                /* ====================================================
                   VERIFICAR ANTI-STATUS
                ==================================================== */

                const antiStatusAtivo =
                    group?.anti?.status === true;

                if (config.DEBUG) {
                console.log(
                    "[ANTISTATUS] CONFIGURAÇÃO:",
                    antiStatusAtivo
                        ? "🟢 ATIVO"
                        : "🔴 OFF"
                );
                }

                if (!antiStatusAtivo) {

                    if (config.DEBUG) {
                    console.log(
                        "[ANTISTATUS] ⚠️ Evento detectado, mas Anti-Status está OFF:",
                        chat
                    );
                    }

                    return;
                }

                /* ====================================================
                   IDENTIFICAR QUEM MARCOU
                ==================================================== */

                let statusSender =
                    m.key?.participantAlt ||
                    m.key?.participant;

                if (config.DEBUG) {
                console.log(
                    "[ANTISTATUS] REMETENTE ORIGINAL:",
                    statusSender
                );
                }

                if (!statusSender) {

                    console.error(
                        "[ANTISTATUS] ❌ Não foi possível identificar o remetente."
                    );

                    return;
                }

                /* ====================================================
                   LID → PN
                ==================================================== */

                if (
                    statusSender.endsWith("@lid")
                ) {

                    if (config.DEBUG) {
                    console.log(
                        "[ANTISTATUS] 🔄 REMETENTE EM LID:",
                        statusSender
                    );
                    }

                    try {

                        const pn =
                            await sock
                                ?.signalRepository
                                ?.lidMapping
                                ?.getPNForLID(
                                    statusSender
                                );

                        if (pn) {

                            if (config.DEBUG) {
                            console.log(
                                "[ANTISTATUS] ✅ LID → PN:",
                                pn
                            );
                            }

                            statusSender =
                                pn;

                        } else {

                            console.warn(
                                "[ANTISTATUS] ⚠️ Não foi possível converter LID para PN."
                            );
                        }

                    } catch (error) {

                        console.error(
                            "[ANTISTATUS] ❌ Erro LID → PN:",
                            error?.message || error
                        );
                    }
                }

                /* ====================================================
                   VERIFICAR REMETENTE
                ==================================================== */

                if (!statusSender) {

                    console.error(
                        "[ANTISTATUS] ❌ JID inválido."
                    );

                    return;
                }

                /* ====================================================
                   VALIDAR E REMOVER AUTOR DO STATUS
                   ==================================================== */

                const botJid = sock?.user?.id;

                if (!botJid) {
                    if (config.DEBUG) {
                    console.log(
                        "[ANTISTATUS] ⚠️ JID do bot não disponível. Ignorando."
                    );
                    }
                    return;
                }

                /* ====================================================
                   CONFIRMAR QUE O AUTOR É MEMBRO DO GRUPO
                   ==================================================== */

                let targetJid = null;
                let metadataAntiStatus = null;

                try {
                    metadataAntiStatus =
                        await getGroupMetadataCached(sock, chat);

                    const participantes = metadataAntiStatus?.participants || [];

                    const candidatos = [
                        statusSender,
                        m.key?.participant,
                        m.key?.participantAlt
                    ].filter(Boolean);

                    const participante =
                        participantes.find(p =>
                            candidatos.includes(p?.id)
                        ) ||
                        participantes.find(p =>
                            candidatos.includes(p?.jid)
                        );

                    if (!participante) {
                        if (config.DEBUG) {
                        console.log(
                            "[ANTISTATUS] ⚠️ Autor não está no grupo. Ignorando."
                        );
                        }
                        return;
                    }

                    targetJid =
                        participante.id ||
                        participante.jid;

                    if (config.DEBUG) {
                    console.log(
                        "[ANTISTATUS] ✅ AUTOR CONFIRMADO:",
                        targetJid
                    );
                    }

                } catch (error) {
                    console.error(
                        "[ANTISTATUS] ❌ Erro ao verificar autor:",
                        error?.message || error
                    );
                    return;
                }

                /* ====================================================
                   NÃO REMOVER O PRÓPRIO BOT
                   ==================================================== */

                const botBase =
                    String(botJid)
                        .split(":")[0]
                        .split("@")[0];

                const targetBase =
                    String(targetJid)
                        .split(":")[0]
                        .split("@")[0];

                if (targetBase === botBase) {
                    if (config.DEBUG) {
                    console.log(
                        "[ANTISTATUS] 🤖 É o próprio bot. Ignorando."
                    );
                    }
                    return;
                }

                /* ====================================================
                   CONFIRMAR QUE O BOT É ADMIN
                   ==================================================== */

                try {
                    const botParticipant =
                        (metadataAntiStatus?.participants || []).find(p => {
                            const id =
                                String(
                                    p?.id ||
                                    p?.jid ||
                                    ""
                                );

                            return (
                                id === botJid ||
                                id.split(":")[0].split("@")[0] === botBase
                            );
                        });

                    const botIsAdmin =
                        botParticipant?.admin === "admin" ||
                        botParticipant?.admin === "superadmin";

                    if (!botIsAdmin) {
                        if (config.DEBUG) {
                        console.log(
                            "[ANTISTATUS] ⚠️ BOT NÃO É ADMIN. Remoção cancelada."
                        );
                        }
                        return;
                    }

                } catch (error) {
                    console.error(
                        "[ANTISTATUS] ❌ Erro ao verificar administrador:",
                        error?.message || error
                    );
                    return;
                }

                /* ====================================================
                   REMOVER SOMENTE O AUTOR QUE MARCOU O GRUPO
                   ==================================================== */

                if (config.DEBUG) {
                console.log(
                    "[ANTISTATUS] 🚫 TENTANDO REMOVER SOMENTE:",
                    targetJid
                );
                }

                try {
                    await sock.groupParticipantsUpdate(
                        chat,
                        [targetJid],
                        "remove"
                    );

                    if (config.DEBUG) {
                    console.log(
                        "[ANTISTATUS] ✅ USUÁRIO REMOVIDO:",
                        targetJid
                    );
                    }

                    try {
                        await sock.sendMessage(
                            chat,
                            {
                                text:
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 📢 ANTI-STATUS 🛡️
╰━━━━━━━━━━━━━━━━━━━━━━╯

🚫 USUÁRIO REMOVIDO

Motivo:
Mencionou este grupo em um Status.

👤 Usuário:
${targetJid}

🐻 URSINHO X BOT V2
━━━━━━━━━━━━━━━━━━━━━━`
                            }
                        );
                    } catch (error) {
                        console.error(
                            "[ANTISTATUS] ⚠️ Removido, mas aviso falhou:",
                            error?.message || error
                        );
                    }

                } catch (error) {
                    console.error(
                        "[ANTISTATUS] ❌ FALHA AO REMOVER:",
                        error?.message || error
                    );

                    try {
                        await sock.sendMessage(
                            chat,
                            {
                                text:
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃ 📢 ANTI-STATUS 🛡️
╰━━━━━━━━━━━━━━━━━━━━━━╯

⚠️ MARCAÇÃO DE STATUS DETECTADA

Não consegui remover o usuário.

👤 Usuário:
${targetJid}

⚠️ Verifique se o URSINHO X BOT V2 é administrador deste grupo.

🐻 URSINHO X BOT V2`
                            }
                        );
                    } catch {}
                }

                /*
                ========================================================                                  IMPORTANTE
                ========================================================

                Nunca deixar este evento continuar para:

                • comandos
                • IA
                • VENDAIA
                • proteção
                • OCR
                • pagamentos
                • estatísticas
                ========================================================
                */

                return;
            }

            /* ========================================================
               FILTRO DE MENSAGENS ANTIGAS
            ======================================================== */

            const recent =
                isRecentMessage(
                    m,
                    sock
                );

            if (!recent) {

                return;
            }

            /* ========================================================
               REMETENTE
            ======================================================== */

            const sender =
                isGroup
                    ? (
                        m.key?.participant ||
                        m.participant
                    )
                    : chat;

            if (!sender) {
                return;
            }

            const pushName =
                m.pushName ||
                "amigo";

            const text =
                extractText(
                    m.message
                );

            // Conversas privadas associadas a lojas são encaminhadas
            // pelo contexto comercial do Tenant, sem misturar históricos.
            if (!isGroup) {
                const handledByTenant = await tenantPrivateChatService.handle(
                    sock,
                    m,
                    sender,
                    text
                );
                if (handledByTenant) return;
            }

            /* ========================================================
               ESTATÍSTICAS / UTILIZADOR
            ======================================================== */

            addMessage(
                isGroup
                    ? chat
                    : null
            );

            if (isGroup) {

                addUserMessage(
                    chat,
                    sender
                );

                updateUser(
                    chat,
                    sender,
                    pushName
                );
            }

            /* ========================================================
               CONTEXTO RECENTE DO GRUPO (pra o Chat IA)

               Guarda as últimas mensagens do grupo (de qualquer
               pessoa), pra quando alguém chamar o bot ele já saber
               do que se estava a falar, mesmo que a pergunta não
               explique tudo sozinha.
            ======================================================== */

            if (isGroup && text.trim()) {
                groupBuffer.registar(chat, pushName, text, m.key?.id);
            }

            if (
                isGroup &&
                text.trim() &&
                db.groups[chat]?.chatAI === true
            ) {

                const groupState =
                    db.groups[chat];

                if (!Array.isArray(groupState.recentMessages)) {
                    groupState.recentMessages = [];
                }

                groupState.recentMessages.push({
                    name: pushName || "alguém",
                    text: text.trim().slice(0, 300)
                });

                // Mantém só as últimas 12 mensagens
                groupState.recentMessages =
                    groupState.recentMessages.slice(-12);

                db.save();
            }

            /* ========================================================
               ANTI-CONCORRÊNCIA (verificação por mensagem)

               Roda independente do Chat IA estar ligado — só
               depende do anti-concorrência estar ativo neste
               grupo. Protegido por try/catch pra nunca quebrar
               o resto do processamento da mensagem.
            ======================================================== */

            if (isGroup && text.trim()) {

                try {
                    await verificarMensagemConcorrencia(
                        sock,
                        chat,
                        sender,
                        pushName,
                        text.trim()
                    );
                } catch (error) {
                    console.error(
                        "[ANTI-CONCORRÊNCIA] Erro ao verificar mensagem:",
                        error?.message || error
                    );
                }
            }

            /* ========================================================
               PREFIXO
            ======================================================== */

            const prefix =
                getPrefix(chat) ||
                config.PREFIX ||
                ".";

            const isCommand =
                text.startsWith(prefix);

            /* ========================================================
               AUTO-RESPONDER

               Só dispara em mensagens que NÃO são comandos, em
               grupos onde está ativado. Protegido por try/catch
               pra nunca quebrar o resto do processamento.
            ======================================================== */

            if (isGroup && !isCommand && text.trim()) {

                try {

                    const resposta =
                        autoResponderDb.encontrarResposta(chat, text.trim());

                    if (resposta) {
                        await sock.sendMessage(
                            chat,
                            { text: resposta },
                            { quoted: m }
                        );
                    }

                } catch (error) {
                    console.error(
                        "[AUTO-RESPONDER] Erro ao processar mensagem:",
                        error?.message || error
                    );
                }
            }

            /* ========================================================
               REPLY
            ======================================================== */

            const reply =
                (t) =>
                    sock.sendMessage(
                        chat,
                        {
                            text:
                                String(t)
                        },
                        {
                            quoted: m
                        }
                    );

            /* ========================================================
               PERMISSÕES
            ======================================================== */

            const owner =
                isOwner(sender, m.key?.participantAlt);

            const admin =
                isGroup
                    ? await isAdmin(
                        sock,
                        chat,
                        sender,
                        m.key?.participantAlt
                    )
                    : false;

            const permission =
                owner
                    ? "owner"
                    : admin
                        ? "admin"
                        : "user";

            /* ========================================================
               UTILIZADOR MUTADO

               Se a pessoa foi mutada por um admin/dono, a mensagem
               é apagada e nada mais é processado. Dono e admin
               nunca são bloqueados por isto, mesmo que estejam
               (por engano) na lista.

               O WhatsApp pode identificar a mesma pessoa por LID
               ou por JID (número) dependendo do momento, por isso
               comparamos com os dois formatos que o Baileys
               disponibiliza em cada mensagem recebida.
            ======================================================== */

            const mutedList =
                db.groups[chat]?.muted || [];

            const senderAlt =
                m.key?.participantAlt;

            const isMuted =
                mutedList.includes(sender) ||
                (senderAlt && mutedList.includes(senderAlt));

            if (
                isGroup &&
                !owner &&
                !admin &&
                isMuted
            ) {

                try {

                    await sock.sendMessage(
                        chat,
                        {
                            delete: m.key
                        }
                    );

                } catch (error) {

                    console.error(
                        "Erro ao apagar mensagem de utilizador mutado:",
                        error?.message || error
                    );
                }

                return;
            }

            /* ========================================================
               PROTECTION MIDDLEWARE
            ======================================================== */

            const blocked =
                await checkMessageProtection(
                    sock,
                    m,
                    {
                        chat,
                        sender,
                        text,
                        isCommand,
                        isGroup
                    }
                );

            if (blocked) {
                return;
            }

            /* ========================================================
               PAGAMENTO PENDENTE
            ======================================================== */

            if (
                isGroup &&
                !isCommand &&
                text.trim()
            ) {

                try {

                    const pending =
                        getLatestPendingPayment(
                            chat,
                            sender
                        );

                    if (pending) {

                        const recipientNumber =
                            extractClientRecipientNumber(
                                text
                            );

                        if (recipientNumber) {

                            const updated =
                                setPendingRecipientNumber(
                                    chat,
                                    sender,
                                    recipientNumber
                                );

                            if (updated) {

                                await sock.sendMessage(
                                    chat,
                                    {
                                        text:
`╭━━━〔 🐻 URSINHO X BOT 〕━━━╮
┃
┃ ✅ NÚMERO RECEBIDO
┃
┃ 👤 CLIENTE
┃ ┗ ${pushName}
┃
┃ 📲 NÚMERO PARA RECEBER
┃ ┗ ${recipientNumber}
┃
┃ 💰 VALOR
┃ ┗ ${
    updated.amount != null
        ? Number(updated.amount).toFixed(2) + " MT"
        : "Não identificado"
}
┃
┃ 🔑 REFERÊNCIA
┃ ┗ ${updated.reference}
┃
┃ ⏳ AGUARDE A CONFIRMAÇÃO DO ADM
╰━━━〔 💎 URSINHO X BOT 〕━━━╯`
                                    },
                                    {
                                        quoted: m
                                    }
                                );

                                return;
                            }
                        }
                    }

                } catch (error) {

                    console.error(
                        "Erro ao associar número ao pagamento pendente:",
                        error?.message || error
                    );
                }
            }

            /* ========================================================
               DETECTOR DE COMPROVATIVOS
            ======================================================== */

            if (isGroup) {

                try {

                    const receipt =
                        await analyzeReceipt(
                            sock,
                            m,
                            chat
                        );

                    if (receipt?.detected) {

                        if (
                            !receipt.duplicate &&
                            receipt.verified &&
                            receipt.reference &&
                            receipt.sender
                        ) {

                            const detectedRecipientNumber =
                                extractClientRecipientNumber(
                                    text,
                                    receipt.destination
                                );

                            const recipientNumber =
                                detectedRecipientNumber ||
                                null;

                            savePendingPayment(
                                chat,
                                {
                                    reference:
                                        receipt.reference,

                                    sender:
                                        receipt.sender,

                                    pushName:
                                        receipt.pushName,

                                    operator:
                                        receipt.operator,

                                    amount:
                                        receipt.amount,

                                    dateTime:
                                        receipt.dateTime,

                                    destination:
                                        receipt.destination,

                                    destinationName:
                                        receipt.destinationName,

                                    recipientNumber:
                                        recipientNumber,

                                    status:
                                        recipientNumber
                                            ? "numero_recebido"
                                            : "aguardando_numero"
                                }
                            );
                        }

                        const result =
                            formatReceiptResult(
                                receipt
                            );

                        await sock.sendMessage(
                            chat,
                            {
                                text:
                                    result,

                                mentions:
                                    [
                                        receipt.sender
                                    ].filter(Boolean)
                            },
                            {
                                quoted: m
                            }
                        );
                    }

                } catch (error) {

                    console.error(
                        "Erro no detector de comprovativos:",
                        error?.message || error
                    );
                }
            }

            /* ========================================================
               AJUDA COM O PREFIXO

               a) Alguém escreve só "prefixo" -> mostra o prefixo do grupo
               b) Alguém usa o prefixo errado (ex.: ".play" num grupo
                  que usa "!") -> diz qual é o certo
               Só em grupos com licença ativa (ou para o dono).
            ======================================================== */

            if (
                !isCommand &&
                text.trim() &&
                (isGroup || owner)
            ) {

                try {

                    if (ehPerguntaDePrefixo(text)) {

                        if (
                            checkRentalMiddleware(sender, chat, "menu") &&
                            podeAjudarAgora(sender, 5000)
                        ) {

                            await reply(
                                montarMensagemPrefixo({
                                    prefix,
                                    ehDono: owner,
                                    ehGrupo: isGroup
                                })
                            );

                            return;
                        }

                    } else if (isGroup) {

                        const errado =
                            detectarPrefixoErrado(
                                text,
                                prefix,
                                commands
                            );

                        if (
                            errado &&
                            checkRentalMiddleware(sender, chat, "menu") &&
                            podeAjudarAgora(sender)
                        ) {

                            await reply(
                                montarMensagemPrefixoErrado({
                                    prefix,
                                    detectado: errado
                                })
                            );

                            return;
                        }
                    }

                } catch (error) {

                    console.error(
                        "Erro na ajuda de prefixo:",
                        error?.message || error
                    );
                }
            }

            /* ========================================================
               CANAL (sem prefixo)

               Só responde a perguntas claras sobre o canal
               ("canal", "link do canal", "onde vejo as novidades?").
               1 resposta por grupo a cada 3 minutos.
            ======================================================== */

            if (
                !isCommand &&
                isGroup &&
                temCanal() &&
                text.trim() &&
                ehPerguntaDeCanal(text)
            ) {

                try {

                    if (
                        checkRentalMiddleware(sender, chat, "menu") &&
                        podeResponderCanal(chat)
                    ) {

                        react(sock, m, "📢").catch(() => {});
                        await reply(mensagemCanal());
                        return;
                    }

                } catch (error) {

                    console.error(
                        "Erro no gatilho do canal:",
                        error?.message || error
                    );
                }
            }

            /* ========================================================
               VENDAIA
            ======================================================== */

            if (
                !isCommand &&
                isGroup &&
                text.trim()
            ) {

                try {

                    // Papel REAL da pessoa (calculado pelo sistema)
                    const papelVenda =
                        permission === "owner"
                            ? "dono"
                            : permission === "admin"
                                ? "adm"
                                : "membro";

                    // A pessoa está a falar diretamente com o bot?
                    const idsDoBot =
                        [sock.user?.id, sock.user?.lid]
                            .filter(Boolean)
                            .map(id =>
                                String(id).split(":")[0].split("@")[0]
                            );

                    const ctxVenda =
                        m.message?.extendedTextMessage?.contextInfo || {};

                    const normVenda = jid =>
                        String(jid || "").split(":")[0].split("@")[0];

                    const enderecadoAoBot =
                        (ctxVenda.mentionedJid || []).some(
                            jid => idsDoBot.includes(normVenda(jid))
                        ) ||
                        (
                            !!ctxVenda.participant &&
                            idsDoBot.includes(normVenda(ctxVenda.participant))
                        );

                    const respostaVenda =
                        await processVendaIA({
                            groupId:
                                chat,

                            sender,

                            message:
                                text.trim(),

                            role:
                                papelVenda,

                            pushName,

                            addressedToBot:
                                enderecadoAoBot
                        });

                    if (respostaVenda) {

                        await sock.sendMessage(
                            chat,
                            {
                                text:
                                    respostaVenda
                            },
                            {
                                quoted: m
                            }
                        );

                        return;
                    }

                } catch (error) {

                    console.error(
                        "Erro na VENDAIA:",
                        error?.message || error
                    );
                }
            }

            /* ========================================================
               SUPORTE COM IA (palavra "suporte" sem prefixo)

               Lê a conversa recente do grupo e ajuda a resolver.
               Anti-spam: 1 pedido por pessoa a cada 20 s.
            ======================================================== */

            if (
                !isCommand &&
                isGroup &&
                ehPedidoDeSuporte(text)
            ) {

                try {

                    if (!checkRentalMiddleware(sender, chat, "menu")) {
                        return;
                    }

                    const respostaSuporte =
                        await responderSuporte({
                            askAI,
                            texto: text,
                            m,
                            chat,
                            sender,
                            pushName,
                            isGroup,
                            permission,
                            prefix
                        });

                    if (respostaSuporte) {
                        react(sock, m, "🛟").catch(() => {});
                        await reply(`🛟 *SUPORTE*\n\n${respostaSuporte}`);
                    }

                } catch (error) {
                    console.error(
                        "Erro no SUPORTE:",
                        error?.message || error
                    );
                }

                return;
            }

            /* ========================================================
               CHAT IA SEM PREFIXO
            ======================================================== */

            if (!isCommand) {

                if (
                    isGroup &&
                    db.groups[chat]?.chatAI === true
                ) {

                    let aiMedia = extractAIMedia(m, text);

                    // Só entra se tiver texto OU imagem/áudio —
                    // ignora mensagens vazias/outros tipos
                    if (!text.trim() && !aiMedia) {
                        return;
                    }


                    /* ====================================================
                       SÓ RESPONDER SE FOR MENCIONADO OU SE FOR
                       RESPOSTA (REPLY) A UMA MENSAGEM DO PRÓPRIO BOT

                       Isso evita que o bot responda a toda mensagem
                       do grupo — ele só entra na conversa quando é
                       chamado diretamente.
                    ==================================================== */

                    const contextInfo =
                        m.message?.extendedTextMessage?.contextInfo ||
                        m.message?.imageMessage?.contextInfo ||
                        m.message?.videoMessage?.contextInfo ||
                        m.message?.stickerMessage?.contextInfo ||
                        {};

                    /*
                    ====================================================
                    IDENTIDADE DO BOT (JID + LID)

                    O WhatsApp pode entregar a menção/citação usando
                    o número (JID) OU o identificador LID. O bot
                    precisa ser reconhecido nos dois formatos.
                    ==================================================== */

                    const botIds =
                        [
                            sock.user?.id,
                            sock.user?.lid
                        ]
                            .filter(Boolean)
                            .map(id =>
                                String(id)
                                    .split(":")[0]
                                    .split("@")[0]
                            );

                    const normalizeJid = jid =>
                        String(jid || "")
                            .split(":")[0]
                            .split("@")[0];

                    const mentionedJids =
                        contextInfo.mentionedJid || [];

                    const isMentioned =
                        botIds.length > 0 &&
                        mentionedJids.some(
                            jid =>
                                botIds.includes(
                                    normalizeJid(jid)
                                )
                        );

                    const quotedParticipant =
                        contextInfo.participant;

                    const isReplyToBot =
                        botIds.length > 0 &&
                        !!quotedParticipant &&
                        botIds.includes(
                            normalizeJid(quotedParticipant)
                        );

                    if (config.DEBUG) {
                        console.log(
                            "[CHAT IA DEBUG] botIds:", botIds,
                            "| mentionedJids:", mentionedJids,
                            "| quotedParticipant:", quotedParticipant,
                            "| isMentioned:", isMentioned,
                            "| isReplyToBot:", isReplyToBot
                        );
                    }

                    // Mencionou o bot a responder a uma imagem/áudio de outra
                    // pessoa (ex.: "@bot o que é isto?"): lê a mídia citada.
                    if (!aiMedia && isMentioned && !isReplyToBot) {
                        aiMedia = extractAIMedia(m, "");
                    }

                    if (isMentioned || isReplyToBot) {

                        try {

                            // ============================================
                            // INTERCEPTA PERGUNTAS DE IDENTIDADE/DONO
                            //
                            // Não deixamos a IA responder isto — ela tende
                            // a concordar com quem pergunta. A resposta
                            // aqui é 100% baseada na identidade REAL do
                            // remetente (isOwner), nunca na mensagem dele.
                            // ============================================

                            if (
                                !aiMedia &&
                                ehPerguntaDeIdentidade(text.trim())
                            ) {

                                await sock.sendMessage(
                                    chat,
                                    {
                                        text:
                                            `🤖 ${responderIdentidade(isOwner(sender), pushName)}`
                                    },
                                    {
                                        quoted: m
                                    }
                                );

                                return;
                            }

                            const aiUser =
                                isGroup
                                    ? db.groupUser(chat, sender)
                                    : db.privateUser(sender);

                            // Conta esta troca no contador REAL (nunca
                            // encolhe), antes de qualquer resposta —
                            // assim "esta" mensagem já entra na conta.
                            if (aiUser) {
                                aiUser.totalMensagensIA =
                                    (aiUser.totalMensagensIA || 0) + 1;
                                db.save();
                            }

                            // ============================================
                            // INTERCEPTA PERGUNTAS SOBRE CONTAGEM DE
                            // MENSAGENS — resposta real, nunca da IA.
                            // ============================================

                            if (
                                !aiMedia &&
                                ehPerguntaDeContagem(text.trim())
                            ) {

                                await sock.sendMessage(
                                    chat,
                                    {
                                        text:
                                            `🤖 ${responderContagem(aiUser?.totalMensagensIA)}`
                                    },
                                    {
                                        quoted: m
                                    }
                                );

                                return;
                            }

                            // Reage com emoji à mensagem da pessoa (quando
                            // fizer sentido) logo de início — dá feedback
                            // instantâneo, tipo humano, enquanto a resposta
                            // de texto ainda está a ser gerada.
                            if (!aiMedia) {
                                const emojiReacao =
                                    escolherReacao(text.trim());
                                if (emojiReacao) {
                                    react(sock, m, emojiReacao).catch(() => {});
                                }
                            }

                            const history =
                                aiUser?.aiHistory || [];

                            let mediaPayload = null;

                            if (aiMedia) {
                                try {
                                    mediaPayload =
                                        await downloadAIMediaBase64(
                                            sock,
                                            aiMedia
                                        );
                                } catch (mediaError) {
                                    console.error(
                                        "Erro ao baixar mídia do Chat IA:",
                                        mediaError?.message || mediaError
                                    );
                                }
                            }

                            // Contexto recente do grupo, excluindo
                            // a mensagem atual (que já vai como
                            // "question" separadamente)
                            const recentMessages =
                                Array.isArray(db.groups[chat]?.recentMessages)
                                    ? db.groups[chat].recentMessages
                                    : [];

                            const groupContext =
                                recentMessages
                                    .slice(0, -1)
                                    .slice(-8);

                            console.log(
                                "[CHAT IA DEBUG] sender:", sender,
                                "| isOwner:", isOwner(sender),
                                "| temMedia:", !!mediaPayload,
                                mediaPayload ? `(${mediaPayload.kind}, ${mediaPayload.mimetype})` : ""
                            );

                            const resposta =
                                await askAI(
                                    text.trim(),
                                    {
                                        chat,
                                        sender,
                                        isGroup,
                                        pushName,
                                        history,
                                        media: mediaPayload,
                                        groupContext,
                                        isOwner: isOwner(sender),
                                        resumoAnterior: aiUser?.resumoAnterior || null
                                    }
                                );


                            if (resposta) {

                                await sock.sendMessage(
                                    chat,
                                    {
                                        text:
                                            `🤖 ${resposta}`
                                    },
                                    {
                                        quoted: m
                                    }
                                );

                                // Responde também em voz quando: a pessoa
                                // mandou ÁUDIO, pediu resposta em áudio, ou
                                // o grupo tem a voz automática ligada.
                                const vozPedida =
                                    pediuRespostaEmAudio(text);

                                const vozAutomatica =
                                    db.groups[chat]?.aiVoiceAuto === true;

                                if (
                                    (
                                        aiMedia?.kind === "audio" ||
                                        vozPedida ||
                                        vozAutomatica
                                    ) &&
                                    temTtsConfigurado()
                                ) {
                                    try {

                                        const oggPath =
                                            await generateSpeech(resposta, db.getVoice(chat), { maxChars: vozPedida ? 3500 : 1800 });

                                        if (oggPath) {

                                            await sock.sendMessage(
                                                chat,
                                                {
                                                    audio:
                                                        fs.readFileSync(oggPath),
                                                    mimetype:
                                                        "audio/ogg; codecs=opus",
                                                    ptt: true
                                                },
                                                { quoted: m }
                                            );

                                            try {
                                                fs.unlinkSync(oggPath);
                                            } catch {}
                                        }

                                    } catch (ttsError) {
                                        console.error(
                                            "Erro ao gerar resposta em voz:",
                                            ttsError?.message || ttsError
                                        );
                                    }
                                }

                                if (aiUser) {

                                    const novoHistorico =
                                        [
                                            ...history,
                                            {
                                                role: "user",
                                                content: text.trim()
                                            },
                                            {
                                                role: "assistant",
                                                content: resposta
                                            }
                                        ];

                                    /* mantém só as últimas 3 trocas (6 mensagens)
                                       para respostas mais rápidas e não deixar
                                       o db.json a crescer sem controlo */

                                    const mensagensACortar =
                                        novoHistorico.slice(0, -10);

                                    aiUser.aiHistory =
                                        novoHistorico.slice(-10);

                                    db.save();

                                    // Em vez de simplesmente apagar as mensagens
                                    // antigas, resume-as antes de as perder —
                                    // assim conversas longas não "esquecem" tudo
                                    // de repente. Corre depois de já termos
                                    // respondido (não atrasa a resposta à pessoa).
                                    if (mensagensACortar.length > 0) {
                                        resumirTrecho(
                                            aiUser.resumoAnterior,
                                            mensagensACortar
                                        )
                                            .then((novoResumo) => {
                                                if (novoResumo) {
                                                    aiUser.resumoAnterior = novoResumo;
                                                    db.save();
                                                }
                                            })
                                            .catch((err) => {
                                                console.error(
                                                    "Erro ao resumir conversa:",
                                                    err?.message || err
                                                );
                                            });
                                    }
                                }
                            }

                        } catch (error) {

                            console.error(
                                "Erro no Chat IA:",
                                error?.message || error
                            );
                        }
                    }
                }

                /* ====================================================
                   PRIVADO: BLOQUEADO POR REGRA

                   O bot não deve conversar no privado. Primeira
                   mensagem → avisa e mostra o número de suporte.
                   Segunda mensagem em diante → bloqueia o número.
                ==================================================== */

                if (
                    !isGroup &&
                    !isOwner(sender) &&
                    text.trim()
                ) {

                    try {

                        const privateUser =
                            db.groupUser(chat, sender);

                        if (!privateUser.privateBanned) {

                            if (privateUser.privateWarned) {

                                // Segunda mensagem: bloqueia de verdade
                                try {
                                    await sock.updateBlockStatus(
                                        sender,
                                        "block"
                                    );
                                } catch (blockError) {
                                    console.error(
                                        "Erro ao bloquear número no privado:",
                                        blockError?.message || blockError
                                    );
                                }

                                privateUser.privateBanned = true;
                                db.save();

                                try {
                                    await sock.sendMessage(
                                        chat,
                                        {
                                            text:
                                                `🚫 Foste bloqueado por continuar a enviar mensagens no privado após o aviso.\n\n` +
                                                `📞 Suporte: wa.me/${config.OWNER_NUMBER}`
                                        }
                                    );
                                } catch (sendError) {
                                    // pode falhar se o bloqueio já
                                    // impediu o envio — sem problema
                                }

                            } else {

                                privateUser.privateWarned = true;
                                db.save();

                                await sock.sendMessage(
                                    chat,
                                    {
                                        text:
                                            mensagemPrivado()
                                    },
                                    {
                                        quoted: m
                                    }
                                );
                            }
                        }

                    } catch (error) {

                        console.error(
                            "Erro no aviso do privado:",
                            error?.message || error
                        );
                    }
                }

                return;
            }

            /* ========================================================
               EXTRAIR COMANDO
            ======================================================== */

            const body =
                text
                    .slice(prefix.length)
                    .trim();

            const [
                raw,
                ...args
            ] =
                body.split(/\s+/);

            // Texto dos argumentos com a formatação ORIGINAL intacta
            // (quebras de linha, espaços duplos). ctx.args perde isto
            // porque é dividido por /\s+/ — usar ctx.argsTexto quando
            // a formatação importa (ex: .addauto).
            const argsTexto =
                body
                    .slice(String(raw || "").length)
                    .replace(/^[ \t]*\r?\n?/, "")
                    .trimEnd();

            const cmd =
                commands.get(
                    String(raw || "")
                        .toLowerCase()
                );

            /* ========================================================
               COMANDO NÃO ENCONTRADO -> SUGESTÕES INTELIGENTES

               Em vez de silêncio ou "comando não existe", sugere o
               comando certo (erro de digitação, sinónimo ou intenção).
               Membros só recebem resposta se houver uma sugestão
               plausível (para ".kkk" o bot fica calado). Dono, admins
               e o privado recebem sempre uma resposta.
            ======================================================== */

            if (!cmd) {

                if (!parecePedidoDeComando(raw)) {
                    return;
                }

                if (!checkRentalMiddleware(sender, chat, "menu")) {
                    return;
                }

                if (!podeAjudarAgora(sender)) {
                    return;
                }

                const sugestoes =
                    sugerirComandos(
                        String(raw || "").toLowerCase(),
                        argsTexto,
                        commands
                    );

                const mensagemSugestao =
                    montarMensagemSugestao({
                        digitado: raw,
                        argsTexto,
                        prefix,
                        sugestoes,
                        responderSemSugestao:
                            !isGroup || permission !== "user"
                    });

                if (!mensagemSugestao) {
                    return;
                }

                react(sock, m, "❓").catch(() => {});

                return reply(mensagemSugestao);
            }

            /* ========================================================
               REAÇÃO INICIAL
            ======================================================== */

            await react(
                sock,
                m,
                "⚡"
            );


            /* ========================================================
               RENTAL MIDDLEWARE
            ======================================================== */

            if (
                !checkRentalMiddleware(
                    sender,
                    chat,
                    cmd.name
                )
            ) {

                const infoLicenca =
                    rentalStatus(chat);

                const estadoLicenca =
                    infoLicenca.blocked
                        ? "bloqueado"
                        : infoLicenca.expiresAt
                            ? "expirada"
                            : "nunca";

                const mensagemLicenca =
                    mensagemSemLicenca({
                        estado: estadoLicenca,
                        expiresAt: infoLicenca.expiresAt,
                        prefix,
                        comLinhaCanal: false
                    });

                const botoesLicenca = [

                    {
                        tipo:
                            "cta_url",

                        texto:
                            "💬 FALAR COM O PROPRIETÁRIO",

                        url:
                            `https://wa.me/${config.OWNER_NUMBER}`
                    },

                    {
                        tipo:
                            "cta_url",

                        texto:
                            "📞 LIGAR — 85 774 5014",

                        url:
                            "tel:+258857745014"
                    },

                    {
                        tipo:
                            "cta_url",

                        texto:
                            "📞 LIGAR — 87 714 5014",

                        url:
                            "tel:+258877145014"
                    }
                ];

                if (temCanal()) {
                    botoesLicenca.push({
                        tipo: "cta_url",
                        texto: "📢 SEGUIR O NOSSO CANAL",
                        url: urlCanalBot()
                    });
                }

                try {

                    await sendMenuNative(
                        sock,
                        chat,
                        mensagemLicenca,
                        botoesLicenca,
                        {
                            quoted: m,
                            media: "owner"
                        }
                    );

                } catch (error) {

                    console.error(
                        "❌ Erro ao enviar menu de licença:",
                        error?.message || error
                    );

                    return reply(
                        mensagemLicenca
                    );
                }

                return;
            }

            /* ========================================================
               ESTATÍSTICA DO COMANDO
            ======================================================== */

            addCommand(
                isGroup
                    ? chat
                    : null
            );

            if (isGroup) {

                addUserCommand(
                    chat,
                    sender
                );
            }

            /* ========================================================
               PERMISSÃO CENTRAL
               O comando declara `permission: "admin"|"owner"` e a
               regra é aplicada aqui, igual para todos.
            ======================================================== */

            if (!temPermissao(permission, cmd.permission)) {
                react(sock, m, "🚫").catch(() => {});
                return reply(mensagemNegado(cmd.permission));
            }

            /* ========================================================
               COOLDOWN POR COMANDO
               Evita gastar as cotas (Gemini, Yoinku...) com repetições.
               Avisa só na 1ª vez; as repetições seguintes são ignoradas.
            ======================================================== */

            const cooldown =
                verificarCooldown(sender, cmd, permission);

            if (cooldown.bloqueado) {

                react(sock, m, "⏳").catch(() => {});

                if (cooldown.avisar) {
                    return reply(
                        `⏳ Aguarde *${cooldown.restante}s* para usar *${prefix}${cmd.name}* de novo.`
                    );
                }

                return;
            }

            /* ========================================================
               EXECUTAR COMANDO
            ======================================================== */

            const ctx =
                createCommandContext({
                    m,
                    chat,
                    isGroup,
                    sender,
                    pushName,
                    args,
                    argsTexto,
                    text,
                    prefix,
                    reply,
                    permission,
                    db,
                    commandCount
                });

            try {

                await cmd.run(
                    sock,
                    m,
                    ctx
                );

            } catch (erroComando) {

                // Avisa o dono se o MESMO comando falhar 3x em 10 min
                alertasDono.erroDeComando(cmd.name, erroComando);

                throw erroComando;
            }

            /* ========================================================
               REAÇÃO DE SUCESSO
            ======================================================== */

            await react(
                sock,
                m,
                "✅"
            );

        } catch (e) {

            console.error(
                "Erro no handler:",
                e?.message || e
            );

            /* ========================================================
               REAÇÃO DE ERRO
            ======================================================== */

            try {

                await react(
                    sock,
                    m,
                    "❌"
                );

            } catch {}
        }
    };
}

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
    buildHandler,
    isRecentMessage
};
