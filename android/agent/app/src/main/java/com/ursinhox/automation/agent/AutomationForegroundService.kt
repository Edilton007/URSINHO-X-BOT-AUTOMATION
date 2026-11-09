package com.ursinhox.automation.agent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import kotlin.concurrent.thread

class AutomationForegroundService : Service() {

    companion object {

        private const val CANAL_ID =
            "ursinho_automation_canal"

        private const val NOTIF_ID =
            1001

        private const val INTERVALO_TAREFAS_MS =
            20000L

        private const val INTERVALO_TELEMETRIA_MS =
            30L * 60L * 1000L

        private const val TELEMETRIA_PREFS =
            "ursinho_telemetria"

        private const val CHAVE_ULTIMA_TELEMETRIA =
            "ultima_telemetria_ms"

        private const val INTERVALO_ENTRE_SIMS_MS =
            4000L

        private const val RETENTAR_TELEMETRIA_MS =
            60000L

        private const val ESPERA_USSD_MS =
            4000L
    }

    private val handler =
        Handler(
            Looper.getMainLooper()
        )

    @Volatile
    private var executandoTarefa = false

    @Volatile
    private var telemetriaEmExecucao = false

    @Volatile
    private var telemetriaAgendada = false

    @Volatile
    private var servicoAtivo = false

    @Volatile
    private var loopJaIniciado = false

    override fun onBind(
        intent: Intent?
    ): IBinder? = null

    override fun onCreate() {

        super.onCreate()

        criarCanalNotificacao()
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int
    ): Int {

        servicoAtivo =
            true

        startForeground(
            NOTIF_ID,
            construirNotificacao(
                "Ursinho X Automation ativo — a verificar tarefas..."
            )
        )

        if (loopJaIniciado) {
            return START_STICKY
        }

        loopJaIniciado =
            true

        agendarProximaVerificacao()
        agendarProximaTelemetria()

        return START_STICKY
    }

    /**
     * Android 15+ limits background dataSync foreground services to six hours
     * in a rolling 24-hour window. Stop cleanly when the OS reports the timeout
     * instead of risking a RemoteServiceException. This callback does not make
     * the Agent continuously available; the Backend will observe the heartbeat
     * as offline until the user brings the app back and restarts the service.
     */
    override fun onTimeout(startId: Int, fgsType: Int) {
        android.util.Log.w(
            "UrsinhoAgent",
            "Foreground service timeout: type=$fgsType. Stopping cleanly; user restart may be required."
        )
        servicoAtivo = false
        loopJaIniciado = false
        handler.removeCallbacksAndMessages(null)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf(startId)
    }

    override fun onDestroy() {

        servicoAtivo =
            false

        loopJaIniciado =
            false

        telemetriaEmExecucao =
            false

        telemetriaAgendada =
            false

        handler.removeCallbacksAndMessages(
            null
        )

        super.onDestroy()
    }

    /* ============================================================
       CICLO DE TAREFAS
    ============================================================ */

    private fun agendarProximaVerificacao() {

        if (!servicoAtivo) {
            return
        }

        handler.postDelayed(
            {
                verificarTarefas()
            },
            INTERVALO_TAREFAS_MS
        )
    }

