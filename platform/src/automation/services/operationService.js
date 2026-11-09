const crypto = require("crypto");
const db = require("../database/automationDb");
const simTelemetryService = require("./simTelemetryService");

const LIMITE_DIARIO_PADRAO = 10;
const MEGAS_MIN = 100;
const MEGAS_MAX = 10240;
const LEASE_DURACAO_MS = 5 * 60 * 1000;

// Teto de um pedido principal (dividido em suboperações de até MEGAS_MAX).
const PEDIDO_MAX_MB =
    Number.isInteger(Number(process.env.PEDIDO_MAX_MB)) && Number(process.env.PEDIDO_MAX_MB) >= MEGAS_MAX
        ? Number(process.env.PEDIDO_MAX_MB)
        : 204800;

function genId(prefixo) {
    return `${prefixo}-${crypto.randomBytes(16).toString("hex").toUpperCase()}`;
}

function adicionarHistorico(op, estado, agora, detalhe) {
    if (!Array.isArray(op.historico)) op.historico = [];
    const item = { estado, emMs: agora };
    if (detalhe) item.detalhe = detalhe;
    op.historico.push(item);
}

function validarPedido(tenantId, deviceId, megas, destino, opcoes = {}) {
    const maxMegas = opcoes.maxMegas || MEGAS_MAX;
    if (!tenantId || typeof tenantId !== "string") return "tenantId inválido.";

    const tenant = db.tenants[tenantId];
    if (!tenant) return "Tenant não encontrado.";
    if (tenant.ativo === false) return "Tenant está desativado.";

    const device = deviceId ? db.devices[deviceId] : null;
    if (!device || device.tenantId !== tenantId || device.autorizado === false) {
        return "Nenhum Device autorizado está associado a este Tenant.";
    }

    const licenca = tenant.licencaId ? db.licenseCodes[tenant.licencaId] : null;
    if (!licenca || licenca.estado !== "ATIVA") return "Licença do tenant não está ativa.";
    if (typeof licenca.expiraEmMs === "number" && Date.now() >= licenca.expiraEmMs) {
        licenca.estado = "EXPIRADA";
        db.save();
        return "Licença do tenant expirou.";
    }

    if (typeof megas !== "number" || !Number.isInteger(megas) || megas < MEGAS_MIN || megas > maxMegas) {
        return `Quantidade inválida. Use um valor inteiro entre ${MEGAS_MIN} e ${maxMegas} MB.`;
    }

    if (typeof destino !== "string" || !/^\d{9,12}$/.test(destino)) return "Número de destino inválido.";
    return null;
}

