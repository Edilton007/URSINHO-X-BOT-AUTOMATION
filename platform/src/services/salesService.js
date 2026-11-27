const path = require("path");
const crypto = require("crypto");

const DB_PATH = process.env.SALES_DB_FILE
    ? path.resolve(process.env.SALES_DB_FILE)
    : path.join(__dirname, "../database/sales.json");

const { criarArmazem } = require("./safeJsonStore");

function validarSalesData(data) {
    if (data.products !== undefined && !Array.isArray(data.products)) throw new Error("products inválido");
    if (data.orders !== undefined && !Array.isArray(data.orders)) throw new Error("orders inválido");
    if (data.customers !== undefined && !Array.isArray(data.customers)) throw new Error("customers inválido");
    if (data.groups !== undefined && (!data.groups || typeof data.groups !== "object" || Array.isArray(data.groups))) {
        throw new Error("groups inválido");
    }
    for (const [groupId, group] of Object.entries(data.groups || {})) {
        if (!group || typeof group !== "object" || Array.isArray(group)) throw new Error(`grupo ${groupId} inválido`);
        for (const campo of ["orders", "customers", "pendingPayments", "pendingAutomationOrders"]) {
            if (group[campo] !== undefined && !Array.isArray(group[campo])) throw new Error(`groups.${groupId}.${campo} inválido`);
        }
        if (group.payments !== undefined && (!group.payments || typeof group.payments !== "object" || Array.isArray(group.payments))) {
            throw new Error(`groups.${groupId}.payments inválido`);
        }
    }
}

const salesStore = criarArmazem({
    file: DB_PATH,
    nome: "sales.json",
    keep: Number(process.env.SALES_BACKUP_KEEP) > 0 ? Number(process.env.SALES_BACKUP_KEEP) : 8,
    intervaloMs: 6 * 3600 * 1000,
    validar: validarSalesData
});

/* ============================================================
   ESTRUTURA PADRÃO
============================================================ */

function defaultPayment() {
    return {
        number: "",
        name: ""
    };
}

function defaultGroup() {
    return {
        salesEnabled: false,
        detectorEnabled: false,
        vendaIAEnabled: false,

        vendaIA: {
            tabela: ""
        },

        payments: {
            mpesa: defaultPayment(),
            emola: defaultPayment(),
            bim: defaultPayment()
        },

        orders: [],
        customers: [],

        /* ====================================================
           PAGAMENTOS PENDENTES DO DETECTOR

           Cada pagamento fica isolado por grupo.
           O cliente é identificado pelo sender.
        ==================================================== */
        pendingPayments: [],
        pendingAutomationOrders: []
    };
}

function defaultSalesDB() {
    return {
        products: [],
        orders: [],
        customers: [],
        groups: {}
    };
}

/* ============================================================
   CARREGAR DATABASE
============================================================ */

function loadSales() {
    try {
        const leitura = salesStore.ler();

        if (leitura.estado === "ilegivel") {
            throw new Error(
                `sales.json ilegível e sem cópia válida (${leitura.erro}). ` +
                `Os dados foram preservados em ${leitura.copia}.`
            );
        }

        if (leitura.estado === "ausente") {
            const nova = defaultSalesDB();
            saveSales(nova);
            return nova;
        }

        const db = leitura.dados;
        if (!Array.isArray(db.products)) db.products = [];
        if (!Array.isArray(db.orders)) db.orders = [];
        if (!Array.isArray(db.customers)) db.customers = [];
        if (!db.groups || typeof db.groups !== "object" || Array.isArray(db.groups)) db.groups = {};

        for (const groupId of Object.keys(db.groups)) {
            const group = db.groups[groupId];
            if (typeof group.salesEnabled !== "boolean") group.salesEnabled = false;
            if (typeof group.detectorEnabled !== "boolean") group.detectorEnabled = false;
            if (typeof group.vendaIAEnabled !== "boolean") group.vendaIAEnabled = false;
            if (!group.vendaIA || typeof group.vendaIA !== "object" || Array.isArray(group.vendaIA)) group.vendaIA = { tabela: "" };
            if (typeof group.vendaIA.tabela !== "string") group.vendaIA.tabela = "";
            if (!group.payments || typeof group.payments !== "object" || Array.isArray(group.payments)) group.payments = {};
            if (!group.payments.mpesa) group.payments.mpesa = defaultPayment();
            if (!group.payments.emola) group.payments.emola = defaultPayment();
            if (!group.payments.bim) group.payments.bim = defaultPayment();
            if (!Array.isArray(group.orders)) group.orders = [];
            if (!Array.isArray(group.customers)) group.customers = [];
            if (!Array.isArray(group.pendingPayments)) group.pendingPayments = [];
            if (!Array.isArray(group.pendingAutomationOrders)) group.pendingAutomationOrders = [];
        }

        return db;
    } catch (e) {
        console.error("salesService loadSales erro:", e.message);
        throw e;
    }
}

