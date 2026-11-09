"use strict";

const express = require("express");
const router = express.Router();
const service = require("../services/storefrontService");

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

router.get("/:slug", (req, res) => {
    const result = service.catalogoPublico(req.params.slug);
    if (!result) return res.status(404).json({ ok: false, error: "Loja não encontrada ou não publicada." });
    res.json({ ok: true, ...result });
});

router.post("/:slug/orders", publicOrderLimit, (req, res) => {
    const result = service.criarPedidoPublico(req.params.slug, req.body || {}, req.get("x-idempotency-key"));
    if (result.error) return res.status(result.status || 400).json({ ok: false, error: result.error, code: result.code });
    res.status(result.idempotente ? 200 : 201).json(result);
});

module.exports = router;