function criarTransferencia(tenantId, deviceId, megas, destino, metadata = {}) {
    const erroValidacao = validarPedido(tenantId, deviceId, megas, destino);
    if (erroValidacao) return { error: erroValidacao };

    if (metadata && metadata.externalOrderId !== undefined && !String(metadata.externalOrderId).trim()) {
        return { error: "externalOrderId inválido." };
    }

    const extra = montarMetadata(metadata || {});

    // Idempotência: repetir o mesmo externalOrderId devolve a operação existente.
    if (extra.externalOrderId) {
        const anterior = Object.values(db.operations).find(
            (op) => op.tenantId === tenantId && op.externalOrderId === extra.externalOrderId
        );
        if (anterior) {
            const mesmosDados =
                String(anterior.deviceId) === String(deviceId) &&
                Number(anterior.megas) === Number(megas) &&
                String(anterior.destino) === String(destino) &&
                String(anterior.paymentReference || "") === String(extra.paymentReference || "") &&
                String(anterior.paymentOperator || "") === String(extra.paymentOperator || "") &&
                String(anterior.grupoWhatsApp || "") === String(extra.grupoWhatsApp || "") &&
                String(anterior.clienteWhatsApp || "") === String(extra.clienteWhatsApp || "");
            if (!mesmosDados) {
                return { error: "externalOrderId já utilizado com dados comerciais diferentes. Verifique a referência de pagamento; nenhuma nova transferência foi criada.", code: "EXTERNAL_ORDER_CONFLICT" };
            }
            return { ...anterior, idempotente: true };
        }
    }

    const opId = genId("OP");
    const agora = Date.now();
    const permitido = execucaoPermitida();
    const simEscolhido = permitido
        ? simTelemetryService.escolherSimElegivel(tenantId, deviceId, megas, LIMITE_DIARIO_PADRAO)
        : null;

    if (!simEscolhido) {
        db.operations[opId] = {
            id: opId,
            tenantId,
            deviceId,
            tipo: "TRANSFERENCIA_INTERNET",
            megas,
            destino,
            estado: "PENDENTE",
            simId: null,
            simSlot: null,
            subscriptionId: null,
            criadaEmMs: agora,
            iniciadaEmMs: null,
            finalizadaEmMs: null,
            atualizadaEmMs: agora,
            historico: [
                { estado: "CRIADA", emMs: agora },
                { estado: "PENDENTE", emMs: agora }
            ],
            taskId: null,
            motivoPendente: permitido
                ? "Nenhum SIM Vodacom com telemetria válida, subscriptionId conhecido, internet livre e limite diário disponível."
                : "Execução desativada no servidor (AUTOMATION_ALLOW_EXECUTION=false)."
        };
        Object.assign(db.operations[opId], extra);
        db.save();
        return db.operations[opId];
    }

    const taskId = genId("TASK");
    const simId = simEscolhido.simId;

    db.operations[opId] = {
        id: opId,
        tenantId,
        deviceId,
        tipo: "TRANSFERENCIA_INTERNET",
        megas,
        destino,
        estado: "AGUARDANDO_EXECUCAO",
        simId,
        simSlot: simEscolhido.slot,
        subscriptionId: simEscolhido.subscriptionId,
        criadaEmMs: agora,
        iniciadaEmMs: null,
        finalizadaEmMs: null,
        atualizadaEmMs: agora,
        historico: [{ estado: "CRIADA", emMs: agora }],
        taskId
    };

    db.pendingTasks[taskId] = {
        id: taskId,
        opId,
        tenantId,
        deviceId,
        tipo: "TRANSFERENCIA_INTERNET",
        megas,
        destino,
        simId,
        simSlot: simEscolhido.slot,
        subscriptionId: simEscolhido.subscriptionId,
        estado: "AGUARDANDO_EXECUCAO",
        criadaEmMs: agora
    };

    Object.assign(db.operations[opId], extra);
    db.save();
    return db.operations[opId];
}

/**
 * Um lease expirado NUNCA devolve a tarefa à fila. Uma operação cujo Agent
 * pode ter executado USSD passa para revisão. A evidência tardia do MESMO
 * claim ainda pode ser reconciliada; um segundo claim/USSD não é autorizado.
 */
function reconciliarLeasesExpirados(agora = Date.now()) {
    let alterou = false;

    for (const task of Object.values(db.pendingTasks || {})) {
        const op = db.operations[task.opId];
        if (!op || op.estado !== "EXECUTANDO") continue;
        if (typeof op.leaseExpiresAtMs !== "number" || agora < op.leaseExpiresAtMs) continue;

        op.estado = "PENDENTE_REVISAO";
        op.motivoPendenteRevisao = "LEASE_EXPIRADO_SEM_EVIDENCIA";
        op.atualizadaEmMs = agora;
        task.estado = "PENDENTE_REVISAO";
        task.leaseExpiradoEmMs = agora;
        adicionarHistorico(op, "PENDENTE_REVISAO", agora, "Lease expirado. Tarefa bloqueada para impedir execução duplicada.");
        alterou = true;
    }

    if (alterou) db.save();
    return alterou;
}