/* ============================================================
   SALVAR DATABASE
============================================================ */

function saveSales(data) {
    salesStore.gravar(data);
}

/* ============================================================
   GARANTIR GRUPO
============================================================ */

function ensureGroup(db, groupId) {
    if (!groupId) {
        return null;
    }

    if (!db.groups[groupId]) {
        db.groups[groupId] = defaultGroup();
    }

    const group = db.groups[groupId];

    if (typeof group.salesEnabled !== "boolean") {
        group.salesEnabled = false;
    }

    if (typeof group.detectorEnabled !== "boolean") {
        group.detectorEnabled = false;
    }

    if (typeof group.vendaIAEnabled !== "boolean") {
        group.vendaIAEnabled = false;
    }

    if (!group.vendaIA || typeof group.vendaIA !== "object") {
        group.vendaIA = {
            tabela: ""
        };
    }

    if (typeof group.vendaIA.tabela !== "string") {
        group.vendaIA.tabela = "";
    }

    if (!group.payments) {
        group.payments = {
            mpesa: defaultPayment(),
            emola: defaultPayment(),
            bim: defaultPayment()
        };
    }

    if (!group.payments.mpesa) {
        group.payments.mpesa = defaultPayment();
    }

    if (!group.payments.emola) {
        group.payments.emola = defaultPayment();
    }

    if (!group.payments.bim) {
        group.payments.bim = defaultPayment();
    }

    if (!group.orders) {
        group.orders = [];
    }

    if (!group.customers) {
        group.customers = [];
    }

    if (!group.pendingPayments) {
        group.pendingPayments = [];
    }

    if (!Array.isArray(group.pendingPayments)) {
        group.pendingPayments = [];
    }

    if (!Array.isArray(group.pendingAutomationOrders)) {
        group.pendingAutomationOrders = [];
    }

    return group;
}

/* ============================================================
   CONTAS DE PAGAMENTO
============================================================ */

function setPayment(
    groupId,
    type,
    number,
    name
) {
    const db = loadSales();

    const validTypes = [
        "mpesa",
        "emola",
        "bim"
    ];

    if (!groupId) {
        return false;
    }

    if (!validTypes.includes(type)) {
        return false;
    }

    const group = ensureGroup(
        db,
        groupId
    );

    group.payments[type] = {
        number: String(number || ""),
        name: name || ""
    };

    saveSales(db);

    return group.payments[type];
}

function getPayments(groupId) {
    const db = loadSales();

    if (!groupId) {
        return {
            mpesa: defaultPayment(),
            emola: defaultPayment(),
            bim: defaultPayment()
        };
    }

    const group = ensureGroup(
        db,
        groupId
    );

    return group.payments;
}

function removePayment(
    groupId,
    type
) {
    const db = loadSales();

    const validTypes = [
        "mpesa",
        "emola",
        "bim"
    ];

    if (!groupId) {
        return false;
    }

    if (!validTypes.includes(type)) {
        return false;
    }

    const group = ensureGroup(
        db,
        groupId
    );

    group.payments[type] = defaultPayment();

    saveSales(db);

    return true;
}

/* ============================================================
   SISTEMA DE VENDAS
============================================================ */

function setSalesEnabled(
    groupId,
    enabled
) {
    if (!groupId) {
        return false;
    }

    const db = loadSales();

    const group = ensureGroup(
        db,
        groupId
    );

    group.salesEnabled = Boolean(enabled);

    saveSales(db);

    return group.salesEnabled;
}

