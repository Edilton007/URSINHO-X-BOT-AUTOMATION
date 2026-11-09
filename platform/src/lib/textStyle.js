const db = require("../database/database");
const { apply } = require("./fonts");

const BOT_NAME = "URSINHO X BOT V2";

/**
 * Aplica a fonte atualmente selecionada pelo dono.
 */
function styled(text, fontOverride = null) {
    if (text === null || text === undefined) return text;

    const font =
        fontOverride ||
        "serif";

    return apply(String(text), font);
}

/**
 * Formata qualquer texto enviado pelo bot.
 *
 * A ideia é centralizar a aplicação da fonte para que
 * comandos e serviços não precisem chamar styled()
 * manualmente.
 */
function styleBotText(text, fontOverride = null) {
    if (text === null || text === undefined) return text;
    return styled(String(text), fontOverride);
}

function title(text) {
    return `╔══════════════════════════╗
║   🤖 ${styled(BOT_NAME)} 🤖
╚══════════════════════════╝
『 ${styled(text)} 』
`;
}

function box(text) {
    return `
╭━━━〔 ${styled(text)} 〕━━━╮
┃
╰━━━━━━━━━━━━━━━━━━╯
`;
}

module.exports = {
    title,
    box,
    styled,
    styleBotText
};