function tarefasPendentes(deviceId) {
    if (!execucaoPermitida()) return [];

    reconciliarLeasesExpirados();

    return Object.values(db.pendingTasks)
        .filter((task) => {
            if (String(task.deviceId) !== String(deviceId)) return false;
            if (task.estado && task.estado !== "AGUARDANDO_EXECUCAO") return false;
            const op = db.operations[task.opId];
            if (!op || op.estado !== "AGUARDANDO_EXECUCAO") return false;

            const sim = simTelemetryService.obterSimOperacional(task.deviceId, task.simSlot);
            if (!sim || sim.tenantId !== task.tenantId) return false;
            if (!simTelemetryService.telemetriaRecente(sim.atualizadoEmMs)) return false;
            if (task.subscriptionId != null && task.subscriptionId !== sim.subscriptionId) return false;
            return true;
        })
        .map((task) => {
            const sim = simTelemetryService.obterSimOperacional(task.deviceId, task.simSlot);
            return {
                ...task,
                simId: task.simId || sim.simId,
                subscriptionId: sim.subscriptionId
            };
        });
}

function validarSimDaTarefa(task, op) {
    const sim = simTelemetryService.obterSimOperacional(task.deviceId, task.simSlot);
    if (!sim) return { error: "SIM Vodacom operacional não encontrado para o slot reservado." };
    if (sim.tenantId !== task.tenantId || sim.deviceId !== task.deviceId) {
        return { error: "SIM não pertence ao Tenant/Device da tarefa." };
    }
    if (sim.simId !== `${task.deviceId}-SLOT${task.simSlot}`) {
        return { error: "Identidade do SIM não corresponde ao identificador reservado." };
    }
    if (task.simId && task.simId !== sim.simId) return { error: "simId da tarefa diverge do SIM registado." };
    if (task.subscriptionId != null && task.subscriptionId !== sim.subscriptionId) {
        return { error: "subscriptionId mudou desde a criação da tarefa. Execução bloqueada." };
    }
    if (!simTelemetryService.telemetriaRecente(sim.atualizadoEmMs)) {
        return { error: "Telemetria do SIM expirou. A tarefa não será executada com leitura antiga." };
    }
    if (op.subscriptionId != null && op.subscriptionId !== sim.subscriptionId) {
        return { error: "subscriptionId da operação diverge do SIM atualmente registado." };
    }
    return { sim };
}

function iniciarTarefa(deviceId, taskId) {
    if (!execucaoPermitida()) {
        return { error: "Execução automatizada está desativada no servidor.", code: "EXECUCAO_DESATIVADA" };
    }

    reconciliarLeasesExpirados();

    const task = db.pendingTasks[taskId];
    if (!task) return { error: "Tarefa não encontrada ou já processada.", code: "TASK_NOT_FOUND" };
    if (String(task.deviceId) !== String(deviceId)) {
        return { error: "Esta tarefa não pertence a este dispositivo.", code: "DEVICE_MISMATCH" };
    }

    const op = db.operations[task.opId];
    if (!op) return { error: "Operação associada não encontrada.", code: "OPERATION_NOT_FOUND" };
    if (op.deviceId !== deviceId || op.tenantId !== task.tenantId) {
        return { error: "Associação Tenant/Device da operação inválida.", code: "OWNERSHIP_MISMATCH" };
    }

    // Segurança contra duplicação: não devolver um claim ativo para permitir
    // ao Agent voltar a executar o mesmo USSD após timeout/reinício.
    if (op.estado === "EXECUTANDO" || op.estado === "PENDENTE_REVISAO" || task.estado === "EXECUTANDO" || task.estado === "PENDENTE_REVISAO") {
        return { error: "Esta tarefa já foi reclamada ou está em revisão. Não será autorizada uma segunda execução.", code: "TASK_ALREADY_CLAIMED" };
    }

    if (op.estado !== "AGUARDANDO_EXECUCAO" || (task.estado && task.estado !== "AGUARDANDO_EXECUCAO")) {
        return { error: `A operação não pode ser iniciada no estado atual: ${op.estado}.`, code: "INVALID_STATE" };
    }

    const validacaoSim = validarSimDaTarefa(task, op);
    if (validacaoSim.error) return { error: validacaoSim.error, code: "SIM_NOT_READY" };

    const agora = Date.now();
    const claimToken = genId("CLAIM");

    op.estado = "EXECUTANDO";
    op.claimToken = claimToken;
    op.claimDeviceId = deviceId;
    op.leaseExpiresAtMs = agora + LEASE_DURACAO_MS;
    op.iniciadaEmMs = op.iniciadaEmMs || agora;
    op.atualizadaEmMs = agora;
    op.simId = validacaoSim.sim.simId;
    op.simSlot = validacaoSim.sim.slot;
    op.subscriptionId = validacaoSim.sim.subscriptionId;
    task.estado = "EXECUTANDO";
    task.claimedEmMs = agora;
    adicionarHistorico(op, "EXECUTANDO", agora);
    db.save();

    return {
        ok: true,
        claimToken,
        leaseExpiresAtMs: op.leaseExpiresAtMs,
        simId: validacaoSim.sim.simId,
        simSlot: validacaoSim.sim.slot,
        subscriptionId: validacaoSim.sim.subscriptionId,
        estado: op.estado,
        idempotente: false
    };
}

