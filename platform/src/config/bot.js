module.exports = {
  BOT_NAME: "URSINHO X BOT V2",
  OWNER_NUMBER: String(process.env.OWNER || "").replace(/\D/g, ""),
  PREFIX: ".",
  CHANNEL_URL: String(process.env.CHANNEL_URL || "https://whatsapp.com/channel/0029VbDAE4l8aKvLAgqTiw46").trim(),
  VERSION: "2.0.0",
  MODE: "public",
  IGNORE_OLD_MESSAGES: 15,
  DEBUG: false,
};
