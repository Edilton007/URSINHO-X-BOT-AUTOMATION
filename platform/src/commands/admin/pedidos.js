const { isAdmin } = require("../../services/permissionService");

const {
    getOrders
} = require("../../services/salesService");

function cleanNumber(value) {
    return String(value || "")
        .replace("@s.whatsapp.net", "")
        .replace("@lid", "")
        .replace(/\D/g, "");
}

function formatDate(value) {
    if (!value) {
        return "Data desconhecida";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Data desconhecida";
    }

    return date.toLocaleString("pt-PT", {
        timeZone: "Africa/Maputo"
    });
}

module.exports = {

    name: "pedidos",

    aliases: [
        "pedido"
    ],

    category: "admin-vendas",

    permission: "admin",

    description: "Ver pedidos e vendas do grupo",

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

            const orders =
                getOrders(ctx.chat) || [];

            if (!orders.length) {

                return ctx.reply(
`╭━━━〔 📦 PEDIDOS 〕━━━╮
┃
┃ ⚠️ Ainda não existem
┃ pedidos registados neste grupo.
┃
╰━━━〔 🐻 URSINHO X BOT 〕━━━╯`
                );

            }

            const recentes =
                [...orders]
                    .sort(
                        (a, b) =>
                            Number(b.date || 0) -
                            Number(a.date || 0)
                    )
                    .slice(0, 20);

            let texto =
`╭━━━〔 📦 PEDIDOS 〕━━━╮
┃
┃ 📊 Total: ${orders.length}
┃
`;

            const mentions = [];

            recentes.forEach(
                (order, index) => {

                    const numero =
                        cleanNumber(
                            order.user
                        );

                    const jid =
                        String(order.user || "")
                            .includes("@")
                            ? String(order.user)
                            : numero
                                ? `${numero}@s.whatsapp.net`
                                : null;

                    if (
                        jid &&
                        !mentions.includes(jid)
                    ) {
                        mentions.push(jid);
                    }

                    const cliente =
                        numero
                            ? `@${numero}`
                            : "Cliente desconhecido";

                    const produto =
                        order.product ||
                        (
                            Number(order.gb || 0)
                                ? `${Number(order.gb).toFixed(2)} GB`
                                : "Produto não informado"
                        );

                    const status =
                        String(
                            order.status ||
                            "desconhecido"
                        ).toLowerCase();

                    const statusTexto =
                        status === "confirmado"
                            ? "🟢 Confirmado"
                            : status === "cancelado"
                                ? "🔴 Cancelado"
                                : `🟡 ${order.status || "Pendente"}`;

                    texto +=
`┣━━━━━━━━━━━━━━━━━━━━
┃ #${index + 1}
┃ 👤 ${cliente}
┃ 📦 ${produto}
┃ 📌 ${statusTexto}
┃ 📅 ${formatDate(order.date)}
`;

                    if (order.by) {

                        const operador =
                            cleanNumber(
                                order.by
                            );

                        if (operador) {
                            texto +=
`┃ 👨‍💼 Operador: @${operador}
`;
                        }
                    }

                    texto += "┃\n";
                }
            );

            texto +=
`╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`;

            return sock.sendMessage(
                ctx.chat,
                {
                    text: texto,
                    mentions
                },
                {
                    quoted: m
                }
            );

        } catch (error) {

            console.error(
                "pedidos erro:",
                error
            );

            return ctx.reply(
                "❌ Erro ao carregar os pedidos."
            );
        }
    }
};
