// ============================================================
// tenantRoutes.js — NOVO
//
// As 6 rotas abaixo foram confirmadas lendo diretamente o
// código do painel Tenant recuperado (index.html, 6/10/2026):
//
//   GET  /automation/tenants/:tenantId
//   GET  /automation/tenants/:tenantId/licenca
//   GET  /automation/tenants/:tenantId/device
//   GET  /automation/tenants/:tenantId/operacoes
//   GET  /automation/tenants/:tenantId/sims
//   POST /automation/tenants/:tenantId/transferir
//
// Não são inventadas — é o contrato real que o frontend já
// recuperado espera.
// ============================================================

const express = require("express");
const router = express.Router({ mergeParams: true });

const { autenticarTenant } = require("../middleware/auth");
const tenantService = require("../services/tenantService");
const simTelemetryService = require("../services/simTelemetryService");
const operationService = require("../services/operationService");
const deviceHealthService = require("../services/deviceHealthService");

router.use("/:tenantId", autenticarTenant);

router.get("/:tenantId", (req, res) => {
    const resumo = tenantService.resumoTenant(req.params.tenantId);

    if (!resumo) {
        return res.status(404).json({ ok: false, error: "Tenant não encontrado." });
    }

    res.json({ ok: true, tenant: resumo });
});

router.get("/:tenantId/licenca", (req, res) => {
    const licenca = tenantService.getLicenca(req.params.tenantId);

    if (!licenca) {
        return res.status(404).json({ ok: false, error: "Sem licença associada." });
    }

    res.json({ ok: true, licenca });
});

// Lista permitida: o Tenant App só recebe estes campos do dispositivo.
// Qualquer campo novo no device fica de fora até ser autorizado aqui.
const CAMPOS_PUBLICOS_DEVICE = ["id", "tenantId", "autorizado", "online", "registadoEmMs", "ultimoContactoMs"];

function deviceParaTenant(device) {
    const publico = {};
    for (const campo of CAMPOS_PUBLICOS_DEVICE) {
        if (device && device[campo] !== undefined) publico[campo] = device[campo];
    }
    return publico;
}

router.get("/:tenantId/saude", (req, res) => {
    res.json({ ok: true, saude: deviceHealthService.avaliarTenant(req.params.tenantId) });
});

router.get("/:tenantId/device", (req, res) => {
    const device = tenantService.getDeviceDoTenant(req.params.tenantId);

    if (!device) {
        // 404 é esperado pelo frontend (já recuperado) quando
        // ainda não há device associado — não é erro grave.
        return res.status(404).json({ ok: false, error: "Nenhum dispositivo associado." });
    }

    res.json({ ok: true, device: deviceParaTenant(device) });
});

function operacaoParaTenant(operacao) {
    const { claimToken, claimDeviceId, leaseExpiresAtMs, ...publica } = operacao;
    return publica;
}

router.get("/:tenantId/operacoes", (req, res) => {
    const operacoes = operationService.listarOperacoes(req.params.tenantId).map(operacaoParaTenant);
    res.json({ ok: true, operacoes });
});

router.get("/:tenantId/sims", (req, res) => {
    const sims = simTelemetryService.listarSimsDoTenant(req.params.tenantId);

    if (sims.length === 0) {
        // Mesmo tratamento do device: 404 esperado, sem SIMs
        // ainda reportados — o painel trata isto como
        // "SEM TELEMETRIA", nunca inventa dados.
        return res.status(404).json({ ok: false, error: "Nenhum SIM reportado ainda." });
    }

    res.json({ ok: true, sims });
});

router.post("/:tenantId/transferir", (req, res) => {
    const { destino, megas } = req.body || {};
    const tenantId = req.params.tenantId;

    const device = tenantService.getDeviceDoTenant(tenantId);

    // Até 10.240 MB é uma operação normal; acima disso vira um pedido
    // dividido em suboperações (devolve também "pedido").
    const resultado = operationService.criarPedido(
        tenantId,
        device ? device.id : null,
        Number(megas),
        String(destino || "")
    );

    if (resultado.error) {
        return res.status(400).json({ ok: false, error: resultado.error });
    }

    res.json({ ok: true, operacao: resultado.operacao, pedido: resultado.pedido });
});

router.get("/:tenantId/pedidos", (req, res) => {
    res.json({ ok: true, pedidos: operationService.listarPedidos(req.params.tenantId) });
});

// Gestão da loja pública do tenant. O tenantId vem da rota autenticada;
// nunca é aceite do corpo do pedido.
const storefrontService = require("../services/storefrontService");

router.get("/:tenantId/storefront", (req, res) => {
    res.json({ ok: true, loja: storefrontService.getStoreByTenant(req.params.tenantId) });
});

router.put("/:tenantId/storefront", (req, res) => {
    const result = storefrontService.configurarLoja(req.params.tenantId, req.body || {});
    if (result.error) return res.status(400).json({ ok: false, error: result.error });
    res.json(result);
});

router.get("/:tenantId/products", (req, res) => {
    res.json({ ok: true, produtos: storefrontService.listarProdutos(req.params.tenantId, true) });
});

router.post("/:tenantId/products", (req, res) => {
    const result = storefrontService.criarProduto(req.params.tenantId, req.body || {});
    if (result.error) return res.status(400).json({ ok: false, error: result.error });
    res.status(201).json(result);
});

router.patch("/:tenantId/products/:productId", (req, res) => {
    const result = storefrontService.atualizarProduto(req.params.tenantId, req.params.productId, req.body || {});
    if (result.error) return res.status(404).json({ ok: false, error: result.error });
    res.json(result);
});

router.get("/:tenantId/store-orders", (req, res) => {
    res.json({ ok: true, pedidos: storefrontService.listarPedidos(req.params.tenantId) });
});



const customerIdentityService = require("../services/customerIdentityService");

// Associação de grupos: o Tenant gera um código temporário;
// o Bot só conclui a associação depois de observar esse código no grupo.
router.post("/:tenantId/whatsapp/groups/pairing", (req, res) => {
    const result = customerIdentityService.criarCodigoAssociacaoGrupo(
        req.params.tenantId,
        req.body?.ttlMs
    );
    if (result.error) return res.status(400).json({ ok: false, error: result.error });
    res.status(201).json(result);
});

router.get("/:tenantId/whatsapp/groups", (req, res) => {
    res.json({
        ok: true,
        grupos: customerIdentityService.listarGruposDoTenant(req.params.tenantId)
    });
});

router.delete("/:tenantId/whatsapp/groups/:groupId", (req, res) => {
    const result = customerIdentityService.removerGrupo(req.params.tenantId, req.params.groupId);
    if (result.error) return res.status(404).json({ ok: false, error: result.error });
    res.json(result);
});

module.exports = router;
