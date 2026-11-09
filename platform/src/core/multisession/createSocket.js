const {
    default: makeWASocket,
    fetchLatestBaileysVersion,
    DisconnectReason,
    Browsers
} = require("@whiskeysockets/baileys");

const P = require("pino");
const qrcode = require("qrcode-terminal");
const { Boom } = require("@hapi/boom");
const { getAuth } = require("./auth");
const { styleBotText } = require("../../lib/textStyle");
const db = require("../../database/database");
const sessionRegistry = require("../../services/sessionRegistryService");


/* ============================================================
   ESTILO DE TEXTO DO SOCKET
   Mensagens de grupo usam a fonte configurada no próprio grupo.
   Estruturas do Baileys permanecem intactas.
============================================================ */

function resolveSocketFont(jid) {
    if (typeof jid === "string" && jid.endsWith("@g.us")) {
        const group = db.group(jid);

        if (group && typeof group.font === "string") {
            return group.font;
        }

        return "serif";
    }

    return "serif";
}

function styleNativeButtonParams(buttonParamsJson, font) {
    if (
        typeof buttonParamsJson !== "string" ||
        !buttonParamsJson
    ) {
        return buttonParamsJson;
    }

    try {
        const params = JSON.parse(buttonParamsJson);

        if (typeof params.display_text === "string") {
            params.display_text = styleBotText(
                params.display_text,
                font
            );
        }

        return JSON.stringify(params);

    } catch {
        return buttonParamsJson;
    }
}

function styleInteractiveContent(interactive, font) {
    if (!interactive || typeof interactive !== "object") {
        return;
    }

    /*
    ============================================================
    HEADER
    ============================================================
    */

    if (interactive.header) {
        if (typeof interactive.header.title === "string") {
            interactive.header.title = styleBotText(
                interactive.header.title,
                font
            );
        }

        if (typeof interactive.header.subtitle === "string") {
            interactive.header.subtitle = styleBotText(
                interactive.header.subtitle,
                font
            );
        }

        /*
        IMPORTANTE:
        header.videoMessage NÃO deve ser alterado.
        */
    }

    /*
    ============================================================
    BODY
    ============================================================
    */

    if (
        interactive.body &&
        typeof interactive.body.text === "string"
    ) {
        interactive.body.text = styleBotText(
            interactive.body.text,
            font
        );
    }

    /*
    ============================================================
    FOOTER
    ============================================================
    */

    if (
        interactive.footer &&
        typeof interactive.footer.text === "string"
    ) {
        interactive.footer.text = styleBotText(
            interactive.footer.text,
            font
        );
    }

    /*
    ============================================================
    NATIVE FLOW / BOTÕES
    ============================================================
    */

    if (
        interactive.nativeFlowMessage &&
        Array.isArray(interactive.nativeFlowMessage.buttons)
    ) {
        for (const button of interactive.nativeFlowMessage.buttons) {
            if (
                button &&
                typeof button.buttonParamsJson === "string"
            ) {
                button.buttonParamsJson =
                    styleNativeButtonParams(
                        button.buttonParamsJson,
                        font
                    );
            }
        }
    }

    /*
    ============================================================
    CAROUSEL
    ============================================================
    */

    if (
        interactive.carouselMessage &&
        Array.isArray(interactive.carouselMessage.cards)
    ) {
        for (const card of interactive.carouselMessage.cards) {
            styleInteractiveContent(card, font);
        }
    }
}
function styleRelayMessage(message, font) {
    if (!message || typeof message !== "object") {
        return;
    }

    /*
    ============================================================
    MENSAGENS DE TEXTO / MÍDIA
    ============================================================
    */

    if (typeof message.conversation === "string") {
        message.conversation =
            styleBotText(
                message.conversation,
                font
            );
    }

    if (
        message.extendedTextMessage &&
        typeof message.extendedTextMessage.text === "string"
    ) {
        message.extendedTextMessage.text =
            styleBotText(
                message.extendedTextMessage.text,
                font
            );
    }

    if (
        message.imageMessage &&
        typeof message.imageMessage.caption === "string"
    ) {
        message.imageMessage.caption =
            styleBotText(
                message.imageMessage.caption,
                font
            );
    }

    if (
        message.videoMessage &&
        typeof message.videoMessage.caption === "string"
    ) {
        message.videoMessage.caption =
            styleBotText(
                message.videoMessage.caption,
                font
            );
    }

    if (
        message.documentMessage &&
        typeof message.documentMessage.caption === "string"
    ) {
        message.documentMessage.caption =
            styleBotText(
                message.documentMessage.caption,
                font
            );
    }

    /*
    ============================================================
    INTERACTIVE MESSAGE
    ============================================================
    */

    if (message.interactiveMessage) {
        styleInteractiveContent(
            message.interactiveMessage,
            font
        );
    }

    /*
    ============================================================
    WRAPPERS DO BAILEYS
    ============================================================
    */

    if (message.viewOnceMessage?.message) {
        styleRelayMessage(
            message.viewOnceMessage.message,
            font
        );
    }

    if (message.viewOnceMessageV2?.message) {
        styleRelayMessage(
            message.viewOnceMessageV2.message,
            font
        );
    }

    if (
        message.viewOnceMessageV2Extension?.message
    ) {
        styleRelayMessage(
            message.viewOnceMessageV2Extension.message,
            font
        );
    }

    if (message.ephemeralMessage?.message) {
        styleRelayMessage(
            message.ephemeralMessage.message,
            font
        );
    }

    if (message.documentWithCaptionMessage?.message) {
        styleRelayMessage(
            message.documentWithCaptionMessage.message,
            font
        );
    }
}