function isSalesEnabled(groupId) {
    if (!groupId) {
        return false;
    }

    const db = loadSales();

    const group = db.groups?.[groupId];

    return group?.salesEnabled === true;
}

function getGroupSalesSettings(groupId) {
    const db = loadSales();

    if (!groupId) {
        return defaultGroup();
    }

    return (
        db.groups?.[groupId] ||
        defaultGroup()
    );
}

/* ============================================================
   DETECTOR DE COMPROVATIVOS
============================================================ */

function setDetectorEnabled(
    groupId,
    enabled
) {
    if (!groupId) {
        return false;
    }

    const db = loadSales();

    const group = ensureGroup(
        db,
        groupId
    );

    group.detectorEnabled = Boolean(enabled);

    saveSales(db);

    return group.detectorEnabled;
}

function isDetectorEnabled(groupId) {
    if (!groupId) {
        return false;
    }

    const db = loadSales();

    const group = db.groups?.[groupId];

    return group?.detectorEnabled === true;
}

function getDetectorSettings(groupId) {
    const db = loadSales();

    if (!groupId) {
        return {
            detectorEnabled: false
        };
    }

    const group = db.groups?.[groupId];

    if (!group) {
        return {
            detectorEnabled: false
        };
    }

    return {
        detectorEnabled:
            group.detectorEnabled === true
    };
}

/* ============================================================
   CLIENTES POR GRUPO
============================================================ */

function getCustomers(groupId) {
    if (!groupId) {
        return [];
    }

    const db = loadSales();

    const group = db.groups?.[groupId];

    if (!group) {
        return [];
    }

    return group.customers || [];
}

function saveCustomer(
    groupId,
    customer
) {
    if (!groupId || !customer) {
        return false;
    }

    const db = loadSales();

    const group = ensureGroup(
        db,
        groupId
    );

    const index =
        group.customers.findIndex(
            c => c.number === customer.number
        );

    if (index >= 0) {
        group.customers[index] = customer;
    } else {
        group.customers.push(customer);
    }

    saveSales(db);

    return customer;
}

/* ============================================================
   PEDIDOS POR GRUPO
============================================================ */

function getOrders(groupId) {
    if (!groupId) {
        return [];
    }

    const db = loadSales();

    const group = db.groups?.[groupId];

    if (!group) {
        return [];
    }

    return group.orders || [];
}

function saveOrder(
    groupId,
    order
) {
    if (!groupId || !order) {
        return false;
    }

    const db = loadSales();

    const group = ensureGroup(
        db,
        groupId
    );

    // Um mesmo operationId nunca gera dois pedidos.
    if (order.operationId) {
        const correspondentes = group.orders.filter((o) => o.operationId === order.operationId);
        if (correspondentes.length > 1) {
            console.error(`[SALES] operationId duplicado em ${groupId}: ${order.operationId}. Nova gravação recusada.`);
            return false;
        }
        const existente = correspondentes[0];
        if (existente) {
            const camposIdentidade = ["user", "product", "gb", "paymentReference"];
            const conflito = camposIdentidade.some((campo) =>
                existente[campo] != null && order[campo] != null && String(existente[campo]) !== String(order[campo])
            );
            if (conflito) {
                console.error(`[SALES] operationId reutilizado com dados comerciais diferentes: ${order.operationId}.`);
                return false;
            }
            return existente;
        }
    }

    group.orders.push({
        ...order,
        group: groupId
    });

    saveSales(db);

    return order;
}

/* ============================================================
   ATUALIZAR PEDIDO POR GRUPO
============================================================ */

/*
 * Atualiza uma venda existente dentro do grupo informado.
 *
 * O índice pertence exclusivamente a group.orders.
 * Nenhum pedido de outro grupo é acessado.
 */
function updateOrder(groupId, index, changes) {
    if (
        !groupId ||
        !Number.isInteger(index) ||
        index < 0 ||
        !changes ||
        typeof changes !== "object"
    ) {
        return false;
    }

    const db = loadSales();

    const group = db.groups?.[groupId];

    if (
        !group ||
        !Array.isArray(group.orders) ||
        !group.orders[index]
    ) {
        return false;
    }

    group.orders[index] = {
        ...group.orders[index],
        ...changes,
        group: groupId
    };

    saveSales(db);

    return group.orders[index];
}

