const { removePayment } = require("../../services/salesService");

module.exports = {
    name: "delconta",
    aliases: ["removerconta"],
    category: "admin-vendas",
    permission: "admin",
    description: "Remover conta de pagamento",

    run: async (sock, m, ctx) => {
        try {

            if (!ctx.isGroup) {
                return ctx.reply(
`╔══════════════════════╗
║ ❌ DELCONTA
╚══════════════════════╝

Este comando só funciona em grupos.

🐻 URSINHO X BOT V2`
                );
            }

            if (
                ctx.permission !== "admin" &&
                ctx.permission !== "owner"
            ) {
                return ctx.reply(
`╔══════════════════════╗
║ ❌ SEM PERMISSÃO
╚══════════════════════╝

Apenas administradores podem utilizar este comando.

🐻 URSINHO X BOT V2`
                );
            }

            const option = String(ctx.args?.[0] || "")
                .toLowerCase()
                .trim();

            if (!option) {
                return ctx.reply(
`╔══════════════════════╗
║ 🗑️ REMOVER CONTA
╚══════════════════════╝

Escolha a conta que deseja remover:

.delconta mpesa
.delconta emola
.delconta bim

🐻 URSINHO X BOT V2`
                );
            }

            if (!["mpesa", "emola", "bim"].includes(option)) {
                return ctx.reply(
`╔══════════════════════╗
║ ⚠️ OPÇÃO INVÁLIDA
╚══════════════════════╝

Conta não reconhecida.

Escolha uma destas opções:

.delconta mpesa
.delconta emola
.delconta bim

🐻 URSINHO X BOT V2`
                );
            }

            const result = removePayment(
                ctx.chat,
                option
            );

            if (!result) {
                return ctx.reply(
`╔══════════════════════╗
║ ❌ ERRO
╚══════════════════════╝

Não foi possível remover a conta ${option.toUpperCase()}.

🐻 URSINHO X BOT V2`
                );
            }

            const nomes = {
                mpesa: "M-Pesa",
                emola: "eMola",
                bim: "BIM"
            };

            return ctx.reply(
`╔══════════════════════╗
║ ✅ CONTA REMOVIDA
╚══════════════════════╝

🏦 Conta:
${nomes[option]}

🗑️ Número e nome associados foram removidos.

👮 Administrador:
@${ctx.sender.split("@")[0]}

🐻 URSINHO X BOT V2`,
                {
                    mentions: [ctx.sender]
                }
            );

        } catch (error) {

            console.error(
                "[DELCONTA] Erro:",
                error.message
            );

            return ctx.reply(
`╔══════════════════════╗
║ ❌ ERRO
╚══════════════════════╝

Não foi possível remover a conta.

⚠️ ${error.message}

🐻 URSINHO X BOT V2`
            );
        }
    }
};
