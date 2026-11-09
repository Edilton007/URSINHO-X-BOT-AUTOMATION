const { isAdmin } = require("../../services/permissionService");

const {
    getPayments,
    setPayment,
    removePayment
} = require("../../services/salesService");

/*
============================================================
NORMALIZAR TIPO
============================================================
*/
function normalizarTipo(value) {

    const tipo =
        String(value || "")
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

    if (tipo === "bim") {
        return "bim";
    }

    return null;
}

/*
============================================================
NOME DO TIPO
============================================================
*/
function nomeTipo(type) {

    return {
        mpesa: "M-Pesa",
        emola: "e-Mola",
        bim: "BIM"
    }[type] || type;
}

/*
============================================================
FORMATAR PAGAMENTO
============================================================
*/
function formatarPagamento(payment) {

    if (
        !payment ||
        !payment.number
    ) {
        return "❌ Não configurado";
    }

    return `${payment.number}${payment.name ? ` — ${payment.name}` : ""}`;
}

/*
============================================================
COMANDO
============================================================
*/
module.exports = {

    name: "editarpagamento",

    /*
     * Apenas um alias.
     * O alias duplicado foi removido.
     */

    aliases: [
        "editpagamento"
    ],

    category: "admin-vendas",

    permission: "admin",

    description: "Editar conta de pagamento",

    run: async (
        sock,
        m,
        ctx
    ) => {

        try {

            /*
            ==========================================
            PERMISSÃO
            ==========================================
            */

            const admin =
                await isAdmin(
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

            /*
            ==========================================
            EXTRAIR TEXTO
            ==========================================
            */

            const args =
                Array.isArray(ctx.args)
                    ? ctx.args
                    : [];

            /*
            ==========================================
            MOSTRAR CONFIGURAÇÕES
            ==========================================
            */

            if (!args[1]) {

                const payments =
                    getPayments(ctx.chat);

                return ctx.reply(
                    `╭━━━〔 ✏️ EDITAR PAGAMENTO 〕━━━╮
┃
┃ 🟢 M-Pesa
┃ ┗ ${formatarPagamento(payments?.mpesa)}
┃
┃ 🔵 e-Mola
┃ ┗ ${formatarPagamento(payments?.emola)}
┃
┃ 🏦 BIM
┃ ┗ ${formatarPagamento(payments?.bim)}
┃
┣━━━━━━━━━━━━━━━━━━━━
┃ Para editar:
┃
┃ .editarpagamento mpesa número nome
┃ .editarpagamento emola número nome
┃ .editarpagamento bim número nome
┃
┃ Para remover:
┃
┃ .editarpagamento remover mpesa
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                );
            }

            /*
            ==========================================
            REMOVER
            ==========================================
            */

            if (
                args[1].toLowerCase() ===
                "remover"
            ) {

                const tipo =
                    normalizarTipo(
                        args[2]
                    );

                if (!tipo) {

                    return ctx.reply(
                        `❌ Método inválido.

Use:
.editarpagamento remover mpesa
.editarpagamento remover emola
.editarpagamento remover bim`
                    );
                }

                removePayment(
                    ctx.chat,
                    tipo
                );

                return ctx.reply(
                    `╭━━━〔 ✏️ EDITAR PAGAMENTO 〕━━━╮
┃
┃ 🗑️ ${nomeTipo(tipo)}
┃
┃ A conta foi removida
┃ deste grupo.
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                );
            }

            /*
            ==========================================
            EDITAR MÉTODO
            ==========================================
            */

            const tipo =
                normalizarTipo(
                    args[1]
                );

            if (!tipo) {

                return ctx.reply(
                    `❌ Método de pagamento inválido.

Disponíveis:
mpesa
emola
bim`
                );
            }

            const numero =
                args[2] || "";

            if (!numero) {

                return ctx.reply(
                    `❌ Número não informado.

Exemplo:
.editarpagamento mpesa 841234567 MZ URSINHO`
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
                    "❌ Não foi possível editar o pagamento."
                );
            }

            return ctx.reply(
                `╭━━━〔 ✏️ EDITAR PAGAMENTO 〕━━━╮
┃
┃ ✅ ${nomeTipo(tipo)} atualizado
┃
┃ 📱 Número:
┃ ┗ ${payment.number}
┃
┃ 👤 Nome:
┃ ┗ ${payment.name || "Não informado"}
┃
┃ 🔒 Configuração exclusiva
┃    deste grupo.
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
            );

        } catch (error) {

            console.error(
                "editarpagamento erro:",
                error
            );

            return ctx.reply(
                "❌ Erro ao editar o pagamento."
            );
        }
    }
};
