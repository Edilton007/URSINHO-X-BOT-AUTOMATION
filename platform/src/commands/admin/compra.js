const { isAdmin } = require("../../services/permissionService");

const {
    getOrders,
    saveOrder,
    getCustomers,
    saveCustomer,
    isSalesEnabled,
    getPendingPayments,
    removePendingPayment
} = require("../../services/salesService");

const automationBridge = require("../../services/automationBridgeService");

/*
==================================================
CONVERTER PACOTE PARA GB
==================================================
*/

function parsePackage(input) {
    if (!input) {
        return null;
    }

    let value = String(input)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

    /*
    ==========================================
    MB
    ==========================================
    */

    if (value.endsWith("mb")) {
        const mb = parseFloat(
            value.slice(0, -2)
        );

        if (!Number.isFinite(mb) || mb <= 0) {
            return null;
        }

        return {
            gb: mb / 1024,
            original: `${mb} MB`,
            mb,
            unit: "MB"
        };
    }

    /*
    ==========================================
    GB
    ==========================================
    */

    if (value.endsWith("gb")) {
        const gb = parseFloat(
            value.slice(0, -2)
        );

        if (!Number.isFinite(gb) || gb <= 0) {
            return null;
        }

        return {
            gb,
            original: `${gb} GB`,
            mb: gb * 1024,
            unit: "GB"
        };
    }

    /*
    ==========================================
    NÚMERO SEM UNIDADE
    Ex:
    .compra 1
    .compra 0.5

    Será considerado GB.
    ==========================================
    */

    const number = parseFloat(value);

    if (Number.isFinite(number) && number > 0) {
        return {
            gb: number,
            original: `${number} GB`,
            mb: number * 1024,
            unit: "GB"
        };
    }

    return null;
}

/*
==================================================
CLIENTES DO GRUPO
==================================================
*/

function getGroupCustomers(orders, groupId) {
    const numbers = new Set();

    for (const order of orders || []) {
        if (
            order.group === groupId &&
            order.user &&
            order.status !== "cancelado"
        ) {
            numbers.add(
                String(order.user)
            );
        }
    }

    return [...numbers];
}

/*
==================================================
ESTATÍSTICAS DO CLIENTE
==================================================
*/

function getCustomerGroupStats(
    orders,
    groupId,
    number
) {
    const customerOrders = (orders || [])
        .filter(order =>
            order.group === groupId &&
            String(order.user) === String(number) &&
            order.status !== "cancelado"
        );

    let totalGB = 0;

    for (const order of customerOrders) {
        totalGB += Number(
            order.gb || 0
        );
    }

    return {
        compras: customerOrders.length,
        totalGB,
        orders: customerOrders
    };
}

/*
==================================================
RANKING DO GRUPO
==================================================
*/

function getRanking(
    orders,
    groupId,
    number
) {
    const numbers = getGroupCustomers(
        orders,
        groupId
    );

    const ranking = numbers
        .map(user => {
            const stats =
                getCustomerGroupStats(
                    orders,
                    groupId,
                    user
                );

            return {
                number: user,
                totalGB: stats.totalGB,
                compras: stats.compras
            };
        })
        .sort(
            (a, b) =>
                b.totalGB - a.totalGB
        );

    const position =
        ranking.findIndex(
            item =>
                String(item.number) ===
                String(number)
        );

    if (position === -1) {
        return 0;
    }

    return position + 1;
}

/*
==================================================
COMPRAS DE HOJE
==================================================
*/

function getToday(orders = []) {
    const today =
        new Date().toDateString();

    return orders.filter(order => {
        if (!order.date) {
            return false;
        }

        const date =
            new Date(order.date);

        return (
            date.toDateString() === today
        );
    });
}

/*
==================================================
COMANDO .COMPRA
==================================================
*/