/* ============================================================
   PAGAMENTOS PENDENTES DO DETECTOR
============================================================ */

/*
 * Cria um pagamento pendente.
 *
 * O pagamento pertence exclusivamente ao grupo.
 *
 * Estrutura:
 *
 * {
 *   reference,
 *   sender,
 *   pushName,
 *   operator,
 *   amount,
 *   dateTime,
 *   destination,
 *   destinationName,
 *   recipientNumber,
 *   status,
 *   createdAt,
 *   updatedAt
 * }
 */


function criarPedidoAutomationPendente(groupId, dados) {
    if (!groupId || !String(groupId).endsWith("@g.us") || !dados) {
        return { error: "Grupo ou dados do pedido inválidos." };
    }

    const sender = String(dados.sender || "").trim();
    const recipientNumber = String(dados.recipientNumber || "").replace(/\D/g, "");
    const megas = Number(dados.megas);
    const expectedAmount = Number(dados.expectedAmount);
    const productId = String(dados.productId || "").trim();

    if (!sender || sender.length > 160) return { error: "Cliente WhatsApp inválido." };
    if (!/^(?:258)?(?:84|85)\d{7}$/.test(recipientNumber)) return { error: "Destino Vodacom inválido." };
    if (!Number.isSafeInteger(megas) || megas < 100 || megas > 10240) return { error: "Quantidade de megas inválida." };
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0 || expectedAmount > 100000000) return { error: "Preço esperado inválido." };
    if (!productId) return { error: "Produto Tenant em falta." };
    const metodos = Array.isArray(dados.paymentMethods)
        ? dados.paymentMethods.filter(method =>
            method && method.ativo !== false &&
            String(method.tipo || "").trim() &&
            String(method.conta || method.numero || "").replace(/\D/g, "").length >= 5
        )
        : [];
    if (metodos.length === 0) return { error: "O pedido não tem método de pagamento activo do Tenant." };

    const db = loadSales();
    const group = ensureGroup(db, groupId);
    const now = Date.now();

    // Se já existe comprovativo ligado a um pedido, o administrador tem de
    // resolver esse pedido antes de aceitar um segundo para o mesmo cliente.
    const aguardandoDecisao = group.pendingAutomationOrders.find(item =>
        item.sender === sender &&
        item.estado === "COMPROVATIVO_RECEBIDO"
    );
    if (aguardandoDecisao) {
        return {
            error: "Já existe um comprovativo associado a um pedido à espera de confirmação administrativa. Aguarda a decisão antes de iniciar outro pedido.",
            code: "CUSTOMER_ORDER_REVIEW_PENDING"
        };
    }

    // Um único pedido de pagamento aberto por cliente/grupo elimina ambiguidades.
    for (const item of group.pendingAutomationOrders) {
        if (item.sender === sender && item.estado === "AGUARDANDO_PAGAMENTO") {
            item.estado = "SUBSTITUIDO";
            item.atualizadoEmMs = now;
        }
    }

    const order = {
        id: "WA-" + crypto.randomBytes(12).toString("hex").toUpperCase(),
        groupId,
        sender,
        recipientNumber,
        megas,
        expectedAmount: Math.round(expectedAmount * 100) / 100,
        productId,
        productName: String(dados.productName || "").slice(0, 100),
        paymentMethods: Array.isArray(dados.paymentMethods)
            ? dados.paymentMethods
                .filter(method => method && method.ativo !== false)
                .map(method => ({
                    id: String(method.id || "").slice(0, 60),
                    tipo: String(method.tipo || "").trim().toUpperCase().slice(0, 30),
                    conta: String(method.conta || method.numero || "").replace(/[^0-9+]/g, "").slice(0, 30),
                    titular: String(method.titular || "").trim().slice(0, 100)
                }))
                .filter(method => method.tipo && method.conta.length >= 5)
            : [],
        estado: "AGUARDANDO_PAGAMENTO",
        criadoEmMs: now,
        expiraEmMs: now + 30 * 60 * 1000,
        atualizadoEmMs: now
    };

    group.pendingAutomationOrders.push(order);
    saveSales(db);
    return { ok: true, pedido: { ...order } };
}