function registrarResultadoInterno(taskId, dados) {
    const {
        deviceId,
        claimToken,
        simId,
        simSlot,
        subscriptionId,
        saldoAntesMB,
        saldoDepoisMB,
        sucessoRedeReportado,
        logBruto
    } = dados || {};

    reconciliarLeasesExpirados();

    const task = db.pendingTasks[taskId];
    if (!task) return { error: "Tarefa não encontrada ou resultado já registado.", code: "TASK_NOT_FOUND" };

    if (typeof claimToken !== "string" || !claimToken.trim()) {
        return { error: "claimToken obrigatório.", code: "CLAIM_REQUIRED" };
    }
    if (claimToken !== db.operations[task.opId]?.claimToken) {
        return { error: "claimToken não corresponde à execução autorizada.", code: "CLAIM_MISMATCH" };
    }
    if (!deviceId || String(task.deviceId) !== String(deviceId)) {
        return { error: "O Device autenticado não é o proprietário desta tarefa.", code: "DEVICE_MISMATCH" };
    }

    const op = db.operations[task.opId];
    if (!op) return { error: "Operação associada não encontrada.", code: "OPERATION_NOT_FOUND" };
    if (op.claimDeviceId !== deviceId || op.deviceId !== deviceId) {
        return { error: "Claim não pertence ao Device autenticado.", code: "CLAIM_DEVICE_MISMATCH" };
    }

    const slotEsperado = task.simSlot;
    const simIdEsperado = task.simId || `${task.deviceId}-SLOT${slotEsperado}`;
    const subscriptionEsperado = task.subscriptionId ?? op.subscriptionId;

    if (simId !== simIdEsperado) return { error: "simId reportado não corresponde ao SIM escolhido pelo Backend.", code: "SIM_ID_MISMATCH" };
    if (!Number.isInteger(simSlot) || simSlot !== slotEsperado) return { error: "simSlot reportado não corresponde ao SIM escolhido pelo Backend.", code: "SIM_SLOT_MISMATCH" };
    if (!Number.isInteger(subscriptionId) || subscriptionId !== subscriptionEsperado) {
        return { error: "subscriptionId reportado não corresponde à subscrição autorizada pelo Backend.", code: "SUBSCRIPTION_MISMATCH" };
    }

    const leaseExpiradoEmRevisao =
        op.estado === "PENDENTE_REVISAO" &&
        op.motivoPendenteRevisao === "LEASE_EXPIRADO_SEM_EVIDENCIA";
    if (op.estado !== "EXECUTANDO" && !leaseExpiradoEmRevisao) {
        return { error: `Resultado rejeitado. Estado atual: ${op.estado}.`, code: "INVALID_RESULT_STATE" };
    }

    const saldoAntesValido = Number.isInteger(saldoAntesMB) && saldoAntesMB >= 0;
    const saldoDepoisValido = Number.isInteger(saldoDepoisMB) && saldoDepoisMB >= 0;
    let estadoFinal = "PENDENTE_REVISAO";
    let diferenca = null;

    let motivoRevisao = null;

    if (saldoAntesValido && saldoDepoisValido) {
        diferenca = saldoAntesMB - saldoDepoisMB;

        // A diferença de saldo sozinha não conclui. A rede também tem de
        // ter confirmado o sucesso de forma explícita (true). Ausente ou
        // nulo significa "resultado desconhecido" e vai para revisão.
        if (diferenca === op.megas && sucessoRedeReportado === true) {
            estadoFinal = "CONCLUIDA";
        } else if (diferenca === 0 && sucessoRedeReportado === false) {
            estadoFinal = "FALHOU";
        } else if (diferenca === op.megas) {
            motivoRevisao = "Saldo compatível, mas a rede não confirmou o sucesso (sucessoRedeReportado ausente ou nulo).";
        } else {
            motivoRevisao = `Diferença observada (${diferenca} MB) diferente da quantidade pedida (${op.megas} MB).`;
        }
    } else {
        motivoRevisao = "Leitura de saldo antes e/ou depois ausente ou inválida.";
    }

    const agora = Date.now();
    op.estado = estadoFinal;
    op.saldoAntesMB = saldoAntesValido ? saldoAntesMB : null;
    op.saldoDepoisMB = saldoDepoisValido ? saldoDepoisMB : null;
    op.diferencaObservadaMB = diferenca;
    op.sucessoRedeReportado = typeof sucessoRedeReportado === "boolean" ? sucessoRedeReportado : null;
    const logTexto = typeof logBruto === "string" ? logBruto : null;
    op.logBruto = logTexto ? logTexto.slice(0, 12000) : null;
    op.motivoRevisao = estadoFinal === "PENDENTE_REVISAO" ? motivoRevisao : null;
    op.evidencias = {
        logBrutoTamanho: logTexto ? logTexto.length : 0,
        logBrutoTruncado: logTexto ? logTexto.length > 12000 : false,
        logBrutoSha256: logTexto ? crypto.createHash("sha256").update(logTexto).digest("hex") : null,
        diferencaObservadaMB: diferenca,
        quantidadePedidaMB: op.megas,
        deviceId,
        simId,
        simSlot,
        subscriptionId,
        recebidaEmMs: agora,
        saldoAntesMB: saldoAntesValido ? saldoAntesMB : null,
        saldoDepoisMB: saldoDepoisValido ? saldoDepoisMB : null,
        sucessoRedeReportado: typeof sucessoRedeReportado === "boolean" ? sucessoRedeReportado : null
    };
    op.finalizadaEmMs = agora;
    op.atualizadaEmMs = agora;
    op.leaseExpiresAtMs = null;
    adicionarHistorico(op, estadoFinal, agora, leaseExpiradoEmRevisao ? "Evidência tardia reconciliada pelo mesmo claim." : null);

    if (saldoDepoisValido) {
        // A leitura pós-USSD é uma observação mais recente do recurso que a
        // telemetria anterior. Atualiza o inventário sem misturar saldo MT.
        simTelemetryService.registrarLeituraInternet(
            deviceId,
            simSlot,
            subscriptionId,
            saldoDepoisMB,
            agora,
            false
        );
    }

    if (estadoFinal === "CONCLUIDA") {
        simTelemetryService.registrarTransferenciaConcluida(deviceId, simSlot, subscriptionId, op.id, false);
    }

    delete db.pendingTasks[taskId];
    db.save();

    return { ok: true, estado: estadoFinal, operacao: op };
}


