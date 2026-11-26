package com.ursinhox.automation.agent

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UssdRoteiroTest {
    @After
    fun limparEstado() {
        UssdRoteiro.aoTerminar = null
        if (UssdRoteiro.ativo) UssdRoteiro.parar()
        UssdRoteiro.limparHistorico()
    }

    @Test
    fun preservaEvidenciasEntreSessoesDoMesmoFluxoOperacional() {
        assertTrue(UssdRoteiro.iniciar(listOf("2")))
        UssdRoteiro.registrar("SALDO_ANTES: 1500 MB")
        UssdRoteiro.parar()

        val primeiraGeracao = UssdRoteiro.geracaoSessao
        assertTrue(UssdRoteiro.iniciar(listOf("8", "2", "100", "841234567")))
        assertTrue(UssdRoteiro.geracaoSessao > primeiraGeracao)
        UssdRoteiro.registrar("TRANSFERENCIA: efetuada com sucesso")
        UssdRoteiro.parar()

        assertTrue(UssdRoteiro.iniciar(listOf("2")))
        UssdRoteiro.registrar("SALDO_DEPOIS: 1400 MB")

        assertEquals(
            listOf(
                "SALDO_ANTES: 1500 MB",
                "TRANSFERENCIA: efetuada com sucesso",
                "SALDO_DEPOIS: 1400 MB"
            ),
            UssdRoteiro.obterHistorico()
        )
    }

    @Test
    fun naoConsomeRespostaQuandoTextoDoMenuNaoCorresponde() {
        assertTrue(
            UssdRoteiro.iniciarRoteiro(
                listOf(UssdRoteiro.Passo("5", setOf("internet")))
            )
        )

        assertNull(UssdRoteiro.proximoPasso("1. M-Pesa"))
        assertTrue(UssdRoteiro.temProximoPasso())
        assertEquals("5", UssdRoteiro.proximoPasso("5. Internet"))
        assertTrue(!UssdRoteiro.temProximoPasso())
    }

    @Test
    fun limparHistoricoIniciaUmFluxoOperacionalNovo() {
        assertTrue(UssdRoteiro.iniciar(emptyList()))
        UssdRoteiro.registrar("EVIDENCIA_ANTIGA")
        UssdRoteiro.parar()

        UssdRoteiro.limparHistorico()

        assertTrue(UssdRoteiro.obterHistorico().isEmpty())
    }
}
