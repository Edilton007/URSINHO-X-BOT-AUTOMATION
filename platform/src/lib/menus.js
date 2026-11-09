const { apply } = require("./fonts");
const { title } = require("./textStyle");

function header(user, cargo, prefix) {
    return `${title("MENU PRINCIPAL")}
👤 Usuário: ${user}
👑 Cargo: ${cargo}
⚡ Prefixo: ${prefix}
🐻 URSINHO X BOT V2

`;
}

function section(nome, comandos) {
    let texto = `┌─〔 ${nome} 〕\n`;

    for (const cmd of comandos) {
        texto += `│ ➲ ${cmd}\n`;
    }

    texto += `└──────────────\n`;

    return texto;
}


function menu(user, cargo, prefix) {

return header(user, cargo, prefix) +

section("🌐 GERAL", [
`${prefix}ping`,
`${prefix}info`,
`${prefix}perfil`,
`${prefix}status`
]) +

section("👑 DONO", [
`${prefix}on`,
`${prefix}off`,
`${prefix}reiniciar`,
`${prefix}painel`,
`${prefix}fonte`
]) +

section("🛡️ ADMINISTRAÇÃO", [
`${prefix}ban`,
`${prefix}mute`,
`${prefix}desmute`,
`${prefix}promover`,
`${prefix}despromover`,
`${prefix}abrir`,
`${prefix}fechar`,
`${prefix}antiflood`,
`${prefix}antilink`
]) +

section("💰 VENDAS", [
`${prefix}tabela`,
`${prefix}compra`,
`${prefix}clientes`,
`${prefix}vendas`,
`${prefix}estatisticas`
]) +

section("🤖 IA", [
`${prefix}ai`,
`${prefix}chat`
]) +

section("📥 DOWNLOADS", [
`${prefix}play`,
`${prefix}ytmp3`,
`${prefix}ytmp4`,
`${prefix}sticker`
]) +

section("🎮 JOGOS", [
`${prefix}daily`,
`${prefix}ranking`,
`${prefix}coins`
]);

}


function menuAdm(user, cargo, prefix) {
return header(user,cargo,prefix) +
section("🛡️ ADMIN",[
`${prefix}ban`,
`${prefix}mute`,
`${prefix}desmute`,
`${prefix}todos`,
`${prefix}abrir`,
`${prefix}fechar`,
`${prefix}antiflood`,
`${prefix}antilink`,
`${prefix}bemvindo`
]);
}


function menuDono(user,cargo,prefix) {
return header(user,cargo,prefix) +
section("👑 DONO SUPREMO",[
`${prefix}on`,
`${prefix}off`,
`${prefix}reiniciar`,
`${prefix}fonte`,
`${prefix}painel`
]);
}


module.exports = {
    menu,
    menuAdm,
    menuDono
};
