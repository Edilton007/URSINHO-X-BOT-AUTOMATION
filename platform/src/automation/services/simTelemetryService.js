const db = require("../database/automationDb");
const { diaOperacional } = require("../utils/diaOperacional");

const TELEMETRIA_ANTIGA_MIN = (() => {
    const n = Number(process.env.SIM_TELEMETRY_STALE_MIN);
    return Number.isFinite(n) && n >= 5 && n <= 1440 ? n : 45;
})();
const JANELA_ONLINE_MS = TELEMETRIA_ANTIGA_MIN * 60 * 1000;
const FUTURO_TOLERANCIA_MS = 120 * 1000;

function telemetriaRecente(timestamp, agora = Date.now()) {
    return Number.isSafeInteger(timestamp) && timestamp > 0 &&
        timestamp <= agora + FUTURO_TOLERANCIA_MS && agora - timestamp <= JANELA_ONLINE_MS;
}

function chaveSim(deviceId, slot) {
    return `${deviceId}-SLOT${slot}`;
}

function slotValido(slot) {
    return Number.isInteger(slot) && (slot === 0 || slot === 1);
}

function subscriptionIdValido(subscriptionId) {
    return Number.isInteger(subscriptionId) && subscriptionId >= 0;
}

function operadorVodacom(operadora) {
    const normalizada = String(operadora || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    // Nome do operador vem do Android Agent. Usar uma allowlist evita aceitar
    // etiquetas acidentais/malformadas como "NotVodacom" ou "Vodacom Fake".
    return new Set([
        "vodacom",
        "vodacom mz",
        "vodacom mocambique",
        "vodacom mozambique"
    ]).has(normalizada);
}

function chaveContador(deviceId, subscriptionId) {
    return `${deviceId}-SUB${subscriptionId}`;
}

function obterContador(deviceId, subscriptionId, simExistente, agora) {
    db.simCounters = db.simCounters || {};
    const id = chaveContador(deviceId, subscriptionId);
    const hojeStr = diaOperacional(agora);
    let contador = db.simCounters[id];

    if (!contador) {
        contador = {
            id,
            deviceId,
            subscriptionId,
            transferenciasHoje: simExistente &&
                (!Number.isInteger(simExistente.subscriptionId) || simExistente.subscriptionId === subscriptionId) &&
                simExistente.transferenciasData === hojeStr
                ? (simExistente.transferenciasHoje || 0)
                : 0,
            transferenciasData: hojeStr,
            operacoesConcluidas: []
        };
        db.simCounters[id] = contador;
    } else if (contador.transferenciasData !== hojeStr) {
        contador.transferenciasHoje = 0;
        contador.transferenciasData = hojeStr;
    }
    if (!Array.isArray(contador.operacoesConcluidas)) contador.operacoesConcluidas = [];

    return contador;
}

function colocarTarefasAntigasEmRevisao(simIdAntigo, motivo, agora) {
    for (const task of Object.values(db.pendingTasks || {})) {
        const idTask = task.simId || `${task.deviceId}-SLOT${task.simSlot}`;
        if (idTask !== simIdAntigo) continue;
        const op = db.operations[task.opId];
        if (!op || !["AGUARDANDO_EXECUCAO", "EXECUTANDO"].includes(op.estado)) continue;

        op.estado = "PENDENTE_REVISAO";
        op.motivoPendenteRevisao = motivo;
        op.atualizadaEmMs = agora;
        op.historico = Array.isArray(op.historico) ? op.historico : [];
        op.historico.push({ estado: "PENDENTE_REVISAO", emMs: agora, motivo });
        task.estado = "PENDENTE_REVISAO";
    }
}

/**
 * Soma os recursos já comprometidos em tarefas pendentes/em execução.
 * Isto impede que dois pedidos reservem simultaneamente a mesma internet
 * ou ultrapassem o limite diário usando a mesma leitura de telemetria.
 */
function reservasDoSim(simId, hojeStr) {
    let megasReservados = 0;
    let transferenciasReservadas = 0;
    const simAtual = db.sims[simId];
    const operacoesComTarefa = new Set();

    const mesmaSubscricao = (subscriptionId) =>
        !Number.isInteger(subscriptionId) ||
        !Number.isInteger(simAtual?.subscriptionId) ||
        subscriptionId === simAtual.subscriptionId;

    for (const task of Object.values(db.pendingTasks || {})) {
        if (task.simId && task.simId !== simId) continue;
        if (!task.simId && `${task.deviceId}-SLOT${task.simSlot}` !== simId) continue;
        if (!mesmaSubscricao(task.subscriptionId)) continue;

        const op = db.operations[task.opId];
        if (!op || op.estado === "CONCLUIDA" || op.estado === "FALHOU") continue;
        if (!["AGUARDANDO_EXECUCAO", "EXECUTANDO", "PENDENTE_REVISAO"].includes(op.estado)) continue;

        operacoesComTarefa.add(op.id);
        megasReservados += Number(task.megas) || 0;
        if (diaOperacional(task.criadaEmMs || 0) === hojeStr) {
            transferenciasReservadas += 1;
        }
    }

    // Uma operação em revisão sem tarefa pendente também reserva o recurso:
    // pode ter sido executada, mas ainda não há evidência para a confirmar.
    for (const op of Object.values(db.operations || {})) {
        if (operacoesComTarefa.has(op.id)) continue;
        if (op.simId !== simId || op.estado !== "PENDENTE_REVISAO") continue;
        if (!mesmaSubscricao(op.subscriptionId)) continue;

        megasReservados += Number(op.megas) || 0;
        if (diaOperacional(op.criadaEmMs || 0) === hojeStr) {
            transferenciasReservadas += 1;
        }
    }

    return { megasReservados, transferenciasReservadas };
}

function registrarStatus(tenantId, deviceId, dados) {
    const { slot, operadora, internetMB, saldoMT, subscriptionId } = dados || {};

    if (!tenantId || !deviceId) {
        return { error: "Tenant ou Device inválido." };
    }

    const device = db.devices[deviceId];
    if (!device || device.tenantId !== tenantId || device.autorizado === false) {
        return { error: "Device não pertence ao Tenant autenticado." };
    }

    if (!slotValido(slot)) {
        return { error: "slot inválido. Use 0 ou 1." };
    }

    if (!operadorVodacom(operadora)) {
        return { error: "Operadora não suportada para transferências Vodacom. SIM não registado como recurso operacional." };
    }

    if (typeof internetMB !== "number" || !Number.isFinite(internetMB) || internetMB < 0) {
        return { error: "internetMB deve ser uma leitura numérica real igual ou superior a zero." };
    }

    if (!subscriptionIdValido(subscriptionId)) {
        return { error: "subscriptionId inválido ou ausente. Atualize o Android Agent antes de reportar telemetria operacional." };
    }

    if (saldoMT !== null && saldoMT !== undefined &&
        (typeof saldoMT !== "number" || !Number.isFinite(saldoMT) || saldoMT < 0)) {
        return { error: "saldoMT inválido." };
    }

    const simId = chaveSim(deviceId, slot);
    const agora = Date.now();
    const existente = db.sims[simId] || {};

    const subscriptionMudou =
        Number.isInteger(existente.subscriptionId) &&
        existente.subscriptionId !== subscriptionId;

    if (subscriptionMudou) {
        colocarTarefasAntigasEmRevisao(simId, "SUBSCRIPTION_ID_ALTERADO", agora);
    }

    // Se a mesma subscrição aparecer agora noutro slot, as tarefas criadas
    // para o slot anterior são revistas. A contagem diária segue a subscrição,
    // não o slot físico.
    const mesmoSimNoutroSlot = Object.values(db.sims).find((item) =>
        item.deviceId === deviceId &&
        item.subscriptionId === subscriptionId &&
        item.slot !== slot
    );
    if (mesmoSimNoutroSlot) {
        colocarTarefasAntigasEmRevisao(mesmoSimNoutroSlot.simId, "SIM_MUDOU_DE_SLOT", agora);
        delete db.sims[mesmoSimNoutroSlot.simId];
    }

    const contador = obterContador(deviceId, subscriptionId, existente, agora);
    const hojeStr = diaOperacional(agora);

    db.sims[simId] = {
        simId,
        tenantId,
        deviceId,
        slot,
        subscriptionId,
        operadora: operadora.trim(),
        internetMB: Math.floor(internetMB),
        saldoMT: typeof saldoMT === "number" ? saldoMT : (existente.saldoMT ?? null),
        atualizadoEmMs: agora,
        transferenciasHoje: contador.transferenciasHoje,
        transferenciasData: hojeStr,
        simCounterId: contador.id
    };
    db.save();

    return { ok: true, sim: db.sims[simId], subscriptionMudou };
}

function registrarTransferenciaConcluida(deviceId, slot, subscriptionId, operationId = null, persistir = true) {
    if (!deviceId || !slotValido(slot) || !subscriptionIdValido(subscriptionId)) {
        return { ok: false, error: "deviceId, slot ou subscriptionId inválido." };
    }

    const agora = Date.now();
    const hojeStr = diaOperacional(agora);
    const sim = db.sims[chaveSim(deviceId, slot)] || null;
    const simCorresponde = !!sim && sim.subscriptionId === subscriptionId;

    // A contagem pertence à subscrição, não ao slot físico. Uma operação
    // validada pode terminar depois de o SIM mudar de slot; nesse caso a
    // contagem ainda é registada para a subscrição original.
    const contador = obterContador(
        deviceId,
        subscriptionId,
        simCorresponde ? sim : null,
        agora
    );

    const opId = operationId ? String(operationId).slice(0, 128) : null;
    if (opId && contador.operacoesConcluidas.includes(opId)) {
        return { ok: true, duplicada: true, sim: simCorresponde ? sim : null, contador };
    }

    contador.transferenciasHoje = (contador.transferenciasHoje || 0) + 1;
    contador.transferenciasData = hojeStr;
    if (opId) {
        contador.operacoesConcluidas.push(opId);
        // Limite de memória; tasks concluídas não podem ser submetidas de novo.
        if (contador.operacoesConcluidas.length > 10000) {
            contador.operacoesConcluidas.splice(0, contador.operacoesConcluidas.length - 10000);
        }
    }

    if (simCorresponde) {
        sim.transferenciasHoje = contador.transferenciasHoje;
        sim.transferenciasData = hojeStr;
        sim.simCounterId = contador.id;
    }

    if (persistir) db.save();
    return { ok: true, sim: simCorresponde ? sim : null, contador };
}

function registrarLeituraInternet(deviceId, slot, subscriptionId, internetMB, emMs = Date.now(), persistir = true) {
    if (!slotValido(slot) || !subscriptionIdValido(subscriptionId) ||
        typeof internetMB !== "number" || !Number.isFinite(internetMB) || internetMB < 0) {
        return { ok: false, error: "Leitura de internet inválida." };
    }

    const sim = db.sims[chaveSim(deviceId, slot)];
    if (!sim || sim.subscriptionId !== subscriptionId) {
        return { ok: false, error: "A leitura pertence a uma subscrição que já não corresponde ao SIM registado." };
    }

    sim.internetMB = Math.floor(internetMB);
    sim.atualizadoEmMs = emMs;
    sim.internetAtualizadaPor = "EVIDENCIA_USSD";
    if (persistir) db.save();
    return { ok: true, sim };
}

function listarSimsDoTenant(tenantId) {
    const agora = Date.now();

    return Object.values(db.sims)
        .filter((sim) => sim.tenantId === tenantId && operadorVodacom(sim.operadora))
        .map((sim) => ({
            ...sim,
            online: telemetriaRecente(sim.atualizadoEmMs, agora),
            estadoTelemetria: !Number.isSafeInteger(sim.atualizadoEmMs) || sim.atualizadoEmMs <= 0
                ? "SEM_LEITURA"
                : (sim.atualizadoEmMs > agora + FUTURO_TOLERANCIA_MS
                    ? "TIMESTAMP_INVALIDO"
                    : (telemetriaRecente(sim.atualizadoEmMs, agora) ? "ATUALIZADA" : "ANTIGA"))
        }))
        .sort((a, b) => a.slot - b.slot);
}

/** Transferências do dia contadas no SIM; um registo de outro dia vale zero. */
function transferenciasDoDia(sim, hojeStr) {
    return sim.transferenciasData === hojeStr ? (sim.transferenciasHoje || 0) : 0;
}

/** Seleciona um SIM Vodacom do Tenant E do Device que executará a tarefa. */
function escolherSimElegivel(tenantId, deviceId, megas, limiteDiario) {
    const agora = Date.now();
    const hojeStr = diaOperacional(agora);
    const sims = listarSimsDoTenant(tenantId)
        .filter((sim) => sim.deviceId === deviceId)
        .sort((a, b) => {
            // Prioriza menor carga diária; desempata pelo menor consumo reservado.
            const ra = reservasDoSim(a.simId, hojeStr);
            const rb = reservasDoSim(b.simId, hojeStr);
            const ca = transferenciasDoDia(a, hojeStr) + ra.transferenciasReservadas;
            const cb = transferenciasDoDia(b, hojeStr) + rb.transferenciasReservadas;
            return ca - cb || ra.megasReservados - rb.megasReservados || a.slot - b.slot;
        });

    for (const sim of sims) {
        if (!sim.online) continue;
        if (!subscriptionIdValido(sim.subscriptionId)) continue;

        const reservas = reservasDoSim(sim.simId, hojeStr);
        const transferenciasContabilizadas = transferenciasDoDia(sim, hojeStr) + reservas.transferenciasReservadas;
        const internetLivre = Number(sim.internetMB) - reservas.megasReservados;

        if (transferenciasContabilizadas >= limiteDiario) continue;
        if (!Number.isFinite(internetLivre) || internetLivre < megas) continue;

        return sim;
    }

    return null;
}

function obterSimOperacional(deviceId, slot) {
    if (!slotValido(slot)) return null;
    const sim = db.sims[chaveSim(deviceId, slot)];
    if (!sim || !operadorVodacom(sim.operadora) || !subscriptionIdValido(sim.subscriptionId)) return null;
    return sim;
}

module.exports = {
    registrarStatus,
    registrarTransferenciaConcluida,
    registrarLeituraInternet,
    listarSimsDoTenant,
    escolherSimElegivel,
    obterSimOperacional,
    JANELA_ONLINE_MS,
    telemetriaRecente
};
