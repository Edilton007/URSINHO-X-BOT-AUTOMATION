// Rotas exclusivas do administrador da plataforma.
const express = require("express");
const router = express.Router();

const { autenticarAdmin } = require("../middleware/auth");
const tenantService = require("../services/tenantService");
const operationService = require("../services/operationService");
const storefrontService = require("../services/storefrontService");
const db = require("../database/automationDb");

router.use(autenticarAdmin);

router.post("/tenants", (req, res) => {
    const { nome } = req.body || {};
    const tenant = tenantService.criarTenant({ nome });
    if (tenant.error) return res.status(400).json({ ok: false, error: tenant.error });
    res.status(201).json({ ok: true, tenant: {
        id: tenant.id, nome: tenant.nome, apiKey: tenant.apiKey, ativo: tenant.ativo, criadoEmMs: tenant.criadoEmMs
    }});
});

router.post("/licencas", (req, res) => {
    const { dias } = req.body || {};
    const licenca = tenantService.gerarCodigoLicenca(dias);
    if (licenca.error) return res.status(400).json({ ok: false, error: licenca.error });
    res.status(201).json({ ok: true, licenca });
});

router.post("/tenants/:tenantId/devices", (req, res) => {
    const { deviceId } = req.body || {};
    if (!deviceId) return res.status(400).json({ ok: false, error: "deviceId em falta." });

    const device = tenantService.registrarDevice(req.params.tenantId, String(deviceId));
    if (device.error) return res.status(400).json({ ok: false, error: device.error });
    res.status(201).json({ ok: true, device: {
        id: device.id, tenantId: device.tenantId, apiKey: device.apiKey,
        autorizado: device.autorizado, registadoEmMs: device.registadoEmMs
    }});
});

router.post("/tenants/:tenantId/ativar-licenca", (req, res) => {
    const { codigo } = req.body || {};
    const resultado = tenantService.ativarLicenca(req.params.tenantId, codigo);
    if (resultado.error) return res.status(400).json({ ok: false, error: resultado.error });
    res.json({ ok: true, licenca: resultado.licenca });
});

// Fila de operações que exigem decisão humana. Apenas ADMIN_API_KEY pode consultar/resolver.
router.get("/tenants/:tenantId/revisoes", (req, res) => {
    const tenant = tenantService.getTenant(req.params.tenantId);
    if (!tenant) return res.status(404).json({ ok: false, error: "Tenant não encontrado." });

    const operacoes = operationService.listarOperacoes(req.params.tenantId)
        .filter((op) => op.estado === "PENDENTE_REVISAO");
    res.json({ ok: true, total: operacoes.length, operacoes });
});

// Visão global do Master/Admin. Campos secretos nunca são devolvidos nas listagens.
router.get("/overview", (req, res) => {
    const tenants = Object.values(db.tenants || {});
    const operations = Object.values(db.operations || {});
    const devices = Object.values(db.devices || {});
    const sims = Object.values(db.sims || {});
    const orders = Object.values(db.storeOrders || {});
    res.json({ ok: true, overview: {
        tenants: tenants.length,
        tenantsAtivos: tenants.filter(t => t.ativo !== false).length,
        devices: devices.length,
        devicesAutorizados: devices.filter(d => d.autorizado !== false).length,
        simsReportados: sims.length,
        operacoes: operations.length,
        operacoesEmExecucao: operations.filter(o => o.estado === "EXECUTANDO").length,
        operacoesEmRevisao: operations.filter(o => o.estado === "PENDENTE_REVISAO").length,
        pedidosLoja: orders.length,
        pagamentosPendentes: orders.filter(o => o.pagamentoEstado === "PENDENTE_VERIFICACAO").length
    }});
});