function createGlobalStyledSocket(sock) {
    const originalSendMessage =
        sock.sendMessage.bind(sock);

    const originalRelayMessage =
        sock.relayMessage.bind(sock);

    return new Proxy(sock, {
        get(target, property) {

            if (property === "sendMessage") {
                return async function sendMessageStyled(
                    jid,
                    content = {},
                    options
                ) {
                    const payload = {
                        ...content
                    };

                    const font =
                        resolveSocketFont(jid);

                    if (
                        typeof payload.text === "string"
                    ) {
                        payload.text =
                            styleBotText(
                                payload.text,
                                font
                            );
                    }

                    if (
                        typeof payload.caption === "string"
                    ) {
                        payload.caption =
                            styleBotText(
                                payload.caption,
                                font
                            );
                    }

                    return originalSendMessage(
                        jid,
                        payload,
                        options
                    );
                };
            }

            if (property === "relayMessage") {
                return async function relayMessageStyled(
                    jid,
                    message,
                    options
                ) {
                    const font =
                        resolveSocketFont(jid);

                    styleRelayMessage(
                        message,
                        font
                    );

                    return originalRelayMessage(
                        jid,
                        message,
                        options
                    );
                };
            }

            return Reflect.get(
                target,
                property,
                target
            );
        }
    });
}

// Tentativas seguidas de reconexão por sessão (zera ao conectar)
const reconnectAttempts = new Map();

function reconnectDelay(sessionName, reason) {

    // 515 = restartRequired (normal logo após o pareamento): sem espera
    if (reason === DisconnectReason.restartRequired) {
        return 0;
    }

    const attempt =
        (reconnectAttempts.get(sessionName) || 0) + 1;

    reconnectAttempts.set(sessionName, attempt);

    return Math.min(30000, 2000 * 2 ** (attempt - 1));
}

function normalizePairingNumber(value) {

    const digits =
        String(value || "").replace(/[^0-9]/g, "");

    return digits.length >= 8 && digits.length <= 15
        ? digits
        : null;
}

