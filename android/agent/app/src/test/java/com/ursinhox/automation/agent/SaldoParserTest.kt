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
    fun converteSaldoGeralComDecimalEmGigabytes() {
        assertEquals(1536, SaldoParser.extrairSaldoMB(listOf("Saldo de dados: 1,5 GB")))
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
    fun identificaQuotaMensalApenasQuandoTransferibilidadeTambemEstaExplicita() {
        assertEquals(
            1536,
            SaldoParser.extrairSaldoMensalTransferivelMB(
                listOf("Benefício de Internet mensal transferível: 1,5 GB")
            )
        )
        assertEquals(
            750,
            SaldoParser.extrairSaldoMensalTransferivelMB(
                listOf("750 MB de dados mensais disponíveis para transferência")
            )
        )
        assertEquals(
            2048,
            SaldoParser.extrairSaldoMensalTransferivelMB(
                listOf("2 GB monthly transferable data")
            )
        )
    }

    @Test
    fun naoConfundeDadosMensaisComQuotaTransferivel() {
        assertNull(
            SaldoParser.extrairSaldoMensalTransferivelMB(
                listOf("750 MB de dados mensais")
            )
        )
        assertNull(
            SaldoParser.extrairSaldoMensalTransferivelMB(
                listOf("Benefício mensal de Internet: 1 GB")
            )
        )
        assertNull(
            SaldoParser.extrairSaldoMensalTransferivelMB(
                listOf("2 GB de dados mensais, taxa de transferência de saldo: 3 MT")
            )
        )
        assertNull(
            SaldoParser.extrairSaldoMensalTransferivelMB(
                listOf("Internet: 500 MB", "Dados diários: 1 GB")
            )
        )
        assertNull(
            SaldoParser.extrairSaldoMensalTransferivelMB(
                listOf("Saldo geral: 2 GB")
            )
        )
    }

    @Test
    fun quotaMensalTransferivelNaoEReportadaComoSaldoGeral() {
        assertNull(
            SaldoParser.extrairSaldoMB(
                listOf("2 GB de Internet mensal transferível")
            )
        )
    }

    @Test
    fun naoInventaLeituraQuandoFormatoNaoEConhecido() {
        assertNull(SaldoParser.extrairSaldoMB(listOf("O seu saldo está disponível no menu.")))
        assertNull(SaldoParser.extrairSaldoMensalTransferivelMB(listOf("Internet disponível no menu.")))
    }
}
