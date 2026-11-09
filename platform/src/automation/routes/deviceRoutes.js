const express = require("express");
const router = express.Router({ mergeParams: true });

const { autenticarDevice } = require("../middleware/auth");
const tenantService = require("../services/tenantService");
const operationService = require("../services/operationService");
const simTelemetryService = require("../services/simTelemetryService");

router.use("/:deviceId", autenticarDevice);

function obterAcessoTenantAtivo(deviceId) {
    const tenantId = tenantService.getTenantDoDevice(deviceId);
    const tenant = tenantId ? tenantService.getTenant(tenantId) : null;
    const licenca = tenant ? tenantService.getLicenca(tenantId) : null;

    if (!tenant || tenant.ativo === false) {
        return { error: "Tenant inexistente ou desativado.", status: 403 };
    }
    if (!licenca || licenca.estado !== "ATIVA" ||
        (typeof licenca.expiraEmMs === "number" && Date.now() >= licenca.expiraEmMs)) {
        return { error: "Licença do tenant não está ativa.", status: 403 };
    }
    return { tenantId, tenant, licenca };
}

router.get("/:deviceId/tarefas", (req, res) => {
    const { deviceId } = req.params;
    const acesso = obterAcessoTenantAtivo(deviceId);
    if (acesso.error) return res.status(acesso.status).json({ ok: false, error: acesso.error });

    const tarefas = operationService.tarefasPendentes(deviceId).map((task) => ({
        id: task.id,
        opId: task.opId,
        megas: task.megas,
        destino: task.destino,
        simId: task.simId,
        simSlot: task.simSlot,
        subscriptionId: task.subscriptionId
    }));

    res.json({ ok: true, tarefas });
});

router.post("/:deviceId/tarefas/:taskId/iniciar", (req, res) => {
    const { deviceId, taskId } = req.params;
    const acesso = obterAcessoTenantAtivo(deviceId);
    if (acesso.error) return res.status(acesso.status).json({ ok: false, error: acesso.error });

    const resultado = operationService.iniciarTarefa(deviceId, taskId);
    if (resultado.error) {
        const status = resultado.code === "TASK_ALREADY_CLAIMED" ? 409
            : ["DEVICE_MISMATCH", "OWNERSHIP_MISMATCH"].includes(resultado.code) ? 403 : 400;
        return res.status(status).json({
            ok: false,
            code: resultado.code || "TASK_START_REJECTED",
            error: resultado.error
        });
    }

    res.json({
        ok: true,
        claimToken: resultado.claimToken,
        leaseExpiresAtMs: resultado.leaseExpiresAtMs,
        simId: resultado.simId,
        simSlot: resultado.simSlot,
        subscriptionId: resultado.subscriptionId,
        estado: resultado.estado,
        idempotente: false
    });
});

router.post("/:deviceId/tarefas/:taskId/resultado", (req, res) => {
    const { deviceId, taskId } = req.params;
    const {
        claimToken,
        simId,
        simSlot,
        subscriptionId,
        saldoAntesMB,
        saldoDepoisMB,
        sucessoRedeReportado,
        logBruto
    } = req.body || {};

    // A identidade do Device vem da chave autenticada, nunca do corpo enviado.
    const resultado = operationService.registrarResultado(taskId, {
        deviceId,
        claimToken,
        simId,
        simSlot,
        subscriptionId,
        saldoAntesMB,
        saldoDepoisMB,
        sucessoRedeReportado,
        logBruto
    });

    if (resultado.error) {
        const status = [
            "CLAIM_MISMATCH", "DEVICE_MISMATCH", "CLAIM_DEVICE_MISMATCH",
            "SIM_ID_MISMATCH", "SIM_SLOT_MISMATCH", "SUBSCRIPTION_MISMATCH"
        ].includes(resultado.code) ? 403 : 400;
        return res.status(status).json({
            ok: false,
            code: resultado.code || "RESULT_REJECTED",
            error: resultado.error
        });
    }

    res.json({ ok: true, estado: resultado.estado });
});

router.post("/:deviceId/sim-status", (req, res) => {
    const { deviceId } = req.params;
    const tenantId = tenantService.getTenantDoDevice(deviceId);
    if (!tenantId) return res.status(403).json({ ok: false, error: "Device sem Tenant associado." });

    const { slot, operadora, internetMB, saldoMT, subscriptionId } = req.body || {};
    const resultado = simTelemetryService.registrarStatus(tenantId, deviceId, {
        slot,
        operadora,
        internetMB,
        saldoMT,
        subscriptionId
    });

    if (resultado.error) {
        return res.status(422).json({ ok: false, error: resultado.error });
    }

    // Uma nova leitura pode tornar elegíveis operações anteriormente pendentes.
    let tarefasCriadas = 0;
    try {
        tarefasCriadas = operationService.reprocessarPendentes(tenantId);
    } catch (error) {
        console.error("Falha ao reprocessar operações após telemetria:", error?.message || error);
    }

    res.json({
        ok: true,
        sim: resultado.sim,
        subscriptionMudou: resultado.subscriptionMudou === true,
        tarefasCriadas
    });
});

module.exports = router;