function obterPedidoAutomationPendente(groupId, sender) {
    if (!groupId || !sender) return null;
    const db = loadSales();
    const group = db.groups?.[groupId];
    if (!group || !Array.isArray(group.pendingAutomationOrders)) return null;

    const now = Date.now();
    const order = group.pendingAutomationOrders
        .filter(item => item.sender === String(sender) && item.estado === "AGUARDANDO_PAGAMENTO")
        .sort((a, b) => Number(b.criadoEmMs || 0) - Number(a.criadoEmMs || 0))[0];

    if (!order) return null;
    if (!Number.isSafeInteger(order.expiraEmMs) || order.expiraEmMs <= now) {
        order.estado = "EXPIRADO";
        order.atualizadoEmMs = now;
        saveSales(db);
        return null;
    }
    return { ...order };
}

function associarComprovativoAoPedidoAutomation(groupId, sender, proof) {
    if (!groupId || !sender || !proof?.reference) {
        return { error: "Dados do comprovativo incompletos.", code: "PROOF_INVALID" };
    }

    const db = loadSales();
    const group = db.groups?.[groupId];
    if (!group || !Array.isArray(group.pendingAutomationOrders)) {
        return { error: "Não existe pré-pedido para este cliente.", code: "PREFLIGHT_ORDER_NOT_FOUND" };
    }

    const now = Date.now();
    const order = group.pendingAutomationOrders
        .filter(item => item.sender === String(sender) && item.estado === "AGUARDANDO_PAGAMENTO")
        .sort((a, b) => Number(b.criadoEmMs || 0) - Number(a.criadoEmMs || 0))[0];

    if (!order) return { error: "Não existe um pedido activo deste cliente. Deve fazer nova pré-verificação.", code: "PREFLIGHT_ORDER_NOT_FOUND" };

    if (!Number.isSafeInteger(order.expiraEmMs) || order.expiraEmMs <= now) {
        order.estado = "EXPIRADO";
        order.atualizadoEmMs = now;
        saveSales(db);
        return { error: "A pré-verificação expirou. Deve verificar a disponibilidade novamente.", code: "PREFLIGHT_ORDER_EXPIRED" };
    }

    const amount = Number(proof.amount);
    const amountMatches = Number.isFinite(amount) &&
        Math.round(amount * 100) === Math.round(Number(order.expectedAmount) * 100);

    const operator = String(proof.operator || "").trim().toLowerCase();
    const acceptedTypes = {
        mpesa: new Set(["MPESA"]),
        emola: new Set(["EMOLA"]),
        bim: new Set(["BANCO", "TRANSFERENCIA", "MANUAL", "MKESH"])
    };
    const allowedTypes = acceptedTypes[operator] || new Set();
    const normalizarContaPagamento = value => {
        const digits = String(value || "").replace(/\D/g, "");
        return digits.startsWith("258") && digits.length === 12
            ? digits.slice(3)
            : digits;
    };
    const proofAccount = normalizarContaPagamento(proof.destination);
    const proofHolder = String(proof.destinationName || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/\s+/g, " ").trim();
    const methodMatches = Array.isArray(order.paymentMethods) &&
        order.paymentMethods.some(method => {
            const methodAccount = normalizarContaPagamento(method.conta);
            const methodHolder = String(method.titular || "")
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .toLowerCase().replace(/\s+/g, " ").trim();
            return allowedTypes.has(String(method.tipo || "").toUpperCase()) &&
                proofAccount.length >= 5 &&
                methodAccount === proofAccount &&
                proofHolder.length > 0 &&
                methodHolder === proofHolder;
        });

    if (!methodMatches) {
        order.estado = "METODO_PAGAMENTO_DIVERGENTE";
        order.paymentReference = String(proof.reference);
        order.paymentOperator = operator || null;
        order.atualizadoEmMs = now;
        saveSales(db);
        return {
            error: "O comprovativo utiliza um método de pagamento que não foi apresentado neste pedido.",
            code: "PAYMENT_METHOD_MISMATCH",
            pedido: { ...order }
        };
    }
    if (!amountMatches) {
        order.estado = "VALOR_DIVERGENTE";
        order.paymentReference = String(proof.reference);
        order.detectedAmount = Number.isFinite(amount) ? amount : null;
        order.atualizadoEmMs = now;
        saveSales(db);
        return {
            error: "O valor do comprovativo não corresponde ao preço do pedido. A referência foi registada e exige revisão administrativa.",
            code: "PAYMENT_AMOUNT_MISMATCH",
            pedido: { ...order }
        };
    }

    order.estado = "COMPROVATIVO_RECEBIDO";
    order.paymentReference = String(proof.reference);
    order.paymentOperator = String(proof.operator || "").slice(0, 30);
    order.detectedAmount = amount;
    order.proofReceivedAtMs = now;
    order.atualizadoEmMs = now;
    saveSales(db);
    return { ok: true, pedido: { ...order } };
}