module.exports = {

    name: "compra",

    aliases: [
        "comprar"
    ],

    category: "admin-vendas",

    permission: "admin",

    description:
        "Registar compra de cliente",

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
            SISTEMA DE VENDAS ATIVO?
            ==========================================
            */

            if (
                !isSalesEnabled(
                    ctx.chat
                )
            ) {
                return ctx.reply(
`╭━━━〔 🐻 URSINHO X BOT 〕━━━╮
┃
┃ 🔒 VENDAS DESATIVADAS
┃
┃ Um administrador precisa
┃ ativar o sistema com:
┃
┃ ➜ .compras on
┃
╰━━━━━━━━━━━━━━━━━━━━━━━╯`
                );
            }

            /*
            ==========================================
            TEXTO DO COMANDO
            ==========================================
            */

            const args =
                Array.isArray(ctx.args)
                    ? ctx.args
                    : [];

            /*
            ==========================================
            CLIENTE DA MENSAGEM RESPONDIDA
            ==========================================
            */

            const cliente =
                ctx.m?.message
                    ?.extendedTextMessage
                    ?.contextInfo
                    ?.participant;

            if (!cliente) {
                return ctx.reply(
`❌ Cliente não identificado.

Responda à mensagem do cliente e use:

.compra 1gb
.compra 500mb`
                );
            }

            /*
            ==========================================
            QUANTIDADE
            ==========================================
            */

            const pacote =
                args[0];

            const pacoteInfo =
                parsePackage(
                    pacote
                );

            if (!pacoteInfo) {
                return ctx.reply(
`❌ Quantidade inválida.

Exemplos:

.compra 1gb
.compra 500mb
.compra 105mb
.compra 0.5gb`
                );
            }

            const gb =
                pacoteInfo.gb;

            /*
            ==========================================
            JID DO CLIENTE
            ==========================================
            
            IMPORTANTE:
            Mantemos o JID original para a
            menção funcionar corretamente.

            Não transformamos @lid em número.
            ==========================================
            */

            console.log("===== DEBUG COMPRA =====");
            console.log("cliente:", cliente);
            console.log("clienteJid:", String(cliente));
            console.log("ctx.pushName:", ctx.pushName);
            console.log("groupId:", ctx.chat);

            const clienteJid =
                String(cliente);

            /*
            ==========================================
            NÚMERO PARA EXIBIÇÃO / BANCO
            ==========================================
            */

            let numero =
                clienteJid
                    .replace(
                        "@s.whatsapp.net",
                        ""
                    )
                    .replace(
                        "@lid",
                        ""
                    );

            /*
            ==========================================
            GRUPO ATUAL
            ==========================================
            */

            const groupId =
                ctx.chat;

            /*
            ==========================================
            PAGAMENTO PENDENTE DO CLIENTE
            ==========================================
            * Procuramos somente um pagamento que:
            *
            * 1. pertence ao grupo atual
            * 2. pertence ao cliente respondido
            * 3. já recebeu o número para receber
            *
            * Se não existir, a compra manual continua
            * funcionando normalmente.
            ==========================================
            */

            const pendingPayments =
                getPendingPayments(groupId);

            const clientePendings =
                pendingPayments
                    .filter(
                        payment =>
                            String(payment.sender) === String(cliente) &&
                            payment.status === "numero_recebido" &&
                            payment.recipientNumber
                    )
                    .sort(
                        (a, b) =>
                            Number(a.createdAt || a.updatedAt || 0) -
                            Number(b.createdAt || b.updatedAt || 0)
                    );

            const pendingPayment =
                clientePendings[0] || null;

            const grupoComAutomation =
                automationBridge.isAutomationEnabledForGroup(groupId);

            if (grupoComAutomation && !pendingPayment) {
                return ctx.reply(
                    `❌ Este grupo está ligado ao URSINHO X AUTOMATION, mas não existe um pagamento pendente com número de destino para este cliente.

A compra não foi registada nem será anunciada como entregue. Verifica o comprovativo e o número enviado pelo cliente.`
                );
            }

            /*
            ==========================================
            CARREGAR DADOS DO GRUPO
            ==========================================
            */

            /*
            ==========================================
            NÚMERO FINAL DA COMPRA
            ==========================================
            * Se houver pagamento pendente com número
            * recebido, esse será o número da compra.
            *
            * Sem pagamento pendente, mantém o número
            * original da mensagem respondida.
            ==========================================
            */

            if (
                pendingPayment &&
                pendingPayment.recipientNumber
            ) {
                numero =
                    String(
                        pendingPayment.recipientNumber
                    ).replace(/\D/g, "");
            }

            let automationOperation = null;

            if (grupoComAutomation && pendingPayment) {
                const quantidadeMB = Number(pacoteInfo.mb);
                if (!Number.isInteger(quantidadeMB)) {
                    return ctx.reply("❌ Este pacote não corresponde a uma quantidade inteira de MB. Usa, por exemplo, 100mb, 500mb, 1gb ou 1.5gb.");
                }

                const resultadoAutomation = automationBridge.criarTransferenciaAprovada({
                    groupId,
                    customerJid: clienteJid,
                    recipientNumber: numero,
                    paymentReference: pendingPayment.reference,
                    paymentOperator: pendingPayment.operator,
                    megas: quantidadeMB,
                    pacote: pacoteInfo.original,
                    approvedBy: ctx.sender
                });

                if (resultadoAutomation.error) {
                    return ctx.reply(
                        `❌ A transferência não foi enviada ao Backend.\n\n${resultadoAutomation.error}\n\nO pagamento permanece pendente. Nenhuma entrega foi anunciada.`
                    );
                }

                automationOperation = resultadoAutomation.operation;

                const pedidoJaRegistado = getOrders(groupId).find(order =>
                    order.operationId === automationOperation.id
                );
                if (pedidoJaRegistado) {
                    removePendingPayment(groupId, pendingPayment.sender, pendingPayment.reference);
                    return ctx.reply(
                        `⚠️ Este pagamento já está associado à operação ${automationOperation.id}. Não foi criado outro pedido.`
                    );
                }
            }

            const orders =
                getOrders(
                    groupId
                );

            const customers =
                getCustomers(
                    groupId
                );

            /*
            ==========================================
            HISTÓRICO DO CLIENTE
            ==========================================
            */

            const groupOrders =
                orders.filter(order =>
                    order.group === groupId &&
                    String(order.user) ===
                        String(numero) &&
                    order.status !==
                        "cancelado"
                );

            /*
            ==========================================
            ESTATÍSTICAS ANTES DA COMPRA
            ==========================================
            */

            const comprasAntes =
                groupOrders.length;

            const totalAntes =
                groupOrders.reduce(
                    (
                        total,
                        order
                    ) => {
                        return (
                            total +
                            Number(
                                order.gb || 0
                            )
                        );
                    },
                    0
                );

            /*
            ==========================================
            NOVOS TOTAIS
            ==========================================
            */

            const novasCompras =
                comprasAntes + 1;

            const novoTotal =
                totalAntes + gb;

            /*
            ==========================================
            REGISTRAR PEDIDO
            ==========================================
            */

            const agora =
                Date.now();

            const order = {
                user: numero,

                product:
                    `${gb.toFixed(2)}GB`,

                gb,

                status:
                    automationOperation ? "em_processamento" : "confirmado",

                operationId:
                    automationOperation?.id || null,

                automationState:
                    automationOperation?.estado || null,

                paymentReference:
                    pendingPayment?.reference || null,

                deliveryStatus:
                    automationOperation ? "aguardando_backend" : "entregue",

                date:
                    agora,

                by:
                    ctx.sender,

                group:
                    groupId
            };

            saveOrder(
                groupId,
                order
            );

            /*
            ==========================================
            CLIENTE
            ==========================================
            */

            let customer =
                customers.find(
                    c =>
                        String(c.number) ===
                        String(numero)
                );

            if (!customer) {

                customer = {
                    number:
                        numero,

                    compras:
                        0,

                    totalGB:
                        0,

                    history:
                        []
                };
            }

            if (
                !Array.isArray(
                    customer.history
                )
            ) {
                customer.history = [];
            }

            /*
            ==========================================
            ATUALIZAR CLIENTE
            ==========================================
            */

            customer.compras =
                Number(
                    customer.compras || 0
                ) + 1;

            customer.totalGB =
                Number(
                    customer.totalGB || 0
                ) + gb;

            /*
            ==========================================
            HISTÓRICO
            ==========================================
            */

            customer.history.push({
                gb,

                date:
                    agora,

                by:
                    ctx.sender,

                group:
                    groupId
            });

            saveCustomer(
                groupId,
                customer
            );

            /*
            ==========================================
            FINALIZAR PAGAMENTO PENDENTE
            ==========================================
            * Só removemos o pagamento depois de:
            *
            * 1. saveOrder()
            * 2. saveCustomer()
            *
            * Assim o comprovativo não fica pendente
            * depois que o ADM confirma a compra.
            ==========================================
            */

            if (pendingPayment) {
                removePendingPayment(
                    groupId,
                    pendingPayment.sender,
                    pendingPayment.reference
                );
            }

            /*
            ==========================================
            PEDIDOS ATUALIZADOS
            ==========================================
            */

            const updatedOrders =
                getOrders(
                    groupId
                );

            /*
            ==========================================
            RANKING
            ==========================================
            */

            const ranking =
                getRanking(
                    updatedOrders,
                    groupId,
                    numero
                );

            /*
            ==========================================
            COMPRAS DE HOJE DO CLIENTE
            ==========================================
            */

            const hoje =
                getToday(
                    updatedOrders.filter(
                        order =>
                            order.group ===
                                groupId &&
                            String(
                                order.user
                            ) ===
                                String(numero) &&
                            order.status !==
                                "cancelado"
                    )
                );

            /*
            ==========================================
            DATA / HORA
            ==========================================
            */

            const dataAtual =
                new Date();

            /*
            ==========================================
            MENSAGEM PREMIUM
            ==========================================
            */

            const texto = automationOperation
                ? `╭━━━〔 URSINHO X AUTOMATION 〕━━━╮
┃
┃ ✅ PEDIDO AUTORIZADO PELO ADMIN
┃
┃ 👤 CLIENTE
┃ ┗ @${numero}
┃
┃ 📦 PACOTE
┃ ┗ ${pacoteInfo.original}
┃
┃ 🧾 OPERAÇÃO
┃ ┗ ${automationOperation.id}
┃
┃ ⚙️ ESTADO DO BACKEND
┃ ┗ ${automationOperation.estado}
┃
┃ ⏳ A tarefa só será entregue ao Agent
┃ com execução ativada e SIM Vodacom elegível.
┃
┃ O bot só anunciará a entrega depois
┃ da validação da evidência pelo Backend.
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`
                : `╭━━━〔 🐻 URSINHO X BOT 〕━━━╮
┃
┃  ✅ COMPRA CONFIRMADA
┃
┃  👤 CLIENTE
┃  ┗ @${numero}
┃
┃  📦 PACOTE
┃  ┗ ${gb.toFixed(2)} GB
┃
┃  🚀 STATUS
┃  ┗ 🟢 ENTREGUE
┃
┣━━━━━━━━━━━━━━━━━━━━
┃  📊 RESUMO DO CLIENTE
┃
┃  🛒 Compras      ${novasCompras}
┃  🌐 Total        ${novoTotal.toFixed(2)} GB
┃  🏆 Ranking      ${ranking}º lugar
┃  📈 Hoje         ${hoje.length} compra${hoje.length === 1 ? "" : "s"}
┃
╰━━━〔 💎 URSINHO X BOT 〕━━━╯`;

            /*
            ==========================================
            ENVIAR
            ==========================================
            */

            return sock.sendMessage(
                ctx.chat,
                {
                    text: texto,

                    /*
                    O JID ORIGINAL é usado aqui.
                    Isso permite ao WhatsApp renderizar
                    a menção corretamente.
                    */

                    mentions: [
                        clienteJid
                    ]
                },
                {
                    quoted: m
                }
            );

        } catch (e) {

            console.error(
                "compra erro:",
                e
            );

            return ctx.reply(
                "❌ Erro ao registar compra."
            );
        }
    }
};
