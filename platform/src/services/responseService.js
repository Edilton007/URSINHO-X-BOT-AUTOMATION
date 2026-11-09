const { react } = require("../lib/reactions");


function createReply(sock, chat, m) {

  return (text) => {

    return sock.sendMessage(
      chat,
      {
        text: String(text)
      },
      {
        quoted: m
      }
    );

  };

}


async function reactMessage(sock, m, emoji) {

  try {

    await react(
      sock,
      m,
      emoji
    );

  } catch {}

}


module.exports = {
  createReply,
  reactMessage
};