function obterPedidoAutomationPorId(groupId, orderId) {
    if (!groupId || !orderId) return null;
    const group = loadSales().groups?.[groupId];
    const order = group?.pendingAutomationOrders?.find(item => item.id === String(orderId));
    return order ? { ...order } : null;
}

function atualizarEstadoPedidoAutomation(groupId, orderId, estado, dados = {}) {
    if (!groupId || !orderId || !estado) return null;
    const db = loadSales();
    const group = ensureGroup(db, groupId);
    const index = group.pendingAutomationOrders.findIndex(item => item.id === String(orderId));
    if (index < 0) return null;
    group.pendingAutomationOrders[index] = {
        ...group.pendingAutomationOrders[index],
        ...dados,
        estado: String(estado),
        atualizadoEmMs: Date.now()
    };
    saveSales(db);
    return { ...group.pendingAutomationOrders[index] };
}

function savePendingPayment(
    groupId,
    payment
) {
    if (!groupId || !payment) {
        return false;
    }

    if (!payment.reference) {
        return false;
    }

    if (!payment.sender) {
        return false;
    }

    const db = loadSales();

    const group = ensureGroup(
        db,
        groupId
    );

    /*
     * Não permitir dois pendentes com a mesma
     * referência para o mesmo grupo e cliente.
     */
    const existingIndex =
        group.pendingPayments.findIndex(
            item =>
                item.reference === payment.reference &&
                item.sender === payment.sender
        );

    const now = Date.now();

    const pending = {
        reference: String(
            payment.reference
        ),

        sender: String(
            payment.sender
        ),

        pushName:
            payment.pushName || "Cliente",

        operator:
            payment.operator || null,

        amount:
            payment.amount != null
                ? Number(payment.amount)
                : null,

        dateTime:
            payment.dateTime || null,

        /*
         * Destino que apareceu originalmente
         * no comprovativo.
         */
        destination:
            payment.destination || null,

        destinationName:
            payment.destinationName || null,

        /*
         * Número que o cliente irá mandar
         * posteriormente para receber.
         */
        recipientNumber:
            payment.recipientNumber || null,

        // Referência ao pedido pré-validado no Tenant/WhatsApp.
        preflightOrderId:
            payment.preflightOrderId || null,

        expectedMegas:
            Number.isSafeInteger(payment.expectedMegas) ? payment.expectedMegas : null,

        expectedAmount:
            Number.isFinite(Number(payment.expectedAmount)) && payment.expectedAmount != null
                ? Math.round(Number(payment.expectedAmount) * 100) / 100
                : null,

        status:
            payment.status ||
            "aguardando_numero",

        createdAt:
            payment.createdAt ||
            now,

        updatedAt:
            now
    };

    if (existingIndex >= 0) {
        group.pendingPayments[existingIndex] = {
            ...group.pendingPayments[existingIndex],
            ...pending,
            updatedAt: now
        };

        saveSales(db);

        return group.pendingPayments[
            existingIndex
        ];
    }

    group.pendingPayments.push(pending);

    saveSales(db);

    return pending;
}

/* ============================================================
   OBTER TODOS OS PAGAMENTOS PENDENTES
============================================================ */

function getPendingPayments(groupId) {
    if (!groupId) {
        return [];
    }

    const db = loadSales();

    const group = db.groups?.[groupId];

    if (!group) {
        return [];
    }

    return Array.isArray(
        group.pendingPayments
    )
        ? group.pendingPayments
        : [];
}

