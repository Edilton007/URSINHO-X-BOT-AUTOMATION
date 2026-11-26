package com.ursinhox.automation.agent

import java.math.BigDecimal
import java.math.RoundingMode

object SaldoParser {

    private val PADROES_SALDO_GERAL = listOf(
        Regex("""(?:internet|saldo de dados|saldo de internet)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(mb|gb)""", RegexOption.IGNORE_CASE),
        Regex("""(\d+(?:[.,]\d+)?)\s*(mb|gb)\s*(?:de\s*)?(?:internet|dados)""", RegexOption.IGNORE_CASE)
    )

    /**
     * Só identifica quota transferível quando a própria resposta da operadora
     * a designa explicitamente como mensal/monthly. Saldo geral ou diário não
     * é convertido em quota mensal por inferência.
     */
    private val PADRAO_QUANTIDADE = Regex(
        """(\d+(?:[.,]\d+)?)\s*(mb|gb)""",
        RegexOption.IGNORE_CASE
    )
    private val INDICADOR_MENSAL = Regex(
        """mensal|mensais|monthly""",
        RegexOption.IGNORE_CASE
    )

    fun extrairSaldoMB(linhasDeLog: List<String>): Int? {
        for (linha in linhasDeLog.asReversed()) {
            for (padrao in PADROES_SALDO_GERAL) {
                val encontrado = padrao.find(linha)
                if (encontrado != null) {
                    return quantidadeParaMB(
                        encontrado.groupValues[1],
                        encontrado.groupValues[2]
                    )
                }
            }
        }
        return null
    }

    fun extrairSaldoMensalTransferivelMB(linhasDeLog: List<String>): Int? {
        for (linha in linhasDeLog.asReversed()) {
            for (encontrado in PADRAO_QUANTIDADE.findAll(linha).toList().asReversed()) {
                // O rótulo mensal tem de pertencer à mesma linha e estar
                // próximo da quantidade. Não inferir a partir de saldo geral.
                val inicio = (encontrado.range.first - 40).coerceAtLeast(0)
                val fim = (encontrado.range.last + 41).coerceAtMost(linha.length)
                val contexto = linha.substring(inicio, fim)
                if (!INDICADOR_MENSAL.containsMatchIn(contexto)) continue

                val quantidade = quantidadeParaMB(
                    encontrado.groupValues[1],
                    encontrado.groupValues[2]
                ) ?: continue
                if (quantidade >= 0) return quantidade
            }
        }
        return null
    }

    private fun quantidadeParaMB(valor: String, unidade: String): Int? {
        return try {
            val numero = BigDecimal(valor.replace(',', '.'))
            val megas = if (unidade.equals("gb", ignoreCase = true)) {
                numero.multiply(BigDecimal("1024"))
            } else {
                numero
            }
            megas.setScale(0, RoundingMode.HALF_UP).intValueExact()
        } catch (_: Exception) {
            null
        }
    }
}
