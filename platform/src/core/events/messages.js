const customerIdentityService = require("../../automation/services/customerIdentityService");

function extractPairingText(message) {
  return String(
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ""
  ).trim();
}

async function processGroupPairing(sock, message) {
  const groupId = message?.key?.remoteJid;
  if (!groupId || !groupId.endsWith("@g.us")) return false;

  const text = extractPairingText(message?.message);
  const match = text.match(/^(?:!ursinho|\.ursinho)\s+(?:conectar|associar)\s+([A-F0-9]{10})$/i);
  if (!match) return false;

  const sender = message?.key?.participant || message?.key?.participantAlt;
  if (!sender) {
    await sock.sendMessage(groupId, { text: "Não consegui validar quem enviou o código. Tenta novamente como administrador do grupo." });
    return true;
  }

  let metadata;
  try {
    metadata = await sock.groupMetadata(groupId);
  } catch {
    await sock.sendMessage(groupId, { text: "Não consegui verificar as permissões deste grupo. Nenhuma associação foi feita." });
    return true;
  }

  const participant = (metadata?.participants || []).find(p =>
    p?.id === sender || p?.phoneNumber === sender || p?.lid === sender
  );
  if (!participant || !["admin", "superadmin"].includes(participant.admin)) {
    await sock.sendMessage(groupId, { text: "Por segurança, apenas um administrador do grupo pode associá-lo a uma loja." });
    return true;
  }

  const result = customerIdentityService.associarGrupoPorCodigo(
    groupId,
    metadata?.subject || "",
    match[1]
  );
  if (result.ok) {
    const sync = customerIdentityService.sincronizarMembrosGrupo(
      groupId,
      metadata?.participants || []
    );
    if (!sync.ok) {
      console.error("[TENANT IDENTITY] Associação feita, mas a sincronização inicial dos membros falhou:", sync.error);
    } else {
      console.log(`[TENANT IDENTITY] ${sync.sincronizados} membros sincronizados para o grupo ${groupId}.`);
    }
  }
  await sock.sendMessage(groupId, {
    text: result.ok
      ? "✅ Grupo associado ao URSINHO X BOT. Os membros atuais foram sincronizados e o atendimento desta conversa será encaminhado para a loja configurada."
      : `Não foi possível associar este grupo: ${result.error}`
  });
  return true;
}

function registerMessages(sock, handle) {

  sock.ev.on(
    "messages.upsert",
    async ({ messages, type }) => {

      console.log(
        `📨 [MESSAGES.UPsert] tipo=${type} quantidade=${messages?.length || 0}`
      );

      for (const m of messages) {

        /*
        ============================================================
        📌 PIN IN CHAT
        Detecta:
        PIN_FOR_ALL   → mensagem afixada
        UNPIN_FOR_ALL → mensagem desafixada
        ============================================================
        */

        const pinInChat =
          m?.message?.pinInChatMessage;

        if (pinInChat) {

          const action =
            pinInChat?.type;

          const groupJid =
            m?.key?.remoteJid;

          const actor =
            m?.key?.participantAlt ||
            m?.key?.participant;

          const targetMessage =
            pinInChat?.key;

          const isPin =
            action === "PIN_FOR_ALL";

          const isUnpin =
            action === "UNPIN_FOR_ALL";

          if (isPin || isUnpin) {

            console.log(
              "\n╔══════════════════════════════════════╗"
            );

            console.log(
              isPin
                ? "║ 📌 MENSAGEM AFIXADA"
                : "║ 📍 MENSAGEM DESAFIXADA"
            );

            console.log(
              "╚══════════════════════════════════════╝"
            );

            console.log(
              "[PIN] GRUPO:",
              groupJid
            );

            console.log(
              "[PIN] RESPONSÁVEL:",
              actor
            );

            console.log(
              "[PIN] TIPO:",
              action
            );

            console.log(
              "[PIN] ID DO EVENTO:",
              m?.key?.id
            );

            console.log(
              "[PIN] MENSAGEM AFETADA:",
              JSON.stringify(
                targetMessage,
                null,
                2
              )
            );

            console.log(
              "[PIN] TIMESTAMP:",
              pinInChat?.senderTimestampMs
            );

            console.log(
              "════════════════════════════════════════\n"
            );
          }

          /*
          ==========================================================
          IMPORTANTE

          Eventos de PIN não são mensagens normais.

          Portanto NÃO devem continuar para:

          • comandos
          • IA
          • VENDAIA
          • OCR
          • pagamentos
          • proteção
          • estatísticas
          ==========================================================
          */

          continue;
        }

        // O pairing é processado antes dos comandos gerais do Bot V2.
        // Se a mensagem for um código de associação, não deve seguir
        // para IA, comandos, OCR ou outros handlers.
        if (await processGroupPairing(sock, m)) {
          continue;
        }

        /*
        ============================================================
        📨 MENSAGEM NORMAL
        ============================================================
        */

        await handle(
          sock,
          m
        );
      }

    }
  );

}

module.exports = {
  registerMessages
};
