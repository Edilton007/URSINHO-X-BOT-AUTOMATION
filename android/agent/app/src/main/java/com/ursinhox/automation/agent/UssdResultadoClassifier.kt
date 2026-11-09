package com.ursinhox.automation.agent

import java.text.Normalizer
import java.util.Locale

/**
 * Só declara sucesso quando o texto USSD contém uma confirmação explícita conhecida.
 * Mensagens desconhecidas ficam null e o Backend deve encaminhar para revisão.
 */
object UssdResultadoClassifier {
    fun classificar(texto: String): Boolean? {
        val normalizado = Normalizer.normalize(texto.lowercase(Locale.ROOT), Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "")
        val negativo = listOf(
            "nao foi possivel", "nao foi concluida", "falhou", "erro na transferencia",
            "insufficient balance", "insufficient funds", "transaction failed", "transfer failed",
            "cancelada", "cancelado", "rejeitada", "rejeitado"
        ).any { normalizado.contains(it) }
        if (negativo) return false
        val positivo = listOf(
            "transferencia efetuada com sucesso", "transferencia realizada com sucesso",
            "transferencia concluida com sucesso", "transferencia concluida",
            "transfer successful", "transfer completed", "transaction successful"
        ).any { normalizado.contains(it) }
        return if (positivo) true else null
    }
}
