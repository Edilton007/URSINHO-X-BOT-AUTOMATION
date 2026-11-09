package com.ursinhox.automation.agent

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * ATENÇÃO — LEIA ANTES DE USAR
 *
 * Este serviço lê o diálogo NATIVO do Android/discador que aparece durante
 * uma sessão USSD (o popup preto com o menu numerado e uma caixa de texto)
 * e, quando existe um roteiro ativo em UssdRoteiro, digita a próxima
 * resposta e toca automaticamente no botão de enviar — repetindo isto a
 * cada etapa do menu, o que a API oficial do Android NÃO permite fazer
 * (TelephonyManager.sendUssdRequest só suporta uma troca única).
 *
 * Precisa ser ativado manualmente pelo utilizador em
 * Definições > Acessibilidade > Ursinho X Automation Agent.
 * O Android não permite ativação automática — e com razão: um serviço
 * assim, mal usado, é o padrão técnico de apps de fraude. Por isso este
 * serviço só age quando:
 *   1. UssdRoteiro.ativo é true (definido explicitamente pela MainActivity
 *      antes de discar o código), e
 *   2. o evento vem de um pacote conhecido de discador/telefonia.
 * Fora dessas duas condições, ele não lê nem toca em nada.
 *
 * LIMITAÇÃO REAL: a estrutura exata do diálogo (IDs dos campos, texto dos
 * botões) varia por fabricante e versão do Android. O código abaixo procura
 * o botão de enviar por texto ("Enviar", "OK", "Send", "Submit") em vez de
 * por ID fixo, para ser mais tolerante a isso — mas pode precisar de ajuste
 * fino depois de ver o comportamento real no Galaxy A04e.
 */
class UssdAccessibilityService : AccessibilityService() {

    companion object {
        const val ACAO_LOG_USSD = "com.ursinhox.automation.agent.LOG_USSD"
        const val EXTRA_TEXTO_LOG = "texto_log"
        private const val TAG = "UssdAccessibility"

        private val PACOTES_DISCADOR_CONHECIDOS = setOf(
            "com.android.phone",
            "com.samsung.android.dialer",
            "com.samsung.android.incallui",
            "com.android.server.telecom",
            "com.android.incallui"
        )

        private val TEXTOS_BOTAO_ENVIAR = setOf(
            "enviar", "ok", "send", "submit", "confirmar"
        )

        private val TEXTOS_BOTAO_CANCELAR = setOf(
            "cancelar", "cancel"
        )
    }

    // Evita processar o mesmo texto de diálogo várias vezes seguidas
    // (o Android dispara vários eventos para a mesma tela).
    private var ultimoTextoProcessado: String? = null
    private var geracaoSessaoProcessada: Long = -1L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (!UssdRoteiro.ativo) return

        // Uma nova sessão pode apresentar exatamente o mesmo primeiro menu.
        // O deduplicador só deve valer dentro da mesma sessão, não para sempre.
        val geracaoAtual = UssdRoteiro.geracaoSessao
        if (geracaoAtual != geracaoSessaoProcessada) {
            geracaoSessaoProcessada = geracaoAtual
            ultimoTextoProcessado = null
        }

        val pacoteOrigem = event?.packageName?.toString() ?: return
        if (pacoteOrigem !in PACOTES_DISCADOR_CONHECIDOS) return

        val root = rootInActiveWindow ?: return
        // Proteção contra condição de corrida: por vezes, quando o utilizador volta
        // rapidamente para o próprio app, o evento ainda chega com o pacote antigo
        // (discador) mas rootInActiveWindow já aponta para outra janela (o nosso
        // próprio app). Sem esta checagem, isso fazia o serviço ler por engano o
        // ecrã do Ursinho X Automation Agent como se fosse um diálogo USSD.
        if (root.packageName?.toString() != pacoteOrigem) return

        val campoTexto = encontrarCampoDeTexto(root)
        val textoDialogo = extrairTextoVisivel(root)

