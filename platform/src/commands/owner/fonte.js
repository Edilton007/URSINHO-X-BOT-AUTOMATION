const { resolveName, listAll } = require("../../lib/fonts");
const config = require("../../config/bot");

module.exports = {

    name: "fonte",
    category: "owner",
    permission: "owner",
    description: "Alterar fonte do sistema",

    run: async (sock, m, ctx) => {

        const ownerNumber = config.OWNER_NUMBER;

        const sender = String(ctx.sender || "");

        // Compatibilidade com LID do dono atual
        const ownerLid = "132844076699658@lid";

        const isOwner =
            sender === ownerLid ||
            sender.includes(ownerNumber);

        if (!isOwner) {

            return ctx.reply(
                "❌ Apenas o dono pode alterar a fonte do sistema."
            );

        }

        const escolha = ctx.args[0];

        // Lista de fontes
        if (!escolha) {

            const lista = listAll()
                .map(f => `#${f.n} ${f.name} → ${f.sample}`)
                .join("\n");

            return ctx.reply(
`╔══════════════════════╗
║ 🔤 FONTES URSINHO X BOT
╚══════════════════════╝

${lista}

Use:

.fonte #número

Exemplo:
.fonte #5

Reset:
.fonte normal`
            );

        }

        // Restaurar fonte padrão
        if (
            escolha.toLowerCase() === "reset" ||
            escolha.toLowerCase() === "normal"
        ) {

            if (!ctx.isGroup) {
                return ctx.reply(
                    "❌ O comando .fonte deve ser usado dentro do grupo."
                );
            }

            const group = ctx.db.group(ctx.chat);

            group.font = "normal";

            ctx.db.save();

            return ctx.reply(
                "✅ Fonte deste grupo restaurada para normal."
            );

        }

        const fonte = resolveName(escolha);

        if (!fonte) {

            return ctx.reply(
                "❌ Fonte inválida.\n\nDigite .fonte para ver a lista."
            );

        }

        if (!ctx.isGroup) {

            return ctx.reply(
                "❌ O comando .fonte deve ser usado dentro do grupo."
            );

        }

        const group = ctx.db.group(ctx.chat);

        group.font = fonte;

        ctx.db.save();

        return ctx.reply(
            `✅ Fonte deste grupo alterada com sucesso!

🔤 Novo estilo:
${fonte}

🐻 URSINHO X BOT V2`
        );

    }

};
