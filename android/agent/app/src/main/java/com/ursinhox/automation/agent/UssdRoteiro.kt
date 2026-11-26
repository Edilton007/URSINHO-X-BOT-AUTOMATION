package com.ursinhox.automation.agent

import java.text.Normalizer
import java.util.Locale

/**
 * Guarda respostas USSD previstas. Os roteiros operacionais exigem que o texto
 * visível corresponda ao passo esperado antes de enviar qualquer opção.
 */
object UssdRoteiro {

    data class Passo(
        val resposta: String,
        val frasesEsperadas: Set<String> = emptySet()
    )

    @Volatile
    var ativo: Boolean = false
        private set

    @Volatile
    var geracaoSessao: Long = 0L
        private set

    private val fila: ArrayDeque<Passo> = ArrayDeque()
    private val historico = mutableListOf<String>()

    var aoTerminar: (() -> Unit)? = null

    /**
     * Compatibilidade para roteiros internos de diagnóstico antigos.
     * Transferências comerciais devem usar iniciarRoteiro com frases esperadas.
     */
    fun iniciar(passos: List<String>): Boolean =
        iniciarRoteiro(passos.map { Passo(it) })

    fun iniciarRoteiro(passos: List<Passo>): Boolean {
        if (ativo) {
            registrar(
                "AVISO: tentativa de iniciar um novo roteiro enquanto outro ainda " +
                    "estava ativo — recusada, para não corromper a sessão USSD em andamento."
            )
            return false
        }
        fila.clear()
        fila.addAll(passos)
        geracaoSessao += 1L
        ativo = true
        return true
    }

    /**
     * Consome a resposta apenas quando o ecrã corresponde ao passo esperado.
     * Roteiros comerciais não aceitam frases vazias nem correspondência aproximada.
     */
    fun proximoPasso(textoPrompt: String): String? {
        val passo = fila.firstOrNull() ?: return null
        if (passo.frasesEsperadas.isNotEmpty()) {
            val texto = normalizar(textoPrompt)
            val corresponde = passo.frasesEsperadas.any { frase ->
                texto.contains(normalizar(frase))
            }
            if (!corresponde) {
                registrar(
                    "SEGURANÇA: ecrã USSD não corresponde ao passo esperado. " +
                        "Resposta não enviada; sessão deve ser interrompida para revisão."
                )
                return null
            }
        }
        fila.removeFirst()
        return passo.resposta
    }

    fun temProximoPasso(): Boolean = fila.isNotEmpty()

    fun parar() {
        fila.clear()
        ativo = false
        val callback = aoTerminar
        aoTerminar = null
        callback?.invoke()
    }

    fun registrar(linha: String) {
        historico.add(linha)
    }

    fun limparHistorico() {
        historico.clear()
    }

    fun obterHistorico(): List<String> = historico.toList()

    private fun normalizar(texto: String): String =
        Normalizer.normalize(texto.lowercase(Locale.ROOT), Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "")
            .replace(Regex("\\s+"), " ")
            .trim()
}
