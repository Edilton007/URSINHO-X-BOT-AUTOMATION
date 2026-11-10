"use strict";

const crypto = require("crypto");
const db = require("../database/automationDb");

function ensureCollections() {
    db.storefronts ||= {};
    db.storeProducts ||= {};
    db.storeOrders ||= {};
}

function id(prefix) {
    return `${prefix}-${crypto.randomBytes(10).toString("hex").toUpperCase()}`;
}

function slugify(value) {
    return String(value || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "").slice(0, 48);
}

function cleanText(value, max) {
    return String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}

function getStoreByTenant(tenantId) {
    ensureCollections();
    return Object.values(db.storefronts).find(x => x.tenantId === tenantId) || null;
}

function tenantAtivo(tenantId) {
    const tenant = db.tenants[tenantId];
    return !!tenant && tenant.ativo !== false;
}

function normalizarMetodosPagamento(input, atual = []) {
    if (input === undefined) return atual;
    if (!Array.isArray(input) || input.length > 10) return { error: "Informe até 10 métodos de pagamento." };
    const ids = new Set();
    const metodos = [];
    for (const item of input) {
        const tipo = String(item?.tipo || "").trim().toUpperCase();
        if (!["MPESA", "EMOLA", "MKESH", "TRANSFERENCIA", "MANUAL"].includes(tipo)) return { error: "Tipo de pagamento não suportado." };
        const nome = cleanText(item?.nome || tipo, 60);
        const conta = String(item?.conta || item?.numero || "").replace(/[^0-9+]/g, "").slice(0, 30);
        const idMetodo = cleanText(item?.id || id("PAY"), 60);
        if (ids.has(idMetodo)) return { error: "IDs de métodos de pagamento duplicados." };
        if (conta.length < 5) return { error: "Cada método precisa de um número ou conta válida." };
        ids.add(idMetodo);
        metodos.push({
            id: idMetodo, tipo, nome, conta,
            titular: cleanText(item?.titular, 100),
            instrucoes: cleanText(item?.instrucoes, 300),
            ativo: item?.ativo !== false
        });
    }
    return metodos;
}

function configurarLoja(tenantId, input = {}) {
    ensureCollections();
    if (!tenantAtivo(tenantId)) return { error: "Tenant inexistente ou desativado." };

    const tenant = db.tenants[tenantId];
    const atual = getStoreByTenant(tenantId);
    const requestedSlug = slugify(input.slug || atual?.slug || `${tenant.nome}-${tenantId.slice(-6)}`);
    if (requestedSlug.length < 3) return { error: "O endereço da loja precisa ter pelo menos 3 caracteres." };

    const collision = Object.values(db.storefronts).find(x => x.slug === requestedSlug && x.tenantId !== tenantId);
    if (collision) return { error: "Este endereço já está a ser utilizado por outra loja." };

    const metodosPagamento = normalizarMetodosPagamento(input.metodosPagamento, atual?.metodosPagamento || []);
    if (metodosPagamento?.error) return { error: metodosPagamento.error };

    const agora = Date.now();
    const loja = {
        id: atual?.id || id("STORE"),
        tenantId,
        slug: requestedSlug,
        nome: cleanText(input.nome || atual?.nome || tenant.nome, 80),
        descricao: cleanText(input.descricao ?? atual?.descricao ?? "", 500),
        contacto: cleanText(input.contacto ?? atual?.contacto ?? "", 30),
        mpesa: cleanText(input.mpesa ?? atual?.mpesa ?? "", 30),
        emola: cleanText(input.emola ?? atual?.emola ?? "", 30),
        instrucoesPagamento: cleanText(input.instrucoesPagamento ?? atual?.instrucoesPagamento ?? "", 500),
        metodosPagamento,
        publicado: input.publicado === undefined ? (atual?.publicado === true) : input.publicado === true,
        criadoEmMs: atual?.criadoEmMs || agora,
        atualizadoEmMs: agora
    };

    db.storefronts[loja.id] = loja;
    db.save();
    return { ok: true, loja: { ...loja } };
}

function listarProdutos(tenantId, incluirInativos = true) {
    ensureCollections();
    return Object.values(db.storeProducts)
        .filter(p => p.tenantId === tenantId && (incluirInativos || p.ativo === true))
        .sort((a, b) => (b.atualizadoEmMs || b.criadoEmMs) - (a.atualizadoEmMs || a.criadoEmMs));
}

