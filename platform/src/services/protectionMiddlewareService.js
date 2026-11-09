const { detectViolation } = require("./protectionService");
const { getProtectionSettings } = require("./protectionGuardService");
const { canIgnore } = require("./antiService");
const { handleInfraction } = require("./infractionHandlerService");
const { checkFlood } = require("./floodService");


async function checkMessageProtection(sock, m, context) {

  const {
    chat,
    sender,
    text,
    isCommand,
    isGroup
  } = context;


  if (!isGroup || isCommand) {
    return false;
  }


  const anti =
    getProtectionSettings(chat);


  /* ==========================================================
     ANTI-FLOOD

     Verifica antes das outras proteções, porque flood é sobre
     FREQUÊNCIA de mensagens, não sobre o conteúdo de uma
     mensagem específica.
  ========================================================== */

  if (anti.flood && checkFlood(chat, sender)) {

    const ignoreFlood =
      await canIgnore(
        sock,
        chat,
        sender
      );

    if (!ignoreFlood) {

      await handleInfraction(
        sock,
        chat,
        m,
        sender,
        "🌊",
        "Flood detetado — muitas mensagens em pouco tempo."
      );

      return true;
    }
  }


  const violation = detectViolation(
    m.message,
    text,
    anti
  );


  if (!violation) {
    return false;
  }


  const ignore = await canIgnore(
    sock,
    chat,
    sender
  );


  if (ignore) {
    return false;
  }


  await handleInfraction(
    sock,
    chat,
    m,
    sender,
    violation.emoji,
    violation.reason
  );

  return true;

}


module.exports = {
  checkMessageProtection
};