/* ============================================================
   PROCURAR PAGAMENTO PENDENTE POR
   GRUPO + CLIENTE + REFERÊNCIA
============================================================ */

function getPendingPayment(
    groupId,
    sender,
    reference
) {
    if (
        !groupId ||
        !sender ||
        !reference
    ) {
        return null;
    }

    const db = loadSales();

    const group = db.groups?.[groupId];

    if (!group) {
        return null;
    }

    const pendingPayments =
        Array.isArray(group.pendingPayments)
            ? group.pendingPayments
            : [];

    return (
        pendingPayments.find(
            payment =>
                payment.sender === sender &&
                payment.reference === reference
        ) || null
    );
}

/* ============================================================
   PROCURAR PAGAMENTO PENDENTE DO CLIENTE
   MAIS RECENTE
============================================================ */

/*
 * Esta função procura somente dentro do grupo.

 * Critérios:
 *
 * groupId
 * sender
 * status aguardando número
 *
 * Se existirem vários, retorna o mais recente.
 */

function getLatestPendingPayment(
    groupId,
    sender
) {
    if (!groupId || !sender) {
        return null;
    }

    const db = loadSales();

    const group = db.groups?.[groupId];

    if (!group) {
        return null;
    }

    const pendingPayments =
        Array.isArray(group.pendingPayments)
            ? group.pendingPayments
            : [];

    const pending =
        pendingPayments.filter(
            payment =>
                payment.sender === sender &&
                payment.status ===
                    "aguardando_numero" &&
                !payment.recipientNumber
        );

    if (!pending.length) {
        return null;
    }

    pending.sort(
        (a, b) =>
            Number(b.createdAt || 0) -
            Number(a.createdAt || 0)
    );

    return pending[0];
}

/* ============================================================
   ASSOCIAR NÚMERO AO PAGAMENTO PENDENTE
============================================================ */

function setPendingRecipientNumber(
    groupId,
    sender,
    recipientNumber
) {
    if (
        !groupId ||
        !sender ||
        !recipientNumber
    ) {
        return null;
    }

    const db = loadSales();

    const group = ensureGroup(
        db,
        groupId
    );

    const pendingPayments =
        group.pendingPayments;

    /*
     * Procura o pagamento pendente mais recente
     * daquele cliente dentro deste grupo.
     */
    const candidates =
        pendingPayments.filter(
            payment =>
                payment.sender === sender &&
                payment.status ===
                    "aguardando_numero" &&
                !payment.recipientNumber
        );

    if (!candidates.length) {
        return null;
    }

    candidates.sort(
        (a, b) =>
            Number(b.createdAt || 0) -
            Number(a.createdAt || 0)
    );

    const target = candidates[0];

    const index =
        pendingPayments.findIndex(
            payment =>
                payment.reference ===
                    target.reference &&
                payment.sender === sender
        );

    if (index < 0) {
        return null;
    }

    pendingPayments[index] = {
        ...pendingPayments[index],

        recipientNumber:
            String(recipientNumber),

        status:
            "numero_recebido",

        updatedAt:
            Date.now()
    };

    saveSales(db);

    return pendingPayments[index];
}

/* ============================================================
   ATUALIZAR PAGAMENTO PENDENTE POR REFERÊNCIA
============================================================ */

function updatePendingPayment(
    groupId,
    sender,
    reference,
    updates
) {
    if (
        !groupId ||
        !sender ||
        !reference ||
        !updates
    ) {
        return null;
    }

    const db = loadSales();

    const group = ensureGroup(
        db,
        groupId
    );

    const index =
        group.pendingPayments.findIndex(
            payment =>
                payment.sender === sender &&
                payment.reference === reference
        );

    if (index < 0) {
        return null;
    }

    group.pendingPayments[index] = {
        ...group.pendingPayments[index],
        ...updates,
        updatedAt: Date.now()
    };

    saveSales(db);

    return group.pendingPayments[index];
}

/* ============================================================
   REMOVER PAGAMENTO PENDENTE
============================================================ */

