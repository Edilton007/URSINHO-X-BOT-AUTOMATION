const {
    isAdmin,
    isOwner
} = require("../../services/permissionService");

const {
    getGroup,
    updateGroup
} = require("../../services/groupService");

module.exports = {

    name: "addpalavrao",
    aliases: ["addpalavra"],
    category: "admin-protecao",
    permission: "admin",
    description: "Adicionar uma palavra própria à lista do Anti-Palavrão",

    run: async (sock, m, ctx) => {

        try {

            if (!ctx.isGroup) {
                return ctx.reply(
                    "❌ Este comando só funciona em grupos."
                );
            }

            const dono = isOwner(ctx.sender);
            const admin = await isAdmin(sock, ctx.chat, ctx.sender);

            if (!dono && !admin) {
                return ctx.reply(
                    "❌ Apenas administradores podem utilizar este comando."
                );
            }

            const palavra =
                (ctx.args || [])
                    .join(" ")
                    .trim()
                    .toLowerCase();

            if (!palavra) {

                return ctx.reply(
`❌ Escreve a palavra a adicionar.

Exemplo: ${ctx.prefix}addpalavrao xingamento`
                );
            }

            const group = getGroup(ctx.chat);
            const atual = group.anti?.customPalavroes || [];

            if (atual.includes(palavra)) {

                return ctx.reply(
                    `ℹ️ "${palavra}" já está na lista.`
                );
            }

            updateGroup(ctx.chat, {
                anti: {
                    ...(group.anti || {}),
                    customPalavroes: [
                        ...atual,
                        palavra
                    ]
                }
            });

            return ctx.reply(
                `✅ "${palavra}" adicionada à lista do Anti-Palavrão deste grupo.`
            );

        } catch (e) {

            console.log("Erro addpalavrao:", e);

            return ctx.reply(
                `❌ Não foi possível adicionar. ⚠️ ${e.message}`
            );
        }
    }

};
