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

    @Test
    fun bloqueiaConfirmacaoQuandoMenuIncluiTaxaOuCobrancaNaoAutorizada() {
        val passo = UssdRoteiro.Passo(
            resposta = "1",
            frasesEsperadas = setOf("1 para confirmar", "press 1 to confirm"),
            termosObrigatorios = setOf("841234567"),
            gruposTermosAlternativos = listOf(
                setOf("500 mb", "500mb"),
                setOf("transferir", "transferencia", "transfer")
            ),
            termosProibidos = setOf(
                "taxa", "custo", "fee", "charge", "charged", "cobrado", "debitado"
            )
        )
        assertTrue(UssdRoteiro.iniciarRoteiro(listOf(passo)))

        assertNull(
            UssdRoteiro.proximoPasso(
                "Transferir 500 MB para 841234567. Taxa de serviço 5 MT. 1 para confirmar."
            )
        )
        assertTrue(UssdRoteiro.temProximoPasso())

        assertEquals(
            "1",
            UssdRoteiro.proximoPasso(
                "Transferir 500 MB para 841234567. 1 para confirmar."
            )
        )
    }

    @Test
    fun roteiroVodacomBloqueiaQualquerReferenciaAValorDeCobranca() {
        val confirmacao = VodacomUssdProtocol.roteiroTransferencia(500, "841234567").last()
        assertTrue(confirmacao.termosProibidos.contains("taxa"))
        assertTrue(confirmacao.termosProibidos.contains("charged"))
        assertTrue(confirmacao.termosProibidos.contains("pagar"))
    }

}
