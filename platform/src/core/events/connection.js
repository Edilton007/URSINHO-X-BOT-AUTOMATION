const { Boom } = require("@hapi/boom");
const { DisconnectReason } = require("@whiskeysockets/baileys");
const alertas = require("../../services/alertService");

function registerConnection(sock) {

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {

    if (connection === "open") {

      sock.__ursinhoConnectedAt = Date.now();

      /*
       * Janela de tolerância para mensagens que chegaram
       * imediatamente antes da reconexão.
       */
      sock.__ursinhoMessageWindowStart =
        sock.__ursinhoConnectedAt;

      console.log("✅ BOT CONECTADO");
      alertas.registarConexao();
      console.log("🕐 Processamento de mensagens: somente após a conexão");
      return;
    }

    if (connection === "close") {

      const code = new Boom(
        lastDisconnect?.error
      )?.output?.statusCode;

      console.log("CONEXÃO FECHADA:", code);
      alertas.registarDesconexao(code);

      if (code !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconexão necessária");
      } else {
        console.log("❌ Sessão encerrada");
      }

    }

  });

}

module.exports = {
  registerConnection
};