async function createSocket(
    sessionName = "principal",
    onSocketReady = null,
    previousSessionId = null,
    onQRCode = null,
    options = {}
) {

    const { state, saveCreds } =
        await getAuth(sessionName);

    /*
    ============================================================
    REGISTRO DA SESSÃO
    ============================================================
    */

    const sessionRecord =
        sessionRegistry.registerSession({
            sessionId: previousSessionId || undefined,
            sessionName,
            sessionType: sessionName === "principal"
                ? "principal"
                : "rental",
            status: "connecting"
        });

    const sessionId =
        sessionRecord.sessionId;

    if (previousSessionId) {
        console.log(
            `🔄 Reconectando sessão existente: ${sessionId}`
        );
    } else {
        console.log(
            `🆕 Nova sessão registrada: ${sessionId}`
        );
    }

    const { version } =
        await fetchLatestBaileysVersion();

    const rawSock = makeWASocket({

        version,

        auth: state,

        logger: P({
            level: "silent"
        }),

        browser: Browsers.ubuntu(
            "Chrome"
        ),

        printQRInTerminal: false,

        generateHighQualityLinkPreview: false
    });

    rawSock.ev.on(
        "creds.update",
        saveCreds
    );

    // ============================================================
    // CÓDIGO DE PAREAMENTO (alternativa ao QR Code)
    //
    // - Sessão "principal": usa PAIRING_NUMBER do .env.
    // - Outras sessões (aluguel): só usam pairing se o número
    //   for passado em options.pairingNumber (comando .pair).
    //   Nunca herdam o número do dono.
    // - O código é pedido no 1º evento "qr" (socket pronto).
    // - QR Code continua a aparecer (os dois funcionam).
    //   PAIRING_ONLY=true esconde o QR do terminal.
    //
    // No WhatsApp: Definições > Dispositivos ligados >
    // Ligar com número de telefone > insere o código.
    // ============================================================

    const pairingNumber =
        normalizePairingNumber(
            options.pairingNumber ||
            (sessionName === "principal"
                ? process.env.PAIRING_NUMBER
                : null)
        );

    const pairingEnabled =
        !state.creds.registered &&
        !!pairingNumber;

    const pairingOnly =
        String(process.env.PAIRING_ONLY || "")
            .toLowerCase() === "true";

    let pairingAttempts = 0;
    let pairingDone = false;

    async function requestPairing() {

        if (
            !pairingEnabled ||
            pairingDone ||
            pairingAttempts >= 3
        ) {
            return;
        }

        pairingAttempts++;

        try {

            const raw =
                await rawSock.requestPairingCode(
                    pairingNumber
                );

            pairingDone = true;

            const codigo =
                String(raw).match(/.{1,4}/g)?.join("-") || raw;

            console.log(
                "═══════════════════════════════════════"
            );
            console.log(
                `🔑 CÓDIGO DE PAREAMENTO: ${codigo}`
            );
            console.log(
                `📱 Número: ${pairingNumber}`
            );
            console.log(
                "No WhatsApp: Definições > Dispositivos ligados > Ligar com número de telefone"
            );
            console.log(
                "═══════════════════════════════════════"
            );

            sessionRegistry.updateSession(
                sessionId,
                {
                    status: "pairing_pending"
                }
            );

            if (typeof options.onPairingCode === "function") {
                await options.onPairingCode(
                    codigo,
                    {
                        sessionName,
                        sessionId,
                        pairingNumber
                    }
                );
            }

        } catch (error) {

            console.error(
                `Erro ao gerar código de pareamento (tentativa ${pairingAttempts}/3):`,
                error?.message || error
            );
        }
    }

    rawSock.ev.on(
        "connection.update",
        async (update) => {

            const {
                connection,
                lastDisconnect,
                qr
            } = update;

            if (qr) {

                if (pairingEnabled) {
                    await requestPairing();
                }

                if (typeof onQRCode === "function" && !options.pairingNumber) {
                    await onQRCode(qr, {
                        sessionName,
                        sessionId
                    });
                }

                  sessionRegistry.updateSession(
                      sessionId,
                      {
                          status: "qr_pending"
                      }
                  );

                  console.log(
                      `📲 QR Code disponível para a sessão ${sessionId}`
                  );

                  console.log(
                      "📲 Escaneie o QR Code:"
                  );

                if (!(pairingEnabled && pairingOnly)) {
                    qrcode.generate(
                        qr,
                        {
                            small: true
                        }
                    );
                }
            }

            if (connection === "open") {

                // Marca o instante exato da conexão.
                // Mensagens anteriores a este momento serão ignoradas.
                reconnectAttempts.delete(sessionName);

                rawSock.__ursinhoConnectedAt = Date.now();
                rawSock.__ursinhoMessageWindowStart =
                    rawSock.__ursinhoConnectedAt;

                
                  /*
                  ============================================================
                   ATUALIZAÇÃO DA SESSÃO — CONECTADA
                  ============================================================
                  */

                  const connectedUser =
                      rawSock.user || {};

                  const connectedJid =
                      connectedUser.id || null;

                  const connectedLid =
                      connectedUser.lid || null;

                  const connectedName =
                      connectedUser.name ||
                      connectedUser.verifiedName ||
                      null;

                  const connectedPhone =
                      connectedJid
                          ? connectedJid.split(":")[0].split("@")[0]
                          : null;

                  sessionRegistry.markConnected(
                      sessionId,
                      {
                          phone: connectedPhone,
                          jid: connectedJid,
                          lid: connectedLid,
                          status: "connected",
                          connectedAt: rawSock.__ursinhoConnectedAt
                      }
                  );

                  console.log(
                      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                  );

                  console.log(
                      "🟢 SESSÃO WHATSAPP CONECTADA"
                  );

                  console.log(
                      `🆔 Sessão: ${sessionId}`
                  );

                  console.log(
                      `📱 Número: ${connectedPhone || "não identificado"}`
                  );

                  console.log(
                      `🆔 JID: ${connectedJid || "não identificado"}`
                  );

                  console.log(
                      `🔐 LID: ${connectedLid || "não identificado"}`
                  );

                  console.log(
                      `👤 Nome: ${connectedName || "não identificado"}`
                  );

                  console.log(
                      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                  );

                  console.log(
                      `✅ ${sessionName} conectado`
                  );

                  console.log(
                      "🕐 Processamento de mensagens: somente após a conexão"
                  );

                if (
                    typeof onSocketReady === "function"
                ) {

                    await onSocketReady(createGlobalStyledSocket(rawSock));
                }
            }

            if (connection === "close") {

                const reason =
                    new Boom(
                        lastDisconnect?.error
                    )?.output?.statusCode;

                  /*
                  ============================================================
                   REGISTRO DA DESCONEXÃO
                  ============================================================
                  */

                  const disconnectedSession =
                      sessionRegistry.markDisconnected(
                          sessionId,
                          reason
                      );

                  if (disconnectedSession) {

                      console.log(
                          "🔴 SESSÃO REGISTRADA COMO DESCONECTADA"
                      );

                      console.log(
                          `🆔 Sessão: ${sessionId}`
                      );

                      console.log(
                          `📱 Número: ${disconnectedSession.phone || "não identificado"}`
                      );

                      console.log(
                          `🆔 JID: ${disconnectedSession.jid || "não identificado"}`
                      );

                      console.log(
                          `🔐 LID: ${disconnectedSession.lid || "não identificado"}`
                      );

                      console.log(
                          `❌ Motivo: ${reason || "não identificado"}`
                      );

                      console.log(
                          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                      );
                  }

                console.log(
                    "❌ Conexão fechada:",
                    reason
                );

                if (
                    reason !== DisconnectReason.loggedOut
                ) {

                    const espera =
                        reconnectDelay(sessionName, reason);

                    console.log(
                        `🔄 Reconectando${espera ? ` em ${espera / 1000}s` : ""}...`
                    );

                    if (espera) {
                        await new Promise(
                            (resolve) => setTimeout(resolve, espera)
                        );
                    }

                    try {

                          await createSocket(
                                sessionName,
                                onSocketReady,
                                sessionId,
                                onQRCode,
                                options
                            );

                    } catch (error) {

                        console.error(
                            "❌ Erro durante reconexão:",
                            error?.message || error
                        );
                    }

                } else {

                    console.log(
                        "🚫 Sessão deslogada. Apague a pasta sessions."
                    );
                }
            }
        }
    );

    return createGlobalStyledSocket(rawSock);
}

module.exports = {
    createSocket
};
