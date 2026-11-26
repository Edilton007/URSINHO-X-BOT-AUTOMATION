package com.ursinhox.automation.agent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class VodacomUssdProtocolTest {

    @Test
    fun utilizaCodigoOficialDeConsultaDeSaldo() {
        assertEquals("*100#", VodacomUssdProtocol.CODIGO_CONSULTA_SALDO)
    }

    @Test
    fun usaConsultaDeDadosQueExigeValidacaoFisicaDaQuotaMensal() {
        assertEquals("*131#", VodacomUssdProtocol.CODIGO_CONSULTA_SALDO)
    }

    @Test
    fun utilizaMenuOficialDeTransferenciaDeMegas() {
        assertEquals("*111#", VodacomUssdProtocol.CODIGO_TRANSFERENCIA_MEGAS)
        val roteiro = VodacomUssdProtocol.roteiroTransferencia(2048, "258841234567")

        assertEquals("5", roteiro[0].resposta)
        assertEquals("8", roteiro[1].resposta)
        assertEquals("2", roteiro[2].resposta)
        assertEquals("2048", roteiro[3].resposta)
        assertEquals("841234567", roteiro[4].resposta)
        assertEquals("1", roteiro[5].resposta)
        assertTrue(roteiro[5].termosObrigatorios.contains("841234567"))
        assertTrue(roteiro[5].gruposTermosAlternativos.contains(setOf("2048 mb", "2048mb")))
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

        assertNull(resposta)
        assertTrue(UssdRoteiro.temProximoPasso())
        UssdRoteiro.parar()
    }
}
