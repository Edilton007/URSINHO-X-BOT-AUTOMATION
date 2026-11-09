package com.ursinhox.automation.agent

import java.text.Normalizer
import java.util.Locale

/** Allowlist partilhada pela telemetria e pela validação antes do USSD. */
object OperadoraVodacom {
    private val nomesAceites = setOf(
        "vodacom",
        "vodacom mz",
        "vodacom mocambique",
        "vodacom mozambique"
    )

    fun aceita(nome: String?): Boolean {
        val normalizado = Normalizer.normalize(nome.orEmpty(), Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "")
            .lowercase(Locale.ROOT)
            .replace(Regex("\\s+"), " ")
            .trim()
        return normalizado in nomesAceites
    }
}
