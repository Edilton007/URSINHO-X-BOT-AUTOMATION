package com.ursinhox.automation.agent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SaldoParserTest {

    @Test
    fun extraiSaldoDeInternetEmMegabytes() {
        assertEquals(1536, SaldoParser.extrairSaldoMB(listOf("Internet: 1536 MB")))
    }

    @Test
    fun extraiSaldoDeDadosEmMegabytes() {
        assertEquals(500, SaldoParser.extrairSaldoMB(listOf("Saldo de dados: 500 MB")))
    }

    @Test
    fun prefereLeituraMaisRecenteNoHistorico() {
        assertEquals(
            900,
            SaldoParser.extrairSaldoMB(
                listOf("Internet: 1200 MB", "Internet: 900 MB")
            )
        )
    }

    @Test
    fun naoInventaLeituraQuandoFormatoNaoEConhecido() {
        assertNull(SaldoParser.extrairSaldoMB(listOf("O seu saldo está disponível no menu.")))
        assertNull(SaldoParser.extrairSaldoMB(listOf("Internet: 1,5 GB")))
    }
}
