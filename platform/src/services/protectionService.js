const {
  hasLink,
  isMediaImage,
  isMediaVideo,
  isMediaAudio,
  isMediaSticker
} = require("./antiService");

const { containsProfanity } = require("./profanityService");


function detectViolation(message, text, anti) {

  if (anti.link && hasLink(text)) {
    return {
      type: "link",
      emoji: "🔗",
      reason: "Link não permitido."
    };
  }


  if (anti.palavrao && containsProfanity(text, anti.customPalavroes || [])) {
    return {
      type: "palavrao",
      emoji: "🤬",
      reason: "Linguagem imprópria detetada."
    };
  }


  if (anti.image && isMediaImage(message)) {
    return {
      type: "image",
      emoji: "🖼️",
      reason: "Envio de imagem bloqueado."
    };
  }


  if (anti.video && isMediaVideo(message)) {
    return {
      type: "video",
      emoji: "🎥",
      reason: "Envio de vídeo bloqueado."
    };
  }


  if (anti.audio && isMediaAudio(message)) {
    return {
      type: "audio",
      emoji: "🔊",
      reason: "Envio de áudio bloqueado."
    };
  }


  if (anti.sticker && isMediaSticker(message)) {
    return {
      type: "sticker",
      emoji: "🏷️",
      reason: "Envio de sticker bloqueado."
    };
  }


  return null;

}


module.exports = {
  detectViolation
};
