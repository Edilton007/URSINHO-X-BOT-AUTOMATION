package com.ursinhox.automation.agent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class VodacomUssdProtocolTest {

    @Test
    fun usaCodigoDeConsultaDeDadosPendenteDeValidacaoFisica() {
        // A referência de consulta mantém-se por confirmar no teste físico.
        assertEquals("*131#", VodacomUssdProtocol.CODIGO_CONSULTA_SALDO)
    }

    @Test
    fun usaMenuDeTransferencia162ComOpcoes8E2() {
        assertEquals("*162#", VodacomUssdProtocol.CODIGO_TRANSFERENCIA_MEGAS)
        val roteiro = VodacomUssdProtocol.roteiroTransferencia(2048, "258841234567")

        assertEquals(5, roteiro.size)
        assertEquals("8", roteiro[0].resposta)
        assertEquals("2", roteiro[1].resposta)
        assertEquals("2048", roteiro[2].resposta)
        assertEquals("841234567", roteiro[3].resposta)
        assertEquals("1", roteiro[4].resposta)
        assertTrue(roteiro[4].termosObrigatorios.contains("841234567"))
        assertTrue(roteiro[4].gruposTermosAlternativos.contains(setOf("2048 mb", "2048mb")))
    }

    @Test
    fun percorreSequenciaCompleta1628QuantidadeDestinoNaOrdemConfirmada() {
        assertEquals("*162#", VodacomUssdProtocol.CODIGO_TRANSFERENCIA_MEGAS)
        val roteiro = VodacomUssdProtocol.roteiroTransferencia(10240, "258841234567")
        assertTrue(UssdRoteiro.iniciarRoteiro(roteiro))

        assertEquals(
            "8",
            UssdRoteiro.proximoPasso("1. Consultar saldo  8. Internet  9. Outros serviços")
        )
        assertEquals(
            "2",
            UssdRoteiro.proximoPasso("1. Consultar saldo  2. Transferir megas  3. Voltar")
        )
        assertEquals(
            "10240",
            UssdRoteiro.proximoPasso("Introduza a quantidade de megabytes que pretende transferir")
        )
        assertEquals(
            "841234567",
            UssdRoteiro.proximoPasso("Introduza o número de destino")
        )
        assertEquals(
            "1",
            UssdRoteiro.proximoPasso(
                "Transferência de 10240 MB para 841234567. Responde 1 para confirmar."
            )
        )

        assertTrue(!UssdRoteiro.temProximoPasso())
        UssdRoteiro.parar()
    }

    @Test
    fun selecionaOpcao8ApenasQuandoExisteNoMenuComContextoDeInternet() {
        val passo = VodacomUssdProtocol.roteiroTransferencia(500, "841234567").first()
        assertTrue(UssdRoteiro.iniciarRoteiro(listOf(passo)))

        val resposta = UssdRoteiro.proximoPasso(
            "1. Consultar saldo  8. Internet  9. Outros serviços"
        )

        assertEquals("8", resposta)
        UssdRoteiro.parar()
    }

    @Test
    fun naoSelecionaOpcao8QuandoOTextoEDeOutroMenu() {
        val passo = VodacomUssdProtocol.roteiroTransferencia(500, "841234567").first()
        assertTrue(UssdRoteiro.iniciarRoteiro(listOf(passo)))

        assertEquals(
            null,
            UssdRoteiro.proximoPasso("1. Consultar saldo  8. Saldo  9. Outros serviços")
        )
        assertTrue(UssdRoteiro.temProximoPasso())
        UssdRoteiro.parar()
    }

    @Test
    fun selecionaOpcao2ApenasQuandoOItemIndicaTransferencia() {
        val passo = VodacomUssdProtocol.roteiroTransferencia(500, "841234567")[1]
        assertTrue(UssdRoteiro.iniciarRoteiro(listOf(passo)))

        val resposta = UssdRoteiro.proximoPasso(
            "1. Consultar saldo  2. Transferir megas  3. Voltar"
        )

        assertEquals("2", resposta)
        UssdRoteiro.parar()
    }

    @Test
    fun aceitaLimitesMinimoEMaximoDeUmaTransferencia() {
        assertEquals("100", VodacomUssdProtocol.roteiroTransferencia(100, "841234567")[2].resposta)
        assertEquals("10240", VodacomUssdProtocol.roteiroTransferencia(10240, "851234567")[2].resposta)
    }

    @Test
    fun bloqueiaQuantidadeForaDoIntervaloPermitido() {
        assertThrows(IllegalArgumentException::class.java) {
            VodacomUssdProtocol.roteiroTransferencia(99, "841234567")
        }
        assertThrows(IllegalArgumentException::class.java) {
            VodacomUssdProtocol.roteiroTransferencia(10241, "841234567")
        }
    }

    @Test
    fun bloqueiaDestinoQueNaoSejaVodacom84Ou85() {
        assertThrows(IllegalArgumentException::class.java) {
            VodacomUssdProtocol.roteiroTransferencia(100, "861234567")
        }
        assertThrows(IllegalArgumentException::class.java) {
            VodacomUssdProtocol.roteiroTransferencia(100, "84123456")
        }
    }

    @Test
    fun soConfirmaQuandoQuantidadeDestinoEOpcao1EstaoPresentes() {
        val confirmacao = VodacomUssdProtocol.roteiroTransferencia(100, "841234567").last()
        assertTrue(UssdRoteiro.iniciarRoteiro(listOf(confirmacao)))

        val resposta = UssdRoteiro.proximoPasso(
            "Transferência de 100 MB para 841234567. Responde 1 para confirmar."
        )

        assertEquals("1", resposta)
        UssdRoteiro.parar()
    }

    @Test
    fun bloqueiaConfirmacaoQuandoNumeroOuQuantidadeNaoCorrespondem() {
        val confirmacao = VodacomUssdProtocol.roteiroTransferencia(100, "841234567").last()
        assertTrue(UssdRoteiro.iniciarRoteiro(listOf(confirmacao)))

        val resposta = UssdRoteiro.proximoPasso(
            "Transferência de 500 MB para 841234567. Responde 1 para confirmar."
        )

        org.junit.Assert.assertNull(resposta)
        assertTrue(UssdRoteiro.temProximoPasso())
        UssdRoteiro.parar()
    }
}
