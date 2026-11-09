const { isAdmin } = require("../../services/permissionService");

const {
getOrders,
getCustomers
} = require("../../services/salesService");

/*

COMPRAS DE HOJE

*/
function getTodayOrders(orders = []) {

const today = new Date();

return orders.filter(order => {

    const date =
        new Date(order.date);

    return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
    );
});

}

/*

TOP CLIENTE POR GB

*/
function getTopCustomer(customers = []) {

if (!customers.length) {
    return null;
}

return [...customers]
    .sort(
        (a, b) =>
            Number(b.totalGB || 0) -
            Number(a.totalGB || 0)
    )[0];

}

/*

TOP CLIENTE POR COMPRAS

*/
function getTopBuyer(customers = []) {

if (!customers.length) {
    return null;
}

return [...customers]
    .sort(
        (a, b) =>
            Number(b.compras || 0) -
            Number(a.compras || 0)
    )[0];

}

/*

FORMATAR NÚMERO

*/
function formatNumber(number) {

return Number(
    number || 0
).toFixed(2);

}

/*

JID DO CLIENTE

*/
function getCustomerJid(number) {

if (!number) {
    return null;
}

const value =
    String(number);

if (value.includes("@")) {
    return value;
}

return `${value.replace(/\D/g, "")}@s.whatsapp.net`;

}

/*

COMANDO ESTATISTICAS

*/
module.exports = {

name: "estatisticas",

category: "admin-vendas",

permission: "admin",

description: "Estatísticas de vendas",

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
        DADOS SOMENTE DO GRUPO ATUAL
        ==========================================
        */

        const groupId =
            ctx.chat;

        const customers =
            getCustomers(groupId);

        const orders =
            getOrders(groupId);

        /*
        ==========================================
        ESTATÍSTICAS GERAIS
        ==========================================
        */

        const totalCompras =
            orders.length;

        const totalClientes =
            customers.filter(
                customer =>
                    Number(
                        customer.compras || 0
                    ) > 0
            ).length;

        const totalGB =
            customers.reduce(
                (
                    total,
                    customer
                ) =>
                    total +
                    Number(
                        customer.totalGB || 0
                    ),
                0
            );

        /*
        ==========================================
        ESTATÍSTICAS DE HOJE
        ==========================================
        */

        const ordersToday =
            getTodayOrders(
                orders
            );

        const comprasHoje =
            ordersToday.length;

        const gbHoje =
            ordersToday.reduce(
                (
                    total,
                    order
                ) =>
                    total +
                    Number(
                        order.gb || 0
                    ),
                0
            );

        /*
        ==========================================
        MÉDIA POR COMPRA
        ==========================================
        */

        const mediaGB =
            totalCompras > 0
                ? totalGB / totalCompras
                : 0;

        /*
        ==========================================
        TOP CLIENTES
        ==========================================
        */

        const topCustomer =
            getTopCustomer(
                customers
            );

        const topBuyer =
            getTopBuyer(
                customers
            );

        /*
        ==========================================
        DATA / HORA
        ==========================================
        */

        const agora =
            new Date();

        const data =
            agora.toLocaleDateString();

        const hora =
            agora.toLocaleTimeString();

        /*
        ==========================================
        TOP CLIENTE
        ==========================================
        */

        let topCustomerJid =
            null;

        let topCustomerText =
            "Nenhum cliente registado";

        if (topCustomer) {

            topCustomerJid =
                getCustomerJid(
                    topCustomer.number
                );

            topCustomerText =
                `@${String(
                    topCustomer.number
                )
                    .replace(/\D/g, "")}`;
        }

        /*
        ==========================================
        TOP COMPRADOR
        ==========================================
        */

        let topBuyerJid =
            null;

        let topBuyerText =
            "Nenhum cliente registado";

        if (topBuyer) {

            topBuyerJid =
                getCustomerJid(
                    topBuyer.number
                );

            topBuyerText =
                `@${String(
                    topBuyer.number
                )
                    .replace(/\D/g, "")}`;
        }

        /*
        ==========================================
        RELATÓRIO
        ==========================================
        */

        const relatorio =

`┏━━ 🐻 URSINHO X BOT V2 • VENDAS

📊 ESTATÍSTICAS DE VENDAS
🛒 Total de compras:
${totalCompras}
👥 Clientes registados:
${totalClientes}
🌐 Total vendido:
${formatNumber(totalGB)} GB

📈 DESEMPENHO DE HOJE
🛒 Compras hoje:
${comprasHoje}
🌐 Vendido hoje:
${formatNumber(gbHoje)} GB

📊 MÉDIA POR COMPRA
🌐 ${formatNumber(mediaGB)} GB

🏆 TOP CLIENTE
👤 ${topCustomerText}
🛒 Compras:
${topCustomer?.compras || 0}

🌐 Total adquirido:
${formatNumber(
topCustomer?.totalGB || 0
)} GB

🥇 CLIENTE COM MAIS COMPRAS
👤 ${topBuyerText}
🛒 Compras:
${topBuyer?.compras || 0}

📅 Última atualização:
${data} • ${hora}
┗━━ 💎 Relatório administrativo`;

        /*
        ==========================================
        MONTAR MENÇÕES
        ==========================================
        */

        const mentions = [];

        if (topCustomerJid) {

            mentions.push(
                topCustomerJid
            );
        }

        if (
            topBuyerJid &&
            topBuyerJid !== topCustomerJid
        ) {

            mentions.push(
                topBuyerJid
            );
        }

        /*
        ==========================================
        ENVIAR PARA O PRIVADO DO ADMIN
        ==========================================
        */

        await sock.sendMessage(
            ctx.sender,
            {
                text: relatorio,
                mentions
            }
        );

        /*
        ==========================================
        AVISO NO GRUPO
        ==========================================
        */

        return sock.sendMessage(
            ctx.chat,
            {
                text:
                    "📊 Estatísticas enviadas para o seu privado chefe🫡."
            },
            {
                quoted: m
            }
        );

    } catch (e) {

        console.log(
            "estatisticas erro:",
            e
        );

        return ctx.reply(
            "❌ Erro ao gerar estatísticas."
        );
    }
}

};
