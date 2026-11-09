package com.ursinhox.automation.agent

object SaldoParser {

    private val PADROES = listOf(
        Regex("""Internet:\s*(\d+)\s*MB""", RegexOption.IGNORE_CASE),
        Regex("""Saldo de dados:\s*(\d+)\s*MB""", RegexOption.IGNORE_CASE)
    )

    fun extrairSaldoMB(linhasDeLog: List<String>): Int? {
        for (linha in linhasDeLog.asReversed()) {
            for (padrao in PADROES) {
                val encontrado = padrao.find(linha)
                if (encontrado != null) {
                    return encontrado.groupValues[1].toIntOrNull()
                }
            }
        }
        return null
    }
}