// ============================================================
// FASE 2: PENDENTES, PEDIDOS GRANDES E REVISÃO MANUAL
// ============================================================

function execucaoPermitida() {
    return String(process.env.AUTOMATION_ALLOW_EXECUTION || "false").toLowerCase() === "true";
}

function montarMetadata(metadata = {}) {
    const corta = (v, n) => (v ? String(v).slice(0, n) : null);
    return {
        externalOrderId: metadata.externalOrderId ? String(metadata.externalOrderId).trim().slice(0, 128) : null,
        paymentReference: corta(metadata.paymentReference, 160),
        paymentOperator: corta(metadata.paymentOperator, 40),
        origem: metadata.origem ? corta(metadata.origem, 64) : "TENANT_APP",
        grupoWhatsApp: corta(metadata.grupoWhatsApp, 128),
        clienteWhatsApp: corta(metadata.clienteWhatsApp, 128),
        autorizadoPor: corta(metadata.autorizadoPor, 128)
    };
}

const ESTADOS_ATIVOS = ["AGUARDANDO_EXECUCAO", "EXECUTANDO", "PENDENTE_REVISAO"];

function obterOperacao(opId) {
    return Object.prototype.hasOwnProperty.call(db.operations, opId) ? db.operations[opId] : null;
}

function alocarTarefa(op, sim, agora) {
    const taskId = genId("TASK");

    op.estado = "AGUARDANDO_EXECUCAO";
    op.simId = sim.simId;
    op.simSlot = sim.slot;
    op.subscriptionId = sim.subscriptionId;
    op.taskId = taskId;
    op.atualizadaEmMs = agora;
    delete op.motivoPendente;
    adicionarHistorico(op, "AGUARDANDO_EXECUCAO", agora, "SIM escolhido pelo Backend.");

    db.pendingTasks[taskId] = {
        id: taskId,
        opId: op.id,
        tenantId: op.tenantId,
        deviceId: op.deviceId,
        tipo: op.tipo,
        megas: op.megas,
        destino: op.destino,
        simId: sim.simId,
        simSlot: sim.slot,
        subscriptionId: sim.subscriptionId,
        estado: "AGUARDANDO_EXECUCAO",
        criadaEmMs: agora
    };
}

