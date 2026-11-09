const { isAdmin } = require("../../services/permissionService");
const {
    loadSales,
    saveSales
} = require("../../services/salesService");

module.exports = {
    name: "limparcompras",
    aliases: ["limparvendas"],

    category: "admin-vendas",

    permission: "admin",

    description: "Limpar compras registradas neste grupo",

    run: async (sock, m, ctx) => {
        try {

            /* ==========================================
               PERMISSÃO
            ========================================== */

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

            /* ==========================================
               DATABASE
            ========================================== */

            const db = loadSales();

            if (!db.groups) {
                db.groups = {};
            }

            const groupId = ctx.chat;

            /*
             * Se o grupo ainda não existe,
             * não há nada para limpar.
             */

            const group = db.groups[groupId];

            if (!group) {
                return ctx.reply(
`┏━━ 🐻 URSINHO X BOT V2 • VENDAS

📭 NENHUMA COMPRA ENCONTRADA

Não existem dados de vendas
registrados neste grupo.

┗━━ 💎 Sistema de vendas`
                );
            }

            /* ==========================================
               GARANTIR ESTRUTURA
            ========================================== */

            if (!Array.isArray(group.orders)) {
                group.orders = [];
            }

            if (!Array.isArray(group.customers)) {
                group.customers = [];
            }

            /* ==========================================
               VERIFICAR SE EXISTEM DADOS
            ========================================== */

            const totalCompras = group.orders.length;
            const totalClientes = group.customers.length;

            if (
                totalCompras === 0 &&
                totalClientes === 0
            ) {
                return ctx.reply(
`┏━━ 🐻 URSINHO X BOT V2 • VENDAS

📭 NENHUMA COMPRA ENCONTRADA

Não existem compras registradas
neste grupo.

┗━━ 💎 Sistema de vendas`
                );
            }

            /* ==========================================
               LIMPAR SOMENTE ESTE GRUPO
            ========================================== */

            group.orders = [];
            group.customers = [];

            /* ==========================================
               GUARDAR
            ========================================== */

            saveSales(db);

            /* ==========================================
               CONFIRMAÇÃO
            ========================================== */

            return ctx.reply(
`┏━━ 🐻 URSINHO X BOT V2 • VENDAS

🧹 COMPRAS LIMPARAS

🗑️ Compras removidas:
${totalCompras}

👥 Clientes removidos:
${totalClientes}

📍 Grupo atual:
Os dados de vendas deste grupo
foram completamente limpos.

⚠️ Outros grupos não foram afetados.

┗━━ 💎 Limpeza concluída com sucesso`
            );

        } catch (e) {

            console.error(
                "[LIMPARCOMPRAS] Erro:",
                e
            );

            return ctx.reply(
                "❌ Erro ao limpar as compras deste grupo."
            );
        }
    }
};
