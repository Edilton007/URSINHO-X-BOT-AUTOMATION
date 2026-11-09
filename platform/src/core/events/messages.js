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
