const {
  addInfraction,
  clearInfractions
} = require("./infractionService");

const { react } = require("../lib/reactions");
const { removeAndWarn } = require("./antiService");


async function handleInfraction(
  sock,
  chat,
  m,
  sender,
  emoji,
  reason
) {

  const total =
    addInfraction(chat, sender);


  if (total >= 3) {

    try {

      await sock.sendMessage(chat, {
        delete: m.key
      });


      await react(
        sock,
        m,
        "🚫"
      );


      await sock.groupParticipantsUpdate(
        chat,
        [sender],
        "remove"
      );


      clearInfractions(
        chat,
        sender
      );


      await sock.sendMessage(
        chat,
        {
          text:
`╔══════════════════════╗
║ 🚫 USUÁRIO REMOVIDO
╚══════════════════════╝

Usuário:
@${sender.split("@")[0]}

Motivo:
Excesso de infrações.

Infrações:
${total}/3

🐻 URSINHO X BOT V2`,
          mentions: [sender]
        },
        {
          quoted: m
        }
      );


    } catch (e) {

      console.log(
        "Erro ao remover usuário:",
        e?.message || e
      );

    }


    return true;

  }


  await removeAndWarn(
    sock,
    chat,
    m,

`╔══════════════════════╗
║ 🛡️ SISTEMA DE INFRAÇÕES
╚══════════════════════╝

${emoji} ${reason}

Usuário:
@${sender.split("@")[0]}

Infrações:
${total}/3

⚠️ Ao atingir 3 infrações o usuário será removido.

🐻 URSINHO X BOT V2`,

    sender
  );


  return true;

}


module.exports = {
  handleInfraction
};
