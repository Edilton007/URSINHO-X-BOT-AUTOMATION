const { isAdmin } = require("../../services/permissionService");

const {
    getVendaIATabela
} = require("../../services/salesService");

module.exports = {

    name: "tabela",

    aliases: [
        "precos",
        "preço",
        "precosvenda"
    ],

    category: "admin-vendas",

    permission: "admin",

    description: "Ver tabela de preços do grupo",

    run: async (
        sock,
        m,
        ctx
    ) => {

        try {

            /*
            ==================================================
            PERMISSÃO
            ==================================================
            */

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

            /*
            ==================================================
            CARREGAR TABELA
            ==================================================
            */

            const tabela =
                getVendaIATabela(
                    ctx.chat
                );

            /*
            ==================================================
            TABELA NÃO CONFIGURADA
            ==================================================
            */

            if (
                !tabela ||
                !String(tabela).trim()
            ) {

                return ctx.reply(
`╭━━━〔 📋 TABELA DE VENDAS 〕━━━╮
┃
┃ ⚠️ A tabela deste grupo
┃ ainda não está configurada.
┃
┃ Para configurar:
┃ ➜ ${ctx.prefix}vendatabela
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                );

            }

            /*
            ==================================================
            MOSTRAR TABELA ORIGINAL
            ==================================================

            A tabela já possui a sua própria formatação.
            Não adicionamos outra moldura nem "┃"
            em cada linha.
            ==================================================
            */

            return ctx.reply(
                String(tabela).trim()
            );

        } catch (error) {

            console.error(
                "tabela erro:",
                error
            );

            return ctx.reply(
                "❌ Erro ao carregar a tabela de vendas."
            );

        }

    }

};