router.get("/tenants", (req, res) => {
    const tenants = Object.values(db.tenants || {}).map(t => {
        const licenca = t.licencaId ? db.licenseCodes[t.licencaId] : null;
        const device = t.deviceId ? db.devices[t.deviceId] : null;
        return {
            id: t.id, nome: t.nome, ativo: t.ativo !== false,
            criadoEmMs: t.criadoEmMs, licenca: licenca ? {
                codigo: licenca.codigo, estado: licenca.estado, expiraEmMs: licenca.expiraEmMs
            } : null,
            device: device ? { id: device.id, autorizado: device.autorizado !== false, ultimoContactoMs: device.ultimoContactoMs } : null
        };
    }).sort((a, b) => (b.criadoEmMs || 0) - (a.criadoEmMs || 0));
    res.json({ ok: true, tenants });
});

router.patch("/tenants/:tenantId/status", (req, res) => {
    const tenant = tenantService.getTenant(req.params.tenantId);
    if (!tenant) return res.status(404).json({ ok: false, error: "Tenant não encontrado." });
    if (typeof req.body?.ativo !== "boolean") return res.status(400).json({ ok: false, error: "Informe ativo como boolean." });
    tenant.ativo = req.body.ativo;
    db.auditar?.({ tenantId: tenant.id, acao: "TENANT_STATUS_ALTERADO", ativo: tenant.ativo, por: "admin" });
    db.save();
    res.json({ ok: true, tenant: { id: tenant.id, nome: tenant.nome, ativo: tenant.ativo } });
});

router.patch("/devices/:deviceId/status", (req, res) => {
    const device = db.devices[req.params.deviceId];
    if (!device) return res.status(404).json({ ok: false, error: "Device não encontrado." });
    if (typeof req.body?.autorizado !== "boolean") return res.status(400).json({ ok: false, error: "Informe autorizado como boolean." });
    device.autorizado = req.body.autorizado;
    db.auditar?.({ tenantId: device.tenantId, acao: "DEVICE_STATUS_ALTERADO", deviceId: device.id, autorizado: device.autorizado, por: "admin" });
    db.save();
    res.json({ ok: true, device: { id: device.id, tenantId: device.tenantId, autorizado: device.autorizado } });
});

router.get("/reviews", (req, res) => {
    const operacoes = Object.values(db.operations || {}).filter(o => o.estado === "PENDENTE_REVISAO")
        .sort((a, b) => (b.atualizadaEmMs || 0) - (a.atualizadaEmMs || 0));
    res.json({ ok: true, total: operacoes.length, operacoes });
});

router.get("/store-orders", (req, res) => {
    res.json({ ok: true, pedidos: storefrontService.todosPedidos() });
});

router.post("/store-orders/:orderId/payment-review", (req, res) => {
    const { decisao, motivo, referencia } = req.body || {};
    const result = storefrontService.resolverPagamento(req.params.orderId, decisao, motivo, referencia, "admin");
    if (result.error) return res.status(result.status || 400).json({ ok: false, error: result.error });
    res.json(result);
});

router.post("/tenants/:tenantId/operacoes/:opId/revisao", (req, res) => {
    const resultado = operationService.resolverRevisao(
        req.params.tenantId,
        req.params.opId,
        req.body || {},
        "admin"
    );

    if (resultado.error) {
        const status = resultado.code === "OPERACAO_NAO_ENCONTRADA" ? 404
            : resultado.code === "NAO_ESTA_EM_REVISAO" ? 409
            : 400;
        return res.status(status).json({ ok: false, code: resultado.code, error: resultado.error });
    }

    res.json({ ok: true, operacao: resultado.operacao });
});


// Consulta administrativa do histórico de auditoria do tenant.
// A rota permanece protegida pelo middleware ADMIN_API_KEY acima.
router.get("/tenants/:tenantId/auditoria", (req, res) => {
    const tenant = tenantService.getTenant(req.params.tenantId);
    if (!tenant) return res.status(404).json({ ok: false, error: "Tenant não encontrado." });
    const auditoria = (db.auditoria || [])
        .filter((item) => item.tenantId === req.params.tenantId)
        .slice(-200)
        .reverse();
    res.json({ ok: true, auditoria });
});

module.exports = router;
