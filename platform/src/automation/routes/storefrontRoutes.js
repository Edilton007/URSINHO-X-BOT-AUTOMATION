"use strict";

const express = require("express");
const router = express.Router();
const service = require("../services/storefrontService");
const db = require("../database/automationDb");
const tenantService = require("../services/tenantService");
const operationService = require("../services/operationService");

// Limitador simples em memória para pedidos públicos. Não depende de X-Forwarded-For.
const attempts = new Map();
function publicOrderLimit(req, res, next) {
    const key = String(req.socket?.remoteAddress || "unknown");
    const now = Date.now();
    const current = attempts.get(key) || { count: 0, resetAt: now + 60 * 60 * 1000 };
    if (now > current.resetAt) { current.count = 0; current.resetAt = now + 60 * 60 * 1000; }
    current.count += 1;
    attempts.set(key, current);
    if (attempts.size > 2000) {
        for (const [ip, value] of attempts) if (now > value.resetAt) attempts.delete(ip);
    }
    if (current.count > 20) return res.status(429).json({ ok: false, error: "Limite temporário de pedidos atingido. Tente novamente mais tarde." });
    next();
}

function normalizarDestino(valor) {
    let numero = String(valor || "").replace(/\D/g, "");
    if (numero.startsWith("258") && numero.length === 12) numero = numero.slice(3);
    return numero;
}

router.get("/:slug", (req, res) => {
    const result = service.catalogoPublico(req.params.slug);
    if (!result) return res.status(404).json({ ok: false, error: "Loja não encontrada ou não publicada." });
    res.json({ ok: true, ...result });
});

router.post("/:slug/orders", publicOrderLimit, (req, res) => {
    const input = req.body || {};
    const slug = req.params.slug;
    const idempotencyKey = req.get("x-idempotency-key");
    const catalog = service.catalogoPublico(slug);
    if (!catalog) {
        return res.status(404).json({ ok: false, error: "Loja não encontrada ou não publicada." });
    }

    const storefront = Object.values(db.storefronts || {}).find(item =>
        item.slug === slug && item.publicado === true && item.tenantId
    );
    if (!storefront) {
        return res.status(404).json({ ok: false, error: "Loja indisponível." });
    }

    // Um retry com a mesma chave devolve o pedido anterior, sem exigir
    // capacidade nova nem criar um segundo pedido.
    const previous = Object.values(db.storeOrders || {}).find(order =>
        order.tenantId === storefront.tenantId &&
        order.idempotencyKey === String(idempotencyKey || "").trim()
    );
    if (previous) {
        const destinoAnterior = normalizarDestino(previous.destino || previous.telefone);
        const destinoSolicitado = normalizarDestino(input.destino);
        if (destinoAnterior !== destinoSolicitado) {
            return res.status(409).json({
                ok: false,
                code: "IDEMPOTENCY_CONFLICT",
                error: "A chave deste pedido já foi usada com outro número de destino."
            });
        }
        const repeated = service.criarPedidoPublico(slug, input, idempotencyKey);
        if (repeated.error) {
            return res.status(repeated.status || 400).json({
                ok: false,
                error: repeated.error,
                code: repeated.code
            });
        }
        return res.status(200).json(repeated);
    }

    if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) {
        return res.status(400).json({ ok: false, code: "CART_INVALID", error: "Carrinho inválido." });
    }

    const produtos = new Map((catalog.produtos || []).map(product => [product.id, product]));
    let totalMB = 0;
    for (const item of input.items) {
        const product = produtos.get(String(item?.productId || ""));
        const quantity = Number(item?.quantity);
        if (!product) {
            return res.status(400).json({
                ok: false,
                code: "PRODUCT_UNAVAILABLE",
                error: "Um produto do carrinho já não está disponível."
            });
        }
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
            return res.status(400).json({ ok: false, code: "INVALID_QUANTITY", error: "Quantidade inválida." });
        }
        const quantidadeMB = Number(product.quantidadeMB);
        if (!Number.isSafeInteger(quantidadeMB) || quantidadeMB < 100) {
            return res.status(400).json({
                ok: false,
                code: "PACKAGE_NOT_TRANSFERABLE",
                error: "Este produto não tem uma quantidade mínima de 100 MB para transferência."
            });
        }
        totalMB += quantidadeMB * quantity;
        if (!Number.isSafeInteger(totalMB) || totalMB > 204800) {
            return res.status(400).json({
                ok: false,
                code: "ORDER_SIZE_LIMIT",
                error: "O pedido excede o limite operacional de 204.800 MB."
            });
        }
    }

    const device = tenantService.getDeviceDoTenant(storefront.tenantId);
    const disponibilidade = operationService.preverDisponibilidadePedido(
        storefront.tenantId,
        device?.id,
        totalMB,
        input.destino
    );
    if (!disponibilidade.disponivel) {
        return res.status(409).json({
            ok: false,
            code: disponibilidade.codigo || "CAPACITY_UNAVAILABLE",
            error: disponibilidade.motivo || "A capacidade operacional não está disponível neste momento.",
            disponivel: false
        });
    }

    const result = service.criarPedidoPublico(slug, input, idempotencyKey);
    if (result.error) {
        return res.status(result.status || 400).json({
            ok: false,
            error: result.error,
            code: result.code
        });
    }
    if (result.pedido) {
        result.pedido.destino = normalizarDestino(input.destino);
        db.save();
    }
    res.status(result.idempotente ? 200 : 201).json(result);
});

module.exports = router;