/** Uma suboperação só avança quando todas as anteriores estão CONCLUIDA e nenhuma está ativa. */
function podeAvancarSubop(op) {
    const pedido = db.pedidos[op.pedidoId];
    if (!pedido) return true;

    for (const id of pedido.subOps) {
        const outra = db.operations[id];
        if (!outra || outra.id === op.id) continue;
        if (outra.seq < op.seq && outra.estado !== "CONCLUIDA") return false;
        if (ESTADOS_ATIVOS.includes(outra.estado)) return false;
    }

    return true;
}

/**
 * Tenta dar SIM e tarefa às operações PENDENTE (as mais antigas primeiro).
 * Corre quando chega telemetria, quando uma operação termina, quando uma
 * revisão é resolvida e a cada minuto. Devolve quantas foram alocadas.
 */
function reprocessarPendentes(tenantId = null) {
    if (!execucaoPermitida()) return 0;

    reconciliarLeasesExpirados();

    const agora = Date.now();

    const pendentes = Object.values(db.operations)
        .filter((op) =>
            op.estado === "PENDENTE" &&
            !op.taskId &&
            (!tenantId || op.tenantId === tenantId)
        )
        .sort((a, b) => (a.criadaEmMs - b.criadaEmMs) || ((a.seq || 0) - (b.seq || 0)));

    let alocadas = 0;
    let alterou = false;

    for (const op of pendentes) {
        if (op.pedidoId && !podeAvancarSubop(op)) continue;

        const erro = validarPedido(op.tenantId, op.deviceId, op.megas, op.destino);

        if (erro) {
            if (op.motivoPendente !== erro) {
                op.motivoPendente = erro;
                alterou = true;
            }
            continue;
        }

        const sim = simTelemetryService.escolherSimElegivel(
            op.tenantId,
            op.deviceId,
            op.megas,
            LIMITE_DIARIO_PADRAO
        );

        if (!sim) continue;

        alocarTarefa(op, sim, agora);
        alocadas++;
        alterou = true;
    }

    if (alterou) db.save();

    return alocadas;
}

function registrarResultado(taskId, dados) {
    const tarefa = Object.prototype.hasOwnProperty.call(db.pendingTasks, taskId)
        ? db.pendingTasks[taskId]
        : null;
    const tenantId = tarefa ? tarefa.tenantId : null;

    const resultado = registrarResultadoInterno(taskId, dados);

    if (resultado && resultado.error) {
        db.auditar({
            tenantId,
            acao: "RESULTADO_REJEITADO",
            taskId: String(taskId).slice(0, 64),
            operacaoId: tarefa ? tarefa.opId : null,
            deviceId: dados && dados.deviceId ? String(dados.deviceId).slice(0, 64) : null,
            code: resultado.code || null
        });
        db.save();
    }

    if (tenantId && resultado && !resultado.error) {
        try {
            reprocessarPendentes(tenantId);
        } catch (err) {
            console.error("Erro ao reprocessar pendentes:", err?.message || err);
        }
    }

    return resultado;
}