function criarProduto(tenantId, input = {}) {
    ensureCollections();
    if (!tenantAtivo(tenantId)) return { error: "Tenant inexistente ou desativado." };
    const nome = cleanText(input.nome, 100);
    const precoMT = Number(input.precoMT);
    if (nome.length < 2) return { error: "Informe um nome de produto válido." };
    if (!Number.isFinite(precoMT) || precoMT <= 0 || precoMT > 100000000) return { error: "Preço inválido. Informe um valor positivo em MT." };

    const agora = Date.now();
    const product = {
        id: id("PROD"), tenantId,
        nome,
        descricao: cleanText(input.descricao, 500),
        precoMT: Math.round(precoMT * 100) / 100,
        sku: cleanText(input.sku, 50) || null,
        ativo: input.ativo !== false,
        criadoEmMs: agora, atualizadoEmMs: agora
    };
    db.storeProducts[product.id] = product;
    db.save();
    return { ok: true, produto: product };
}

function atualizarProduto(tenantId, productId, input = {}) {
    ensureCollections();
    const product = db.storeProducts[productId];
    if (!product || product.tenantId !== tenantId) return { error: "Produto não encontrado." };

    if (input.nome !== undefined) {
        const nome = cleanText(input.nome, 100);
        if (nome.length < 2) return { error: "Nome de produto inválido." };
        product.nome = nome;
    }
    if (input.descricao !== undefined) product.descricao = cleanText(input.descricao, 500);
    if (input.precoMT !== undefined) {
        const price = Number(input.precoMT);
        if (!Number.isFinite(price) || price <= 0 || price > 100000000) return { error: "Preço inválido." };
        product.precoMT = Math.round(price * 100) / 100;
    }
    if (input.ativo !== undefined) product.ativo = input.ativo === true;
    if (input.sku !== undefined) product.sku = cleanText(input.sku, 50) || null;
    product.atualizadoEmMs = Date.now();
    db.save();
    return { ok: true, produto: product };
}

function catalogoPublico(slug) {
    ensureCollections();
    const loja = Object.values(db.storefronts).find(x => x.slug === slug && x.publicado === true);
    if (!loja || !tenantAtivo(loja.tenantId)) return null;
    return {
        loja: {
            slug: loja.slug, nome: loja.nome, descricao: loja.descricao,
            contacto: loja.contacto, mpesa: loja.mpesa, emola: loja.emola,
            instrucoesPagamento: loja.instrucoesPagamento,
            metodosPagamento: (loja.metodosPagamento || []).filter(m => m.ativo === true).map(m => ({
                id: m.id, tipo: m.tipo, nome: m.nome, conta: m.conta,
                titular: m.titular, instrucoes: m.instrucoes
            }))
        },
        produtos: listarProdutos(loja.tenantId, false).map(p => ({
            id: p.id, nome: p.nome, descricao: p.descricao, precoMT: p.precoMT, sku: p.sku
        }))
    };
}