function removePendingPayment(
    groupId,
    sender,
    reference
) {
    if (
        !groupId ||
        !sender ||
        !reference
    ) {
        return false;
    }

    const db = loadSales();

    const group = ensureGroup(
        db,
        groupId
    );

    const index =
        group.pendingPayments.findIndex(
            payment =>
                payment.sender === sender &&
                payment.reference === reference
        );

    if (index < 0) {
        return false;
    }

    group.pendingPayments.splice(
        index,
        1
    );

    saveSales(db);

    return true;
}

/* ============================================================
   VENDAIA
============================================================ */

/**
 * Ativa ou desativa a VENDAIA para um grupo.
 */
function setVendaIAEnabled(groupId, enabled) {
    if (!groupId) {
        return false;
    }

    const db = loadSales();

    const group = ensureGroup(
        db,
        groupId
    );

    group.vendaIAEnabled = Boolean(enabled);

    saveSales(db);

    return group.vendaIAEnabled;
}

/**
 * Verifica se a VENDAIA está ativa no grupo.
 */
function isVendaIAEnabled(groupId) {
    if (!groupId) {
        return false;
    }

    const db = loadSales();

    const group = db.groups?.[groupId];

    return group?.vendaIAEnabled === true;
}

/**
 * Obtém as configurações da VENDAIA do grupo.
 */
function getVendaIASettings(groupId) {
    if (!groupId) {
        return {
            vendaIAEnabled: false
        };
    }

    const db = loadSales();

    const group = db.groups?.[groupId];

    return {
        vendaIAEnabled:
            group?.vendaIAEnabled === true
    };
}


/* ============================================================
   TABELA DA VENDAIA — POR GRUPO
============================================================ */

/**
 * Define a tabela de vendas da VENDAIA para um grupo.
 */
function setVendaIATabela(groupId, tabela) {

    if (!groupId) {
        return false;
    }

    const db = loadSales();

    const group = ensureGroup(
        db,
        groupId
    );

    group.vendaIA.tabela =
        String(tabela || "").trim();

    saveSales(db);

    return group.vendaIA.tabela;
}

/**
 * Obtém a tabela de vendas da VENDAIA de um grupo.
 */
function getVendaIATabela(groupId) {

    if (!groupId) {
        return "";
    }

    const db = loadSales();

    const group = db.groups?.[groupId];

    if (!group?.vendaIA) {
        return "";
    }

    return String(
        group.vendaIA.tabela || ""
    );
}



/* ============================================================
   ATUALIZAR PEDIDO PELO ID DA OPERAÇÃO AUTOMATION
============================================================ */
function updateOrderByOperationId(groupId, operationId, changes) {
    if (!groupId || !operationId || !changes || typeof changes !== "object") {
        return false;
    }

    const db = loadSales();
    const group = db.groups?.[groupId];
    if (!group || !Array.isArray(group.orders)) return false;

    const indices = group.orders
        .map((order, index) => order.group === groupId && order.operationId === operationId ? index : -1)
        .filter((index) => index >= 0);
    if (indices.length !== 1) {
        if (indices.length > 1) console.error(`[SALES] ${indices.length} pedidos usam o mesmo operationId ${operationId}; atualização recusada.`);
        return false;
    }
    const index = indices[0];

    group.orders[index] = { ...group.orders[index], ...changes, group: groupId };
    saveSales(db);
    return group.orders[index];
}

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
    loadSales,
    saveSales,

    setPayment,
    getPayments,
    removePayment,

    setSalesEnabled,
    isSalesEnabled,
    getGroupSalesSettings,

    setDetectorEnabled,
    isDetectorEnabled,
    getDetectorSettings,

    setVendaIAEnabled,
    isVendaIAEnabled,
    getVendaIASettings,

    setVendaIATabela,
    getVendaIATabela,

    getCustomers,
    saveCustomer,

    getOrders,
    saveOrder,
    updateOrder,
    updateOrderByOperationId,

    /* ========================================================
       PAGAMENTOS PENDENTES
    ======================================================== */

    savePendingPayment,
    getPendingPayments,
    getPendingPayment,
    getLatestPendingPayment,
    setPendingRecipientNumber,
    updatePendingPayment,
    removePendingPayment,
    criarPedidoAutomationPendente,
    obterPedidoAutomationPendente,
    associarComprovativoAoPedidoAutomation,
    obterPedidoAutomationPorId,
    atualizarEstadoPedidoAutomation
};
