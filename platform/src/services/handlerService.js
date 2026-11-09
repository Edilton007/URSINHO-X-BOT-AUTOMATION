function getMessageContext(m) {

  const chat = m.key.remoteJid;

  const isGroup =
    chat.endsWith("@g.us");

  const sender =
    isGroup
      ? (m.key.participant || m.participant)
      : chat;

  const pushName =
    m.pushName || "amigo";

  return {
    chat,
    isGroup,
    sender,
    pushName
  };

}


module.exports = {
  getMessageContext
};