// ---------------- pedidos grandes (suboperações) ----------------

function dividirMegas(total) {
    const partes = Math.ceil(total / MEGAS_MAX);
    const base = Math.floor(total / partes);
    const resto = total % partes;
    return Array.from({ length: partes }, (_, i) => base + (i < resto ? 1 : 0));
}

function resumoPedido(pedido) {
    const subs = pedido.subOps.map((id) => db.operations[id]).filter(Boolean);
    const soma = (lista) => lista.reduce((t, o) => t + o.megas, 0);

    const porEstado = (...estados) => subs.filter((o) => estados.includes(o.estado));

    const confirmado = soma(porEstado("CONCLUIDA"));
    const emExecucao = soma(porEstado("AGUARDANDO_EXECUCAO", "EXECUTANDO"));
    const emRevisao = soma(porEstado("PENDENTE_REVISAO"));
    const falhado = soma(porEstado("FALHOU"));
    const naoProcessado = soma(porEstado("PENDENTE"));

    let estado = "PENDENTE";
    if (subs.length && subs.every((o) => o.estado === "CONCLUIDA")) estado = "CONCLUIDA";
    else if (falhado > 0) estado = "FALHOU";
    else if (emRevisao > 0) estado = "PENDENTE_REVISAO";

    return {
        id: pedido.id,
        tenantId: pedido.tenantId,
        destino: pedido.destino,
        estado,
        megasSolicitados: pedido.megasSolicitados,
        megasDivididos: soma(subs),
        megasConfirmados: confirmado,
        megasEmExecucao: emExecucao,
        megasEmRevisao: emRevisao,
        megasFalhados: falhado,
        megasNaoProcessados: naoProcessado,
        megasPendentes: pedido.megasSolicitados - confirmado,
        criadoEmMs: pedido.criadoEmMs,
        suboperacoes: subs.map((o) => ({
            id: o.id,
            seq: o.seq,
            megas: o.megas,
            estado: o.estado,
            simSlot: o.simSlot
        }))
    };
}

/**
 * Cria um pedido. Até 10.240 MB é uma operação normal. Acima disso o Backend
 * divide em suboperações (cada uma com o seu SIM, tarefa e validação), que
 * avançam uma de cada vez.
 */
function criarPedido(tenantId, deviceId, megas, destino) {
    const erro = validarPedido(tenantId, deviceId, megas, destino, { maxMegas: PEDIDO_MAX_MB });
    if (erro) return { error: erro };

    if (megas <= MEGAS_MAX) {
        const operacao = criarTransferencia(tenantId, deviceId, megas, destino);
        return operacao.error ? operacao : { operacao };
    }

    const agora = Date.now();
    const pedidoId = genId("PED");
    const partes = dividirMegas(megas);
    const subOps = [];

    partes.forEach((mb, i) => {
        const opId = genId("OP");

        db.operations[opId] = {
            id: opId,
            tenantId,
            deviceId,
            tipo: "TRANSFERENCIA_INTERNET",
            megas: mb,
            destino,
            estado: "PENDENTE",
            simId: null,
            simSlot: null,
            subscriptionId: null,
            pedidoId,
            seq: i + 1,
            totalPartes: partes.length,
            criadaEmMs: agora,
            iniciadaEmMs: null,
            finalizadaEmMs: null,
            atualizadaEmMs: agora,
            historico: [
                { estado: "CRIADA", emMs: agora },
                { estado: "PENDENTE", emMs: agora }
            ],
            taskId: null,
            motivoPendente: i === 0
                ? "Aguardando SIM Vodacom elegível."
                : "Aguardando a conclusão validada da suboperação anterior."
        };

        subOps.push(opId);
    });

    db.pedidos[pedidoId] = {
        id: pedidoId,
        tenantId,
        deviceId,
        destino,
        megasSolicitados: megas,
        subOps,
        criadoEmMs: agora
    };

    db.save();

    reprocessarPendentes(tenantId);

    return {
        pedido: resumoPedido(db.pedidos[pedidoId]),
        operacao: db.operations[subOps[0]]
    };
}

