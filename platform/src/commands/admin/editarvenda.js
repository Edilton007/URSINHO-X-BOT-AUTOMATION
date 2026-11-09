const { isAdmin } = require("../../services/permissionService");

const {
    getOrders,
    updateOrder,
    getCustomers,
    saveCustomer
} = require("../../services/salesService");

function parsePackage(value) {
    if (!value) return null;

    const input = String(value)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

    if (input.endsWith("mb")) {
        const mb = parseFloat(
            input.slice(0, -2)
        );

        if (!Number.isFinite(mb) || mb <= 0) {
            return null;
        }

        return {
            gb: mb / 1024,
            text: `${mb} MB`
        };
    }

    if (input.endsWith("gb")) {
        const gb = parseFloat(
            input.slice(0, -2)
        );

        if (!Number.isFinite(gb) || gb <= 0) {
            return null;
        }

        return {
            gb,
            text: `${gb} GB`
        };
    }

    const gb = parseFloat(input);

    if (
        Number.isFinite(gb) &&
        gb > 0
    ) {
        return {
            gb,
            text: `${gb} GB`
        };
    }

    return null;
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

function cleanNumber(value) {
    return String(value || "")
        .replace("@s.whatsapp.net", "")
        .replace("@lid", "")
        .replace(/\D/g, "");
}

module.exports = {

    name: "editarvenda",

    aliases: [
        "editvenda"
    ],

    category: "admin-vendas",

    permission: "admin",

    description: "Editar uma venda registada",

    run: async (
        sock,
        m,
        ctx
    ) => {

        try {

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

            const args =
                Array.isArray(ctx.args)
                    ? ctx.args
                    : [];

            /*
            ==========================================
            LISTAR VENDAS
            ==========================================
            */

            if (!args[1]) {

                const orders =
                    getOrders(ctx.chat) || [];

                if (!orders.length) {

                    return ctx.reply(
`╭━━━〔 ✏️ EDITAR VENDA 〕━━━╮
┃
┃ ⚠️ Não existem vendas
┃ registadas neste grupo.
┃
┃ Use:
┃ .compra 1gb
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                    );
                }

                const recentes =
                    [...orders]
                        .map(
                            (order, index) => ({
                                order,
                                index
                            })
                        )
                        .reverse()
                        .slice(0, 15);

                let lista =
`╭━━━〔 ✏️ EDITAR VENDA 〕━━━╮
┃
┃ Selecione uma venda:
┃
`;

                recentes.forEach(
                    item => {

                        const order =
                            item.order;

                        const numero =
                            cleanNumber(
                                order.user
                            );

                        const produto =
                            order.product ||
                            (
                                Number(order.gb || 0)
                                    ? `${Number(order.gb).toFixed(2)} GB`
                                    : "Sem produto"
                            );

                        const status =
                            order.status ||
                            "desconhecido";

                        lista +=
`┃ #${item.index + 1} • @${numero || "desconhecido"}
┃    📦 ${produto}
┃    📌 ${status}
┃    📅 ${formatDate(order.date)}
┃
`;
                    }
                );

                lista +=
`┣━━━━━━━━━━━━━━━━━━━━
┃ Exemplos:
┃
┃ .editarvenda 1
┃ .editarvenda 1 2gb
┃ .editarvenda 1 2gb confirmado
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`;

                const mentions =
                    recentes
                        .map(
                            item => {
                                const value =
                                    String(
                                        item.order.user || ""
                                    );

                                if (
                                    value.includes("@")
                                ) {
                                    return value;
                                }

                                const number =
                                    cleanNumber(value);

                                return number
                                    ? `${number}@s.whatsapp.net`
                                    : null;
                            }
                        )
                        .filter(Boolean);

                return sock.sendMessage(
                    ctx.chat,
                    {
                        text: lista,
                        mentions
                    },
                    {
                        quoted: m
                    }
                );
            }

            /*
            ==========================================
            ID DA VENDA
            ==========================================
            */

            const id =
                Number(
                    args[1]
                );

            if (
                !Number.isInteger(id) ||
                id < 1
            ) {

                return ctx.reply(
`❌ ID da venda inválido.

Use:

.editarvenda 1`
                );
            }

            const orders =
                getOrders(
                    ctx.chat
                ) || [];

            const index =
                id - 1;

            if (!orders[index]) {

                return ctx.reply(
`❌ Venda #${id} não encontrada.

Existem ${orders.length} venda(s) registadas.`
                );
            }

            const venda =
                orders[index];

            /*
            ==========================================
            SEM ALTERAÇÃO
            ==========================================
            */

            if (
                !args[2] &&
                !args[3]
            ) {

                const numero =
                    cleanNumber(
                        venda.user
                    );

                return ctx.reply(
`╭━━━〔 ✏️ VENDA #${id} 〕━━━╮
┃
┃ 👤 Cliente:
┃ ┗ @${numero || "desconhecido"}
┃
┃ 📦 Produto:
┃ ┗ ${venda.product || "Não informado"}
┃
┃ 🌐 Quantidade:
┃ ┗ ${Number(venda.gb || 0).toFixed(2)} GB
┃
┃ 📌 Status:
┃ ┗ ${venda.status || "desconhecido"}
┃
┃ 📅 Data:
┃ ┗ ${formatDate(venda.date)}
┃
┣━━━━━━━━━━━━━━━━━━━━
┃ Para alterar:
┃
┃ .editarvenda ${id} 2gb
┃ .editarvenda ${id} 2gb confirmado
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`
                );
            }

            /*
            ==========================================
            NOVA QUANTIDADE
            ==========================================
            */

            const pacote =
                parsePackage(
                    args[2]
                );

            if (!pacote) {

                return ctx.reply(
`❌ Quantidade inválida.

Exemplos:

.editarvenda ${id} 2gb
.editarvenda ${id} 500mb
.editarvenda ${id} 0.5gb`
                );
            }

            /*
            ==========================================
            NOVO STATUS
            ==========================================
            */

            let novoStatus =
                venda.status ||
                "confirmado";

            if (args[3]) {

                novoStatus =
                    String(args[3])
                        .toLowerCase();

                const statusValidos = [
                    "confirmado",
                    "pendente",
                    "cancelado"
                ];

                if (
                    !statusValidos.includes(
                        novoStatus
                    )
                ) {

                    return ctx.reply(
`❌ Status inválido.

Status disponíveis:

confirmado
pendente
cancelado`
                    );
                }
            }

            /*
            ==========================================
            ATUALIZAR VENDA
            ==========================================
            */

            const antigaGB =
                Number(
                    venda.gb || 0
                );

            venda.gb =
                pacote.gb;

            venda.product =
                `${pacote.gb.toFixed(2)}GB`;

            venda.status =
                novoStatus;

            venda.updatedAt =
                Date.now();

            /*
            ==========================================
            IMPORTANTE
            ==========================================
            
            getOrders() devolve os objetos
            armazenados no grupo.

            Como saveOrder() adiciona
            uma nova venda, não o usamos
            para atualizar esta venda.
            
            Para preservar o banco atual,
            precisamos atualizar o registro
            diretamente no arquivo através
            do serviço existente.
            ==========================================
            */

            const updatedOrder =
                updateOrder(
                    ctx.chat,
                    index,
                    {
                        gb: venda.gb,
                        product: venda.product,
                        status: venda.status,
                        updatedAt: venda.updatedAt
                    }
                );

            if (!updatedOrder) {
                return ctx.reply(
                    "❌ Não foi possível atualizar a venda no banco."
                );
            }

            /*
            ==========================================
            ATUALIZAR DADOS DO CLIENTE
            ==========================================
            */

            const customers =
                getCustomers(
                    ctx.chat
                ) || [];

            const cliente =
                customers.find(
                    customer =>
                        String(customer.number) ===
                        String(venda.user)
                );

            if (cliente) {

                const diferenca =
                    venda.gb -
                    antigaGB;

                cliente.totalGB =
                    Number(
                        cliente.totalGB || 0
                    ) + diferenca;

                if (cliente.totalGB < 0) {
                    cliente.totalGB = 0;
                }

                saveCustomer(
                    ctx.chat,
                    cliente
                );
            }


            /*
            ==========================================
            RESPOSTA
            ==========================================
            */

            const numero =
                cleanNumber(
                    venda.user
                );

            const mentions =
                numero
                    ? [
                        String(
                            venda.user || ""
                        ).includes("@")
                            ? String(venda.user)
                            : `${numero}@s.whatsapp.net`
                    ]
                    : [];

            return sock.sendMessage(
                ctx.chat,
                {
                    text:
`╭━━━〔 ✏️ VENDA EDITADA 〕━━━╮
┃
┃ #${id}
┃
┃ 👤 Cliente:
┃ ┗ @${numero || "desconhecido"}
┃
┃ 📦 Antes:
┃ ┗ ${antigaGB.toFixed(2)} GB
┃
┃ 📦 Agora:
┃ ┗ ${venda.gb.toFixed(2)} GB
┃
┃ 📌 Status:
┃ ┗ ${venda.status}
┃
┃ 📅 Atualizado:
┃ ┗ ${formatDate(venda.updatedAt)}
┃
╰━━━〔 🐻 URSINHO X BOT V2 〕━━━╯`,
                    mentions
                },
                {
                    quoted: m
                }
            );

        } catch (error) {

            console.error(
                "editarvenda erro:",
                error
            );

            return ctx.reply(
                "❌ Erro ao editar a venda."
            );
        }
    }
};