function criarPedidoPublico(slug, input = {}, idempotencyKey = null) {
    ensureCollections();
    const loja = Object.values(db.storefronts).find(x => x.slug === slug && x.publicado === true);
    if (!loja || !tenantAtivo(loja.tenantId)) return { error: "Loja indisponível.", status: 404 };

    const nome = cleanText(input.nome, 100);
    const telefone = String(input.telefone || "").replace(/[^0-9+]/g, "").slice(0, 18);
    if (nome.length < 2) return { error: "Informe o nome do cliente." };
    if (!/^\+?\d{9,15}$/.test(telefone)) return { error: "Número de telefone inválido." };
    if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) return { error: "Carrinho inválido." };

    const items = [];
    let totalMT = 0;
    for (const item of input.items) {
        const productId = String(item?.productId || "");
        const quantity = Number(item?.quantity);
        const product = db.storeProducts[productId];
        if (!product || product.tenantId !== loja.tenantId || product.ativo !== true) return { error: "Um produto do carrinho já não está disponível." };
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return { error: "Quantidade inválida." };
        const lineTotal = Math.round(product.precoMT * quantity * 100) / 100;
        totalMT = Math.round((totalMT + lineTotal) * 100) / 100;
        items.push({ productId, nome: product.nome, precoUnitarioMT: product.precoMT, quantity, totalMT: lineTotal });
    }
    if (totalMT <= 0 || totalMT > 1000000000) return { error: "Valor total do pedido inválido." };

    const metodosAtivos = (loja.metodosPagamento || []).filter(m => m.ativo === true);
    const paymentMethodId = cleanText(input.paymentMethodId, 60);
    if (metodosAtivos.length && !paymentMethodId) return { error: "Selecione um método de pagamento." };
    const metodoPagamento = metodosAtivos.find(m => m.id === paymentMethodId);
    if (metodosAtivos.length && !metodoPagamento) return { error: "Método de pagamento indisponível para esta loja." };

    const key = cleanText(idempotencyKey, 120);
    if (key.length < 8) return { error: "Cabeçalho x-idempotency-key obrigatório (mínimo 8 caracteres)." };
    const previous = Object.values(db.storeOrders).find(o => o.tenantId === loja.tenantId && o.idempotencyKey === key);
    if (previous) {
        const same = previous.telefone === telefone && previous.nome === nome &&
            JSON.stringify(previous.items) === JSON.stringify(items) &&
            (previous.pagamentoMetodo?.id || null) === (metodoPagamento?.id || null);
        if (!same) return { error: "A referência de idempotência já foi usada com outros dados.", code: "IDEMPOTENCY_CONFLICT", status: 409 };
        return { ok: true, idempotente: true, pedido: previous };
    }

    const now = Date.now();
    const order = {
        id: id("ORDER"), reference: `UX-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
        tenantId: loja.tenantId, storefrontId: loja.id, storeSlug: loja.slug,
        nome, telefone, nota: cleanText(input.nota, 500), items, totalMT,
        pagamentoMetodo: metodoPagamento ? {
            id: metodoPagamento.id, tipo: metodoPagamento.tipo, nome: metodoPagamento.nome,
            conta: metodoPagamento.conta, titular: metodoPagamento.titular,
            instrucoes: metodoPagamento.instrucoes
        } : null,
        estado: "AGUARDANDO_PAGAMENTO", pagamentoEstado: "PENDENTE_VERIFICACAO",
        idempotencyKey: key || null, criadoEmMs: now, atualizadoEmMs: now,
        revisaoPagamento: null
    };
    db.storeOrders[order.id] = order;
    db.auditar?.({ tenantId: loja.tenantId, acao: "STORE_ORDER_CREATED", orderId: order.id, totalMT });
    db.save();
    return { ok: true, idempotente: false, pedido: order };
}

function listarPedidos(tenantId) {
    ensureCollections();
    return Object.values(db.storeOrders)
        .filter(o => o.tenantId === tenantId)
        .sort((a, b) => b.criadoEmMs - a.criadoEmMs);
}

function todosPedidos() {
    ensureCollections();
    return Object.values(db.storeOrders).sort((a, b) => b.criadoEmMs - a.criadoEmMs);
}

function resolverPagamento(orderId, decision, note, reference, actor = "admin") {
    ensureCollections();
    const order = db.storeOrders[orderId];
    if (!order) return { error: "Pedido não encontrado.", status: 404 };
    if (!['CONFIRMADO', 'REJEITADO'].includes(decision)) return { error: "Decisão inválida." };
    if (String(note || "").trim().length < 5) return { error: "Informe o motivo da verificação (mínimo 5 caracteres)." };
    order.pagamentoEstado = decision === "CONFIRMADO" ? "CONFIRMADO_MANUALMENTE" : "REJEITADO_MANUALMENTE";
    order.estado = decision === "CONFIRMADO" ? "PAGO" : "PAGAMENTO_REJEITADO";
    order.revisaoPagamento = {
        decisao: decision, motivo: cleanText(note, 300), referencia: cleanText(reference, 120),
        por: actor, emMs: Date.now()
    };
    order.atualizadoEmMs = Date.now();
    db.auditar?.({ tenantId: order.tenantId, acao: "STORE_PAYMENT_REVIEWED", orderId, decision, actor, motivo: cleanText(note, 300) });
    db.save();
    return { ok: true, pedido: order };
}

module.exports = {
    slugify, getStoreByTenant, configurarLoja, listarProdutos, criarProduto,
    atualizarProduto, catalogoPublico, criarPedidoPublico, listarPedidos,
    todosPedidos, resolverPagamento
};
