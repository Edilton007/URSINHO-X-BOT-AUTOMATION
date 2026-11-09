const autoResponderDb = require("../../database/autoresponderDb");

const {
    isAdmin,
    isOwner
} = require("../../services/permissionService");

module.exports = {
    name: "addauto",

    aliases: [
        "add-auto-responder",
        "addautoresponder"
    ],

    category: "admin-grupo",

    permission: "admin",

    description: "Adicionar um termo ao auto-responder",

    run: async (sock, m, ctx) => {

        if (!ctx.isGroup) {
            return ctx.reply("❌ Este comando só funciona em grupos.");
        }

        const dono = isOwner(ctx.sender);
        const admin = await isAdmin(sock, ctx.chat, ctx.sender);

        if (!dono && !admin) {
            return ctx.reply(
                "❌ Apenas administradores podem usar este comando."
            );
        }

        // ctx.argsTexto mantém o texto EXATAMENTE como foi escrito
        // (quebras de linha, espaços duplos, listas) — ao contrário
        // de ctx.args.join(" "), que destruía toda a formatação.
        const fullArgs = typeof ctx.argsTexto === "string"
            ? ctx.argsTexto
            : ctx.args.join(" ");

        // Divide só no PRIMEIRO " / ": a resposta pode conter
        // outras barras (ex: "100 MT / mês") sem dar erro.
        const idxSep = fullArgs.indexOf(" / ");

        const partes = idxSep === -1
            ? [fullArgs]
            : [fullArgs.slice(0, idxSep), fullArgs.slice(idxSep + 3)];

        if (partes.length !== 2 || !partes[0].trim() || !partes[1].trim()) {
            return ctx.reply(
`❌ *Formato incorreto.*

Uso:
${ctx.prefix}addauto termo1, termo2 / resposta

Exemplo:
${ctx.prefix}addauto preço, preços, tabela / Os preços estão no menu 💳, digita *.tabela* pra ver!

_(podes colocar vários termos separados por vírgula — qualquer um deles ativa a mesma resposta)_`
            );
        }

        const termos = partes[0]
            .split(",")
            .map(t => t.trim())
            .filter(Boolean);

        const resposta = partes[1].trim();

        if (!termos.length) {
            return ctx.reply("❌ Precisas de indicar pelo menos um termo.");
        }

        const resultado = autoResponderDb.adicionar(
            ctx.chat, termos, resposta, ctx.sender
        );

        if (!resultado.sucesso) {
            return ctx.reply(`❌ ${resultado.motivo}`);
        }

        return ctx.reply(
`✅ *Auto-responder adicionado!*

🔑 Termos: ${termos.join(", ")}
💬 Resposta: ${resposta}

${autoResponderDb.isAtivo(ctx.chat) ? "" : "⚠️ Lembra-te de ativar com *" + ctx.prefix + "autoresponder on*"}`
        );
    }
};