function listarPedidos(tenantId) {
    return Object.values(db.pedidos)
        .filter((p) => p.tenantId === tenantId)
        .sort((a, b) => b.criadoEmMs - a.criadoEmMs)
        .map(resumoPedido);
}

// ---------------- revisão manual ----------------

/**
 * Resolve uma operação em PENDENTE_REVISAO com uma decisão humana auditada.
 * CONFIRMAR: conta como concluída (e consome 1 transferência diária do SIM).
 * FALHOU: marca como falhada e liberta a capacidade reservada.
 * A tarefa e o claim são invalidados: evidência que chegue depois é recusada.
 */
function resolverRevisao(tenantId, opId, dados = {}, autor = "tenant") {
    const op = obterOperacao(opId);

    if (!op || op.tenantId !== tenantId) {
        return { error: "Operação não encontrada.", code: "OPERACAO_NAO_ENCONTRADA" };
    }

    if (op.estado !== "PENDENTE_REVISAO") {
        return { error: "A operação não está pendente de revisão.", code: "NAO_ESTA_EM_REVISAO" };
    }

    const decisao = String(dados.decisao || "").toUpperCase();

    if (decisao !== "CONFIRMAR" && decisao !== "FALHOU") {
        return { error: "Decisão inválida. Use CONFIRMAR ou FALHOU.", code: "DECISAO_INVALIDA" };
    }

    if (decisao === "CONFIRMAR" && autor !== "admin") {
        return {
            error: "Só o administrador pode confirmar uma operação em revisão.",
            code: "CONFIRMAR_SO_ADMIN"
        };
    }

    const motivo = String(dados.motivo || "").trim();

    if (motivo.length < 5) {
        return { error: "Indique o motivo da decisão (mínimo 5 caracteres).", code: "MOTIVO_OBRIGATORIO" };
    }

    const agora = Date.now();

    if (decisao === "CONFIRMAR") {
        const contador = simTelemetryService.registrarTransferenciaConcluida(
            op.deviceId, op.simSlot, op.subscriptionId, op.id, false
        );
        if (!contador || contador.ok !== true) {
            return {
                error: "Não foi possível validar a SIM/subscrição desta operação. A revisão continua pendente.",
                code: "SIM_COUNTER_FAILED"
            };
        }
        op.estado = "CONCLUIDA";
    } else {
        op.estado = "FALHOU";
    }

    op.finalizadaEmMs = agora;
    op.atualizadaEmMs = agora;
    op.claimToken = null;
    op.leaseExpiresAtMs = null;
    op.resolucaoManual = { decisao, motivo: motivo.slice(0, 300), por: autor, emMs: agora };
    adicionarHistorico(op, op.estado, agora, `Revisão manual (${autor}): ${decisao}. ${motivo.slice(0, 200)}`);

    if (op.taskId && Object.prototype.hasOwnProperty.call(db.pendingTasks, op.taskId)) {
        delete db.pendingTasks[op.taskId];
    }

    db.auditar({
        tenantId,
        acao: "REVISAO_RESOLVIDA",
        operacaoId: op.id,
        decisao,
        motivo: motivo.slice(0, 300),
        por: autor
    });

    db.save();

    reprocessarPendentes(tenantId);

    return { ok: true, operacao: op };
}

function listarOperacoes(tenantId) {
    reconciliarLeasesExpirados();
    return Object.values(db.operations)
        .filter((operation) => operation.tenantId === tenantId)
        .sort((a, b) => (b.atualizadaEmMs || b.criadaEmMs || 0) - (a.atualizadaEmMs || a.criadaEmMs || 0));
}

module.exports = {
    criarPedido,
    listarPedidos,
    resolverRevisao,
    reprocessarPendentes,
    criarTransferencia,
    tarefasPendentes,
    iniciarTarefa,
    registrarResultado,
    listarOperacoes,
    reconciliarLeasesExpirados,
    LEASE_DURACAO_MS
};
