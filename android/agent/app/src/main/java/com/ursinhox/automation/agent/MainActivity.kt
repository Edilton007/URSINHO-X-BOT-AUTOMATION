package com.ursinhox.automation.agent

import android.Manifest
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var txtSims: TextView
    private lateinit var txtSaldo: TextView
    private lateinit var txtLog: TextView
    private lateinit var editUssd: EditText
    private lateinit var editRoteiro: EditText
    private lateinit var editMegas: EditText
    private lateinit var editDestino: EditText
    private lateinit var editServidor: EditText
    private lateinit var editApiKey: EditText
    private lateinit var editDeviceId: EditText

    private var simsDetetados: List<SimInfo> = emptyList()
    private var simSelecionado: SimInfo? = null

    private val permissoesNecessarias: Array<String>
        get() {
            val base = mutableListOf(
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.CALL_PHONE,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                base.add(Manifest.permission.POST_NOTIFICATIONS)
            }
            return base.toTypedArray()
        }

    // Recebe os logs do serviço de acessibilidade (deteção de menu + respostas enviadas).
    private val receptorLogAcessibilidade = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val texto = intent?.getStringExtra(UssdAccessibilityService.EXTRA_TEXTO_LOG)
            if (!texto.isNullOrBlank()) {
                log(texto)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Microanimações apenas decorativas. Não representam ligação ou estado operacional.
        findViewById<View>(R.id.brandMark).apply {
            alpha = 0f
            scaleX = 0.90f
            scaleY = 0.90f
            animate()
                .alpha(1f)
                .scaleX(1f)
                .scaleY(1f)
                .setDuration(460L)
                .setInterpolator(AccelerateDecelerateInterpolator())
                .start()
        }
        ObjectAnimator.ofFloat(findViewById<View>(R.id.auroraAccent), View.ALPHA, 0.68f, 1f).apply {
            duration = 2100L
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
            start()
        }

        txtSims = findViewById(R.id.txtSims)
        txtSaldo = findViewById(R.id.txtSaldo)
        txtLog = findViewById(R.id.txtLog)
        editUssd = findViewById(R.id.editUssd)
        editRoteiro = findViewById(R.id.editRoteiro)
        editMegas = findViewById(R.id.editMegas)
        editDestino = findViewById(R.id.editDestino)
        editServidor = findViewById(R.id.editServidor)
        editApiKey = findViewById(R.id.editApiKey)
        editDeviceId = findViewById(R.id.editDeviceId)

        findViewById<Button>(R.id.btnPedirPermissoes).setOnClickListener { pedirPermissoes() }
        findViewById<Button>(R.id.btnDetectarSims).setOnClickListener { detetarSims() }
        findViewById<Button>(R.id.btnAtualizarSaldo).setOnClickListener { atualizarSaldoExibido() }
        findViewById<Button>(R.id.btnEnviarUssd).apply {
            isEnabled = false
            text = "USSD manual desativado"
            setOnClickListener { log("USSD operacional só pode ser iniciado por tarefa reclamada do Backend.") }
        }
        findViewById<Button>(R.id.btnAtivarAcessibilidade).setOnClickListener { abrirDefinicoesAcessibilidade() }
        findViewById<Button>(R.id.btnAutomatizarMenu).apply {
            isEnabled = false
            text = "Menu USSD manual desativado"
            setOnClickListener { log("Menu USSD livre desativado para impedir operações fora da autorização do Backend.") }
        }
        findViewById<Button>(R.id.btnTransferirVerificado).apply {
            isEnabled = false
            text = "Transferência apenas pelo Backend"
            setOnClickListener { log("Transferência manual bloqueada. Só executamos tarefas autorizadas e selecionadas pelo Backend.") }
        }
        findViewById<Button>(R.id.btnBuscarTarefa).setOnClickListener { buscarEExecutarTarefa() }
        findViewById<Button>(R.id.btnLigarServico).setOnClickListener { ligarServicoAutomatico() }
        findViewById<Button>(R.id.btnDesligarServico).setOnClickListener { desligarServicoAutomatico() }

        if (ConfigStore.configurado(this)) {
            editServidor.setText(ConfigStore.servidor(this))
            editApiKey.setText(ConfigStore.apiKey(this))
            editDeviceId.setText(ConfigStore.deviceId(this))
        }

        log("Versão Android detetada: API ${Build.VERSION.SDK_INT} (${Build.VERSION.RELEASE})")
        log("Backend é a autoridade para tarefas, SIM selecionado e estado final.")
        log("Execução manual livre está desativada; apenas tarefas autorizadas podem iniciar USSD.")
    }

    override fun onStart() {
        super.onStart()
        val filtro = IntentFilter(UssdAccessibilityService.ACAO_LOG_USSD)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(receptorLogAcessibilidade, filtro, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(receptorLogAcessibilidade, filtro)
        }
    }

    override fun onStop() {
        super.onStop()
        runCatching { unregisterReceiver(receptorLogAcessibilidade) }
    }

    // ---------- Permissões ----------

    private fun pedirPermissoes() {
        val faltando = permissoesNecessarias.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (faltando.isEmpty()) {
            log("Todas as permissões já concedidas.")
            return
        }
        ActivityCompat.requestPermissions(this, faltando.toTypedArray(), 100)
    }

    private fun temTodasPermissoes(): Boolean =
        permissoesNecessarias.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }

    // ---------- Deteção de SIM ----------

    private fun detetarSims() {
        if (!temTodasPermissoes()) {
            Toast.makeText(this, "Conceda as permissões primeiro (passo 1).", Toast.LENGTH_LONG).show()
            return
        }
        simsDetetados = SimManager.listarSimsAtivos(this)

        if (simsDetetados.isEmpty()) {
            txtSims.text = "Nenhum SIM detetado. Verifique se há SIMs inseridos e ativos."
            log("Deteção de SIM devolveu lista vazia.")
            return
        }

        val texto = StringBuilder()
        simsDetetados.forEach { sim ->
            val marcaVodacom = if (SimManager.pareceVodacom(sim)) " [VODACOM]" else ""
            texto.append("SIM ${sim.slotIndex + 1}$marcaVodacom\n")
            texto.append("  Nome: ${sim.displayName}\n")
            texto.append("  Operadora: ${sim.carrierName}\n")
            texto.append("  subscriptionId: ${sim.subscriptionId}\n")
            texto.append("  Número: ${sim.phoneNumber ?: "não disponível"}\n\n")
        }
        txtSims.text = texto.toString()

        simSelecionado = simsDetetados.firstOrNull { SimManager.pareceVodacom(it) }
        if (simSelecionado == null) {
            log("Nenhum SIM Vodacom identificado. Movitel e outras operadoras não serão usadas como substitutas.")
        } else {
            log("SIM Vodacom detetado para diagnóstico: slot ${simSelecionado!!.slotIndex + 1} (${simSelecionado!!.carrierName}). As tarefas operacionais continuam a usar exclusivamente o slot/subscriptionId escolhidos pelo Backend.")
        }
    }

    // ---------- Passo 3: API oficial (uma pergunta só) ----------

    private fun testarApiOficial() {
        val sim = simSelecionado
        if (sim == null) {
            Toast.makeText(this, "Detete os SIMs primeiro (passo 2).", Toast.LENGTH_LONG).show()
            return
        }
        if (!UssdSender.apiSuportada()) {
            log("Este aparelho é anterior ao Android 8.0 — a API oficial não existe aqui. Use os passos 4/5.")
            return
        }
        val codigo = editUssd.text.toString().trim()
        if (codigo.isBlank()) {
            Toast.makeText(this, "Escreva um código USSD.", Toast.LENGTH_SHORT).show()
            return
        }

        log("Enviando USSD '$codigo' via SIM ${sim.slotIndex + 1} (API oficial, uma troca só)...")
        UssdSender.enviar(this, sim, codigo, object : UssdSender.Callback {
            override fun onRespostaRecebida(resposta: String) {
                log("Resposta recebida:\n$resposta")
            }

            override fun onErro(codigoErro: Int, mensagem: String) {
                log("Erro ao enviar USSD ($codigoErro): $mensagem\n" +
                    "Se este código abre um menu de várias etapas (com opções tipo " +
                    "\"1. Aceitar / 2. Rejeitar\"), a API oficial não serve — use os passos 4 e 5.")
            }
        })
    }

    // ---------- Passos 4 e 5: automação completa via acessibilidade ----------

    private fun abrirDefinicoesAcessibilidade() {
        log("Abrindo Definições > Acessibilidade. Procure \"Ursinho X Automation Agent\" e ative-o.")
        startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }

    private fun servicoAcessibilidadeAtivo(): Boolean {
        val ativos = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return ativos.contains(packageName)
    }

    private fun automatizarMenuCompleto() {
        val sim = simSelecionado
        if (sim == null) {
            Toast.makeText(this, "Detete os SIMs primeiro (passo 2).", Toast.LENGTH_LONG).show()
            return
        }
        if (!servicoAcessibilidadeAtivo()) {
            Toast.makeText(
                this,
                "Ative o serviço de acessibilidade primeiro (passo 4).",
                Toast.LENGTH_LONG
            ).show()
            return
        }
        val codigo = editUssd.text.toString().trim()
        if (codigo.isBlank()) {
            Toast.makeText(this, "Escreva o código USSD inicial (ex: *162#).", Toast.LENGTH_SHORT).show()
            return
        }
        val passos = editRoteiro.text.toString()
            .split(",")
            .map { it.trim() }
            .filter { it.isNotEmpty() }

        UssdRoteiro.iniciar(passos)
        log("Roteiro iniciado com ${passos.size} passo(s): $passos")
        log("Discando '$codigo' via SIM ${sim.slotIndex + 1}. A partir daqui, o serviço de " +
            "acessibilidade lê o ecrã e responde sozinho a cada etapa.")

        discarUssd(sim, codigo)
    }

    private fun discarUssd(sim: SimInfo, codigo: String) {
        UssdOperacoes.discar(this, sim, codigo)
    }

    private fun log(mensagem: String) {
        txtLog.text = "${txtLog.text}\n\n$mensagem"
    }

    // ---------- Saldo exibido (consulta independente) ----------

    private fun atualizarSaldoExibido() {
        val sim = simSelecionado
        if (sim == null) {
            Toast.makeText(this, "Detete os SIMs primeiro (passo 2).", Toast.LENGTH_LONG).show()
            return
        }
        if (!servicoAcessibilidadeAtivo()) {
            Toast.makeText(this, "Ative o serviço de acessibilidade primeiro (passo 4).", Toast.LENGTH_LONG).show()
            return
        }
        txtSaldo.text = "Consultando saldo..."
        consultarSaldoInternet(sim) { saldoMB ->
            txtSaldo.text = if (saldoMB != null) {
                "Internet disponível: ${saldoMB}MB"
            } else {
                "Não foi possível ler o saldo agora."
            }
        }
    }

    private fun consultarSaldoInternet(sim: SimInfo, callback: (Int?) -> Unit) {
        UssdOperacoes.consultarSaldo(this, sim) { saldo -> runOnUiThread { callback(saldo) } }
    }

    // ---------- Passo 6: transferência direta (MB e destino) ----------

    private fun iniciarTransferencia() {
        val sim = simSelecionado
        if (sim == null) {
            Toast.makeText(this, "Detete os SIMs primeiro (passo 2).", Toast.LENGTH_LONG).show()
            return
        }
        if (!servicoAcessibilidadeAtivo()) {
            Toast.makeText(this, "Ative o serviço de acessibilidade primeiro (passo 4).", Toast.LENGTH_LONG).show()
            return
        }
        val megas = editMegas.text.toString().trim().toIntOrNull()
        if (megas == null || megas < 100 || megas > 10240) {
            Toast.makeText(this, "Quantidade inválida (mínimo 100, máximo 10240 MB).", Toast.LENGTH_LONG).show()
            return
        }
        val destino = editDestino.text.toString().trim()
        if (destino.isBlank()) {
            Toast.makeText(this, "Escreva o número de destino.", Toast.LENGTH_SHORT).show()
            return
        }

        log("Transferindo ${megas}MB para $destino via *162#...")
        executarTransferencia(sim, megas, destino) {
            log("Sequência enviada. Toque em \"Atualizar saldo\" daqui a alguns segundos para conferir se baixou.")
        }
    }

    private fun executarTransferencia(sim: SimInfo, megas: Int, destino: String, callback: () -> Unit) {
        UssdOperacoes.executarTransferencia(this, sim, megas, destino) { runOnUiThread { callback() } }
    }

    // ---------- Entrada única para execução autorizada ----------

    /**
     * A procura manual e o serviço em segundo plano usam o mesmo executor.
     * Não manter aqui uma segunda implementação de claim/USSD, para evitar
     * diferenças de segurança, evidência ou repetição entre dois fluxos.
     */
    private fun buscarEExecutarTarefa() {
        ligarServicoAutomatico()
    }

    private fun ligarServicoAutomatico() {
        val servidor = editServidor.text.toString().trim().trimEnd('/')
        val apiKey = editApiKey.text.toString().trim()
        val deviceId = editDeviceId.text.toString().trim()

        if (servidor.isBlank() || apiKey.isBlank() || deviceId.isBlank()) {
            Toast.makeText(this, "Preencha servidor, x-api-key e device ID primeiro.", Toast.LENGTH_LONG).show()
            return
        }
        if (!ConfigStore.servidorSeguro(servidor)) {
            Toast.makeText(this, "O Backend precisa de um endereço HTTPS válido.", Toast.LENGTH_LONG).show()
            return
        }
        if (!servicoAcessibilidadeAtivo()) {
            Toast.makeText(this, "Ative o serviço de acessibilidade primeiro (passo 4).", Toast.LENGTH_LONG).show()
            return
        }

        ConfigStore.salvar(this, servidor, apiKey, deviceId)

        val intent = Intent(this, AutomationForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }

        log("Automação em segundo plano ligada. Pode fechar o app — ele continua verificando tarefas sozinho.")
    }

    private fun desligarServicoAutomatico() {
        stopService(Intent(this, AutomationForegroundService::class.java))
        log("Automação em segundo plano desligada.")
    }
}