    private fun verificarTarefas() {

        if (!servicoAtivo) {
            return
        }

        if (
            executandoTarefa ||
            telemetriaEmExecucao
        ) {

            agendarProximaVerificacao()
            return
        }

        if (
            !ConfigStore.configurado(
                this
            )
        ) {

            agendarProximaVerificacao()
            return
        }

        val servidor =
            ConfigStore.servidor(
                this
            )

        val apiKey =
            ConfigStore.apiKey(
                this
            )

        val deviceId =
            ConfigStore.deviceId(
                this
            )

        thread {

            val resultado =
                BackendClient.buscarTarefas(
                    servidor,
                    apiKey,
                    deviceId
                )

            when (resultado) {

                is BackendClient.Resultado.Erro -> {

                    atualizarNotificacao(
                        "Ursinho X Automation — erro de conexão, tentando novamente..."
                    )

                    agendarProximaVerificacao()
                }

                is BackendClient.Resultado.Sucesso -> {

                    val tarefa =
                        resultado.valor.firstOrNull()

                    if (tarefa == null) {

                        atualizarNotificacao(
                            "Ursinho X Automation ativo — sem tarefas pendentes."
                        )

                        agendarProximaVerificacao()
                        return@thread
                    }

                    /*
                     * O Backend escolheu o SIM.
                     *
                     * O Agent não pode trocar:
                     *
                     * simId
                     * simSlot
                     *
                     * por outro SIM.
                     */

                    if (
                        tarefa.simSlot != 0 &&
                        tarefa.simSlot != 1
                    ) {

                        atualizarNotificacao(
                            "Tarefa ${tarefa.id} possui simSlot inválido: ${tarefa.simSlot}."
                        )

                        agendarProximaVerificacao()
                        return@thread
                    }

                    val simDaTarefa =
                        SimManager
                            .listarSimsAtivos(
                                this
                            )
                            .firstOrNull {
                                it.slotIndex == tarefa.simSlot &&
                                    it.subscriptionId == tarefa.subscriptionId
                            }

                    if (simDaTarefa == null) {

                        atualizarNotificacao(
                            "Tarefa pede slot ${tarefa.simSlot} / subscriptionId ${tarefa.subscriptionId}, mas essa subscrição não está disponível. Nenhum SIM alternativo será usado."
                        )

                        agendarProximaVerificacao()
                        return@thread
                    }

                    if (!SimManager.pareceVodacom(simDaTarefa)) {
                        atualizarNotificacao(
                            "Tarefa bloqueada: o slot/subscriptionId indicado pelo Backend não está numa linha Vodacom."
                        )
                        agendarProximaVerificacao()
                        return@thread
                    }

                    /*
                     * Verificação local de identidade do SIM.
                     *
                     * O Backend utiliza:
                     *
                     * deviceId-SLOT0
                     * deviceId-SLOT1
                     *
                     * Portanto o Agent confirma que a tarefa
                     * pertence exatamente ao SIM indicado.
                     */

                    val simIdLocal =
                        "${deviceId}-SLOT${simDaTarefa.slotIndex}"

                    if (
                        simIdLocal !=
                        tarefa.simId
                    ) {

                        atualizarNotificacao(
                            "Tarefa ${tarefa.id}: simId incompatível. Esperado ${tarefa.simId}, encontrado $simIdLocal."
                        )

                        agendarProximaVerificacao()
                        return@thread
                    }

                    /*
                     * Não procurar outro Vodacom.
                     *
                     * Não trocar de slot.
                     *
                     * Não escolher SIM por conta própria.
                     */

                    executandoTarefa =
                        true

                    atualizarNotificacao(
                        "Tarefa recebida — SIM ${simDaTarefa.slotIndex + 1}. A confirmar execução..."
                    )

                    val inicio =
                        BackendClient.iniciarTarefa(
                            baseUrl =
                                servidor,

                            apiKey =
                                apiKey,

                            deviceId =
                                deviceId,

                            taskId =
                                tarefa.id
                        )

                    when (inicio) {

                        is BackendClient.Resultado.Erro -> {

                            executandoTarefa =
                                false

                            atualizarNotificacao(
                                "Tarefa não iniciada: ${inicio.mensagem}"
                            )

                            agendarProximaVerificacao()
                        }

                        is BackendClient.Resultado.Sucesso -> {

                            val claim =
                                inicio.valor

                            /*
                             * O Backend confirma novamente o SIM
                             * no momento do claim.
                             *
                             * Se houver divergência, não executamos.
                             */

                            if (claim.idempotente) {
                                // Nunca repetir USSD com um claim já existente. O Backend
                                // da Fase 1 também recusa devolver claims antigos para reexecução.
                                executandoTarefa = false
                                atualizarNotificacao(
                                    "Tarefa ${tarefa.id} já reclamada anteriormente. Execução automática bloqueada para evitar transferência duplicada."
                                )
                                agendarProximaVerificacao()
                                return@thread
                            }

                            if (
                                claim.simId != tarefa.simId ||
                                claim.simSlot != tarefa.simSlot ||
                                claim.subscriptionId != tarefa.subscriptionId ||
                                claim.claimToken.isBlank()
                            ) {

                                executandoTarefa =
                                    false

                                atualizarNotificacao(
                                    "Claim recusado localmente: SIM devolvido pelo Backend não corresponde à tarefa."
                                )

                                agendarProximaVerificacao()
                                return@thread
                            }

                            val simAtualConfirmado = SimManager
                                .listarSimsAtivos(this)
                                .firstOrNull {
                                    it.slotIndex == tarefa.simSlot &&
                                        it.subscriptionId == tarefa.subscriptionId
                                }

                            if (simAtualConfirmado == null || !SimManager.pareceVodacom(simAtualConfirmado)) {
                                executandoTarefa = false
                                atualizarNotificacao(
                                    "Execução bloqueada depois do claim: o SIM físico/subscriptionId mudou. A tarefa ficará para revisão, sem escolher outro SIM."
                                )
                                agendarProximaVerificacao()
                                return@thread
                            }

                            atualizarNotificacao(
                                "EXECUTANDO — ${tarefa.megas}MB → ${tarefa.destino} (SIM ${simAtualConfirmado.slotIndex + 1})"
                            )

                            executarTarefaCompleta(
                                sim =
                                    simAtualConfirmado,

                                servidor =
                                    servidor,

                                apiKey =
                                    apiKey,

                                deviceId =
                                    deviceId,

                                tarefa =
                                    tarefa,

                                claimToken =
                                    claim.claimToken,

                                aoTerminarTudo = {

                                    executandoTarefa =
                                        false

                                    atualizarNotificacao(
                                        "Ursinho X Automation ativo — a verificar tarefas..."
                                    )

                                    agendarProximaVerificacao()

                                    agendarProximaTelemetria()
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    /* ============================================================
       EXECUÇÃO REAL
    ============================================================ */

    private fun executarTarefaCompleta(
        sim: SimInfo,
        servidor: String,
        apiKey: String,
        deviceId: String,
        tarefa: BackendClient.Tarefa,
        claimToken: String,
        aoTerminarTudo: () -> Unit
    ) {

        /*
         * Confirmar novamente que o SIM físico continua
         * sendo exatamente o SIM selecionado pelo Backend.
         */

        val simAtual = SimManager
            .listarSimsAtivos(this)
            .firstOrNull {
                it.slotIndex == tarefa.simSlot &&
                    it.subscriptionId == tarefa.subscriptionId
            }

        if (simAtual == null || !SimManager.pareceVodacom(simAtual)) {
            atualizarNotificacao(
                "Execução cancelada: a subscrição Vodacom selecionada pelo Backend já não está ativa."
            )
            aoTerminarTudo()
            return
        }

        val simIdLocal =
            "${deviceId}-SLOT${simAtual.slotIndex}"

        if (
            simIdLocal != tarefa.simId ||
            simAtual.subscriptionId != tarefa.subscriptionId
        ) {

            atualizarNotificacao(
                "Execução cancelada: identidade do SIM mudou."
            )

            aoTerminarTudo()
            return
        }

        if (
            simAtual.slotIndex !=
            tarefa.simSlot
        ) {

            atualizarNotificacao(
                "Execução cancelada: slot do SIM não corresponde à tarefa."
            )

            aoTerminarTudo()
            return
        }

        /*
         * 1. SALDO ANTES
         */

        atualizarNotificacao(
            "SIM ${simAtual.slotIndex + 1} — consultando saldo ANTES..."
        )

        // Começar um novo fluxo e preservar desde já apenas as evidências desta tarefa.
        UssdRoteiro.limparHistorico()
        UssdOperacoes.consultarSaldo(
            this,
            simAtual,
            preservarHistorico = true
        ) { saldoAntes ->

            handler.postDelayed({

                if (!servicoAtivo) {

                    aoTerminarTudo()
                    return@postDelayed
                }

                if (saldoAntes == null) {
                    // Sem saldo inicial não existe evidência mínima para autorizar
                    // a transferência. O claim já foi obtido, por isso reportamos
                    // a ausência de evidência e deixamos a operação em revisão;
                    // nunca tentamos executar USSD às cegas nem repetimos a tarefa.
                    atualizarNotificacao(
                        "Transferência bloqueada: não foi possível ler o saldo antes. A operação será enviada para revisão."
                    )
                    val logSemSaldo = UssdRoteiro.obterHistorico().joinToString("\n")
                    thread {
                        val resultado = BackendClient.enviarResultado(
                            baseUrl = servidor,
                            apiKey = apiKey,
                            deviceId = deviceId,
                            taskId = tarefa.id,
                            claimToken = claimToken,
                            simId = tarefa.simId,
                            simSlot = tarefa.simSlot,
                            subscriptionId = simAtual.subscriptionId,
                            saldoAntesMB = null,
                            saldoDepoisMB = null,
                            sucessoRedeReportado = null,
                            logBruto = logSemSaldo
                        )
                        handler.post {
                            val mensagem = when (resultado) {
                                is BackendClient.Resultado.Sucesso ->
                                    "Execução não iniciada. Falta de saldo antes registada no Backend para revisão."
                                is BackendClient.Resultado.Erro ->
                                    "Execução bloqueada, mas falhou o envio da evidência: ${resultado.mensagem}"
                            }
                            atualizarNotificacao(mensagem)
                            aoTerminarTudo()
                        }
                    }
                    return@postDelayed
                }

                atualizarNotificacao(
                    "Saldo ANTES: ${saldoAntes}MB — executando ${tarefa.megas}MB..."
                )

                /*
                 * 2. EXECUÇÃO USSD
                 */

                UssdOperacoes.executarTransferencia(
                    this,
                    simAtual,
                    tarefa.megas,
                    tarefa.destino
                ) {

                    handler.postDelayed({

                        if (!servicoAtivo) {

                            aoTerminarTudo()
                            return@postDelayed
                        }

                        /*
                         * 3. SALDO DEPOIS
                         */

                        atualizarNotificacao(
                            "SIM ${simAtual.slotIndex + 1} — consultando saldo DEPOIS..."
                        )

                        UssdOperacoes.consultarSaldo(
                            this,
                            simAtual,
                            preservarHistorico = true
                        ) { saldoDepois ->

                            val logCompleto =
                                UssdRoteiro
                                    .obterHistorico()
                                    .joinToString(
                                        "\n"
                                    )

                            /*
                             * A rede pode ter apresentado sucesso,
                             * mas a decisão final pertence ao Backend.
                             *
                             * Não assumimos sucesso aqui.
                             */

                            val sucessoRedeReportado =
                                UssdResultadoClassifier.classificar(logCompleto)

                            atualizarNotificacao(
                                when {
                                    saldoAntes != null &&
                                        saldoDepois != null -> {

                                        val diferenca =
                                            saldoAntes -
                                                saldoDepois

                                        "Saldo: ${saldoAntes}MB → ${saldoDepois}MB | diferença ${diferenca}MB"
                                    }

                                    else -> {

                                        "Saldo insuficiente para confirmação automática."
                                    }
                                }
                            )

                            thread {

                                val resultado =
                                    BackendClient.enviarResultado(
                                        baseUrl =
                                            servidor,

                                        apiKey =
                                            apiKey,

                                        deviceId =
                                            deviceId,

                                        taskId =
                                            tarefa.id,

                                        claimToken =
                                            claimToken,

                                        simId =
                                            tarefa.simId,

                                        simSlot =
                                            tarefa.simSlot,

                                        subscriptionId =
                                            simAtual.subscriptionId,

                                        saldoAntesMB =
                                            saldoAntes,

                                        saldoDepoisMB =
                                            saldoDepois,

                                        sucessoRedeReportado =
                                            sucessoRedeReportado,

                                        logBruto =
                                            logCompleto
                                    )

                                handler.post {

                                    when (resultado) {

                                        is BackendClient.Resultado.Sucesso -> {

                                            atualizarNotificacao(
                                                "Resultado enviado ao Backend — validação concluída pelo servidor."
                                            )
                                        }

                                        is BackendClient.Resultado.Erro -> {

                                            atualizarNotificacao(
                                                "Falha ao enviar resultado: ${resultado.mensagem}"
                                            )
                                        }
                                    }

                                    aoTerminarTudo()
                                }
                            }
                        }

                    }, ESPERA_USSD_MS)
                }

            }, ESPERA_USSD_MS)
        }
    }

    /**
     * O texto da operadora é apenas informação complementar.
     *
     * Nunca é utilizado para decidir CONCLUÍDA.
     *
     * A decisão real pertence ao Backend através dos saldos.
     */
    /* ============================================================
       TELEMETRIA
    ============================================================ */

    private fun obterPrefsTelemetria() =
        getSharedPreferences(
            TELEMETRIA_PREFS,
            MODE_PRIVATE
        )

    private fun agendarProximaTelemetria() {

        if (!servicoAtivo) {
            return
        }

        if (telemetriaAgendada) {
            return
        }

        if (telemetriaEmExecucao) {
            return
        }

        val prefs =
            obterPrefsTelemetria()

        val ultima =
            prefs.getLong(
                CHAVE_ULTIMA_TELEMETRIA,
                0L
            )

        val agora =
            System.currentTimeMillis()

        val delay =
            if (ultima <= 0L) {

                0L

            } else {

                val decorrido =
                    agora -
                        ultima

                (
                    INTERVALO_TELEMETRIA_MS -
                        decorrido
                ).coerceAtLeast(0L)
            }

        telemetriaAgendada =
            true

        handler.postDelayed({

            telemetriaAgendada =
                false

            executarTelemetriaSePossivel()

        }, delay)
    }

    private fun executarTelemetriaSePossivel() {

        if (!servicoAtivo) {
            return
        }

        if (
            executandoTarefa ||
            telemetriaEmExecucao
        ) {

            handler.postDelayed(
                {
                    executarTelemetriaSePossivel()
                },
                RETENTAR_TELEMETRIA_MS
            )

            return
        }

        if (
            !ConfigStore.configurado(
                this
            )
        ) {

            agendarProximaTelemetria()
            return
        }

        val servidor =
            ConfigStore.servidor(
                this
            )

        val apiKey =
            ConfigStore.apiKey(
                this
            )

        val deviceId =
            ConfigStore.deviceId(
                this
            )

        val simsVodacom =
            SimManager
                .listarSimsAtivos(
                    this
                )
                .filter {
                    SimManager.pareceVodacom(
                        it
                    )
                }
                .sortedBy {
                    it.slotIndex
                }

        if (simsVodacom.isEmpty()) {

            atualizarNotificacao(
                "Telemetria: nenhum SIM Vodacom disponível."
            )

            marcarTelemetriaConcluida()
            return
        }

        telemetriaEmExecucao =
            true

        atualizarNotificacao(
            "Telemetria: consultando SIMs..."
        )

        consultarSimsSequencialmente(
            simsVodacom,
            0,
            servidor,
            apiKey,
            deviceId
        )
    }

    private fun consultarSimsSequencialmente(
        sims: List<SimInfo>,
        indice: Int,
        servidor: String,
        apiKey: String,
        deviceId: String
    ) {

        if (!servicoAtivo) {

            telemetriaEmExecucao =
                false

            return
        }

        if (indice >= sims.size) {

            telemetriaEmExecucao =
                false

            marcarTelemetriaConcluida()

            atualizarNotificacao(
                "Telemetria concluída — próxima leitura em 30 min."
            )

            return
        }

        val sim =
            sims[indice]

        atualizarNotificacao(
            "Telemetria SIM ${sim.slotIndex + 1} — consultando saldo..."
        )

        try {

            UssdOperacoes.consultarSaldo(
                this,
                sim
            ) { internetMB ->

                if (!servicoAtivo) {

                    telemetriaEmExecucao =
                        false

                    return@consultarSaldo
                }

                if (internetMB == null) {

                    atualizarNotificacao(
                        "Telemetria SIM ${sim.slotIndex + 1} — leitura não obtida."
                    )

                    handler.postDelayed(
                        {

                            consultarSimsSequencialmente(
                                sims,
                                indice + 1,
                                servidor,
                                apiKey,
                                deviceId
                            )

                        },
                        INTERVALO_ENTRE_SIMS_MS
                    )

                    return@consultarSaldo
                }

                atualizarNotificacao(
                    "Telemetria SIM ${sim.slotIndex + 1} — ${internetMB} MB."
                )

                thread {

                    val resultado =
                        BackendClient.enviarStatusSim(
                            baseUrl =
                                servidor,

                            apiKey =
                                apiKey,

                            deviceId =
                                deviceId,

                            slot =
                                sim.slotIndex,

                            operadora =
                                sim.carrierName,

                            internetMB =
                                internetMB,

                            subscriptionId =
                                sim.subscriptionId,

                            saldoMT =
                                null
                        )

                    handler.post {

                        when (resultado) {

                            is BackendClient.Resultado.Sucesso -> {

                                atualizarNotificacao(
                                    "Telemetria SIM ${sim.slotIndex + 1} enviada: ${internetMB} MB."
                                )
                            }

                            is BackendClient.Resultado.Erro -> {

                                atualizarNotificacao(
                                    "Telemetria SIM ${sim.slotIndex + 1} — falha ao enviar."
                                )
                            }
                        }

                        handler.postDelayed(
                            {

                                consultarSimsSequencialmente(
                                    sims,
                                    indice + 1,
                                    servidor,
                                    apiKey,
                                    deviceId
                                )

                            },
                            INTERVALO_ENTRE_SIMS_MS
                        )
                    }
                }
            }

        } catch (e: Exception) {

            atualizarNotificacao(
                "Telemetria SIM ${sim.slotIndex + 1} — erro: ${e.message ?: "desconhecido"}"
            )

            handler.postDelayed(
                {

                    consultarSimsSequencialmente(
                        sims,
                        indice + 1,
                        servidor,
                        apiKey,
                        deviceId
                    )

                },
                INTERVALO_ENTRE_SIMS_MS
            )
        }
    }

    private fun marcarTelemetriaConcluida() {

        obterPrefsTelemetria()
            .edit()
            .putLong(
                CHAVE_ULTIMA_TELEMETRIA,
                System.currentTimeMillis()
            )
            .apply()

        telemetriaEmExecucao =
            false

        agendarProximaTelemetria()
    }

    /* ============================================================
       NOTIFICAÇÃO
    ============================================================ */

    private fun criarCanalNotificacao() {

        if (
            Build.VERSION.SDK_INT >=
            Build.VERSION_CODES.O
        ) {

            val canal =
                NotificationChannel(
                    CANAL_ID,
                    "Ursinho X Automation",
                    NotificationManager.IMPORTANCE_LOW
                )

            canal.description =
                "Serviço de automação rodando em segundo plano"

            val manager =
                getSystemService(
                    NotificationManager::class.java
                )

            manager.createNotificationChannel(
                canal
            )
        }
    }

    private fun construirNotificacao(
        texto: String
    ): Notification {

        val intentAbrirApp =
            Intent(
                this,
                MainActivity::class.java
            )

        val pendingIntent =
            PendingIntent.getActivity(
                this,
                0,
                intentAbrirApp,
                PendingIntent.FLAG_IMMUTABLE
            )

        return NotificationCompat.Builder(
            this,
            CANAL_ID
        )
            .setContentTitle(
                "Ursinho X Automation"
            )
            .setContentText(
                texto
            )
            .setSmallIcon(
                android.R.drawable.stat_sys_download
            )
            .setContentIntent(
                pendingIntent
            )
            .setOngoing(
                true
            )
            .build()
    }

    private fun atualizarNotificacao(
        texto: String
    ) {

        val manager =
            getSystemService(
                NotificationManager::class.java
            )

        manager.notify(
            NOTIF_ID,
            construirNotificacao(
                texto
            )
        )
    }
}