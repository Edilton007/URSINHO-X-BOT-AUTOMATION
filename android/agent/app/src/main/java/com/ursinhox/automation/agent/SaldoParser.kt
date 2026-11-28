package com.ursinhox.automation.agent

import java.math.BigDecimal
import java.math.RoundingMode

object SaldoParser {

    private val PADROES_SALDO_GERAL = listOf(
        Regex("""(?:internet|saldo de dados|saldo de internet)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(mb|gb)""", RegexOption.IGNORE_CASE),
        Regex("""(\d+(?:[.,]\d+)?)\s*(mb|gb)\s*(?:de\s*)?(?:internet|dados)""", RegexOption.IGNORE_CASE)
    )

    private val PADRAO_QUANTIDADE = Regex(
        """(\d+(?:[.,]\d+)?)\s*(mb|gb)""",
        RegexOption.IGNORE_CASE
    )
    private val INDICADOR_MENSAL = Regex(
        """mensal|mensais|monthly""",
        RegexOption.IGNORE_CASE
    )
    private val INDICADOR_TRANSFERIVEL = Regex(
        """transferível|transferivel|transferable|partilhável|partilhavel|shareable|disponível\s+para\s+(?:transferência|transferencia|transferir|partilhar)|disponivel\s+para\s+(?:transferencia|transferir|partilhar)|para\s+(?:transferência|transferencia|transferir|partilhar)""",
        RegexOption.IGNORE_CASE
    )

    /**
     * Só devolve o saldo geral quando a linha não descreve especificamente
     * uma quota mensal transferível. A quota não pode ser copiada para os dois
     * campos nem usada como substituto do saldo geral.
     */
    fun extrairSaldoMB(linhasDeLog: List<String>): Int? {
        for (linha in linhasDeLog.asReversed()) {
            if (linhaDescreveQuotaMensalTransferivel(linha)) continue
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

    /**
     * Só identifica quota transferível quando a própria resposta associa
     * explicitamente a quantidade a um período mensal E à possibilidade de
     * transferência/partilha. "Dados mensais" sem essa segunda indicação
     * continuam a ser uma quota desconhecida para fins de automação.
     */
    fun extrairSaldoMensalTransferivelMB(linhasDeLog: List<String>): Int? {
        for (linha in linhasDeLog.asReversed()) {
            for (encontrado in PADRAO_QUANTIDADE.findAll(linha).toList().asReversed()) {
                val inicio = (encontrado.range.first - 100).coerceAtLeast(0)
                val fim = (encontrado.range.last + 101).coerceAtMost(linha.length)
                val contexto = linha.substring(inicio, fim)
                if (!indicadaComoQuotaMensalTransferivel(contexto)) continue

                val quantidade = quantidadeParaMB(
                    encontrado.groupValues[1],
                    encontrado.groupValues[2]
                ) ?: continue
                if (quantidade >= 0) return quantidade
            }
        }
        return null
    }

    private fun linhaDescreveQuotaMensalTransferivel(linha: String): Boolean {
        return indicadaComoQuotaMensalTransferivel(linha)
    }

    private fun indicadaComoQuotaMensalTransferivel(texto: String): Boolean {
        return INDICADOR_MENSAL.containsMatchIn(texto) &&
            INDICADOR_TRANSFERIVEL.containsMatchIn(texto)
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
