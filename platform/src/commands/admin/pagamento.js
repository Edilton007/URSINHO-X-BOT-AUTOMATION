const { isAdmin } = require("../../services/permissionService");

const {
    getPayments,
    setPayment,
    removePayment
} = require("../../services/salesService");

function normalizarTipo(value) {
    const tipo = String(value || "")
        .trim()
        .toLowerCase();

    if (
        tipo === "mpesa" ||
        tipo === "m-pesa"
    ) {
        return "mpesa";
    }

    if (
        tipo === "emola" ||
        tipo === "e-mola" ||
        tipo === "mola"
    ) {
        return "emola";
    }

    if (
        tipo === "bim"
    ) {
        return "bim";
    }

    return null;
}

function nomeTipo(type) {
    return {
        mpesa: "M-Pesa",
        emola: "e-Mola",
        bim: "BIM"
    }[type] || type;
}

module.exports = {

    name: "pagamento",

    aliases: [
        "pagamentos"
    ],

    category: "admin-vendas",

    permission: "admin",

    description: "Gestão das contas de pagamento",

    run: async (
        sock,
        m,
        ctx
    ) => {

        try {

            const admin = await isAdmin(
                sock,
                ctx.chat,
                ctx.sender
            );

            if (
                !admin &&
                ctx.permission !== "owner"
            ) {
                return ctx.reply(
                    "❌ Apenas administradores podem usar este comando."
                );
            }

            const args =
                Array.isArray(ctx.args)
                    ? ctx.args
                    : [];

            const acao =
                String(args[0] || "")
                    .toLowerCase();

            /*
            ==========================================
            SEM ARGUMENTO
            ==========================================
            */

            if (!acao) {

                const payments =
                    getPayments(ctx.chat);

                const mpesa =
                    payments?.mpesa || {};

                const emola =
                    payments?.emola || {};

                const bim =
                    payments?.bim || {};

                const formatar =
                    payment =>
                        payment?.number
                            ? `${payment.number}${payment.name ? ` — ${payment.name}` : ""}`
                            : "❌ Não configurado";

                return ctx.reply(
`╭━━━〔 💳 PAGAMENTOS 〕━━━╮
┃
┃ 🟢 M-Pesa
┃ ┗ ${formatar(mpesa)}
┃
┃ 🔵 e-Mola
┃ ┗ ${formatar(emola)}
┃
┃ 🏦 BIM
┃ ┗ ${formatar(bim)}
┃
┣━━━━━━━━━━━━━━━━━━━━
┃ Comandos:
┃
┃ .pagamento mpesa número nome
┃ .pagamento emola número nome
┃ .pagamento bim número nome
┃
┃ .pagamento remover mpesa
┃ .pagamento remover emola
┃ .pagamento remover bim
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                );
            }

            /*
            ==========================================
            REMOVER
            ==========================================
            */

            if (acao === "remover") {

                const tipo =
                    normalizarTipo(
                        args[2]
                    );

                if (!tipo) {

                    return ctx.reply(
`❌ Método inválido.

Use:
.pagamento remover mpesa
.pagamento remover emola
.pagamento remover bim`
                    );
                }

                removePayment(
                    ctx.chat,
                    tipo
                );

                return ctx.reply(
`╭━━━〔 💳 PAGAMENTO 〕━━━╮
┃
┃ 🗑️ ${nomeTipo(tipo)} removido.
┃
┃ O método de pagamento
┃ deixou de estar configurado
┃ neste grupo.
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                );
            }

            /*
            ==========================================
            CONFIGURAR
            ==========================================
            */

            const tipo =
                normalizarTipo(
                    acao
                );

            if (!tipo) {

                return ctx.reply(
`❌ Método de pagamento inválido.

Métodos disponíveis:
• mpesa
• emola
• bim`
                );
            }

            const numero =
                args[2] || "";

            if (!numero) {

                return ctx.reply(
`❌ Número não informado.

Exemplo:

.pagamento mpesa 841234567 MZ URSINHO`
                );
            }

            const nome =
                args
                    .slice(3)
                    .join(" ")
                    .trim();

            const payment =
                setPayment(
                    ctx.chat,
                    tipo,
                    numero,
                    nome
                );

            if (!payment) {

                return ctx.reply(
                    "❌ Não foi possível configurar o pagamento."
                );
            }

            return ctx.reply(
`╭━━━〔 💳 PAGAMENTO 〕━━━╮
┃
┃ ✅ ${nomeTipo(tipo)} configurado
┃
┃ 📱 Número:
┃ ┗ ${payment.number}
┃
┃ 👤 Nome:
┃ ┗ ${payment.name || "Não informado"}
┃
┃ 📌 Grupo:
┃ ┗ Configuração exclusiva
┃    deste grupo.
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
            );

        } catch (error) {

            console.error(
                "pagamento erro:",
                error
            );

            return ctx.reply(
                "❌ Erro ao configurar os pagamentos."
            );
        }
    }
};