        if (textoDialogo.isBlank() || textoDialogo == ultimoTextoProcessado) return
        ultimoTextoProcessado = textoDialogo

        log("Ecrã USSD detetado:\n$textoDialogo")

        if (campoTexto != null && UssdRoteiro.temProximoPasso()) {
            val resposta = UssdRoteiro.proximoPasso() ?: return
            val enviado = preencherEEnviar(root, campoTexto, resposta)
            if (enviado) {
                log("Resposta automática enviada: \"$resposta\"")
            } else {
                log("Não foi possível localizar o botão de enviar para responder \"$resposta\" — " +
                    "pare e verifique manualmente. Roteiro interrompido.")
                UssdRoteiro.parar()
            }
        } else if (campoTexto != null && !UssdRoteiro.temProximoPasso()) {
            // Ainda pede resposta, mas o roteiro acabou — não inventar próximo passo.
            log("O menu pede mais uma resposta, mas o roteiro definido já terminou. " +
                "Parando aqui para revisão manual (nunca adivinhar o próximo passo).")
            UssdRoteiro.parar()
        } else if (campoTexto == null && UssdRoteiro.temProximoPasso()) {
            // Ecrã sem campo de entrada, mas o roteiro ainda não terminou — provavelmente
            // uma mensagem transitória da rede ("em execução", "processando" etc.), não
            // a resposta final. Não encerrar: só esperar o próximo ecrã real aparecer.
            log("Ecrã transitório detetado (sem campo de entrada, roteiro ainda ativo):\n$textoDialogo\n" +
                "Aguardando o próximo ecrã real da rede — não encerrando o roteiro.")
        } else {
            // Diálogo sem campo de texto e sem passos pendentes = resposta final da operadora.
            log("Resposta final da rede:\n$textoDialogo")
            UssdRoteiro.parar()
        }
    }

    private fun preencherEEnviar(
        root: AccessibilityNodeInfo,
        campoTexto: AccessibilityNodeInfo,
        valor: String
    ): Boolean {
        val argumentos = Bundle().apply {
            putCharSequence(
                AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                valor
            )
        }
        campoTexto.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, argumentos)

        val botaoEnviar = encontrarBotaoPorTexto(root, TEXTOS_BOTAO_ENVIAR) ?: return false
        return botaoEnviar.performAction(AccessibilityNodeInfo.ACTION_CLICK)
    }

    private fun encontrarCampoDeTexto(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.className?.contains("EditText") == true) return node
        for (i in 0 until node.childCount) {
            val encontrado = encontrarCampoDeTexto(node.getChild(i))
            if (encontrado != null) return encontrado
        }
        return null
    }

    private fun encontrarBotaoPorTexto(
        node: AccessibilityNodeInfo?,
        textosAlvo: Set<String>
    ): AccessibilityNodeInfo? {
        if (node == null) return null
        val texto = node.text?.toString()?.trim()?.lowercase()
        if (node.isClickable && texto != null && texto in textosAlvo) return node
        for (i in 0 until node.childCount) {
            val encontrado = encontrarBotaoPorTexto(node.getChild(i), textosAlvo)
            if (encontrado != null) return encontrado
        }
        return null
    }

    private fun extrairTextoVisivel(node: AccessibilityNodeInfo?): String {
        val builder = StringBuilder()
        fun percorrer(n: AccessibilityNodeInfo?) {
            if (n == null) return
            n.text?.let { if (it.isNotBlank()) builder.append(it).append("\n") }
            for (i in 0 until n.childCount) percorrer(n.getChild(i))
        }
        percorrer(node)
        return builder.toString().trim()
    }

    private fun log(mensagem: String) {
        Log.d(TAG, mensagem)
        UssdRoteiro.registrar(mensagem)
        sendBroadcast(Intent(ACAO_LOG_USSD).apply {
            putExtra(EXTRA_TEXTO_LOG, mensagem)
            setPackage(packageName)
        })
    }

    override fun onInterrupt() {
        Log.w(TAG, "Serviço de acessibilidade interrompido pelo sistema.")
    }
}
