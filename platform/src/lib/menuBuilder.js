const { title, styled } = require("./textStyle");

function buildMenu(user, cargo, prefix) {

return `${title("MENU PRINCIPAL")}

👤 ${styled("Usuário")}: ${user}
👑 ${styled("Cargo")}: ${cargo}
⚡ ${styled("Prefixo")}: ${prefix}


┌─〔 👑 ${styled("OWNER")} 〕
│
├ ➲ ${prefix}on
├ ➲ ${prefix}off
├ ➲ ${prefix}painel
│
└──────────────


┌─〔 🛡️ ${styled("ADMIN")} 〕
│
├ ➲ ${prefix}ban
├ ➲ ${prefix}mute
├ ➲ ${prefix}desmute
├ ➲ ${prefix}abrir
├ ➲ ${prefix}fechar
├ ➲ ${prefix}antiflood
├ ➲ ${prefix}antilink
│
└──────────────


┌─〔 🤖 ${styled("IA SYSTEM")} 〕
│
├ ➲ ${prefix}ai
├ ➲ ${prefix}chat
│
└──────────────


🐻 ${styled("URSINHO X BOT V2")}
`;

}


module.exports = {
    buildMenu
};
