package com.ursinhox.automation.agent

import org.junit.Assert.assertEquals
import org.junit.Test

class VodacomUssdProtocolTest {

    @Test
    fun utilizaCodigoOficialDeConsultaDeSaldo() {
        assertEquals("*100#", VodacomUssdProtocol.CODIGO_CONSULTA_SALDO)
    }

    @Test
    fun utilizaMenuOficialDeTransferenciaDeMegas() {
        assertEquals("*111#", VodacomUssdProtocol.CODIGO_TRANSFERENCIA_MEGAS)
        assertEquals(
            listOf(
                UssdRoteiro.Passo("5", setOf("internet")),
                UssdRoteiro.Passo("8", setOf("servicos de internet", "servicos internet", "internet services")),
                UssdRoteiro.Passo("2", setOf("transferir megas", "transferencia de megas", "transfer megabytes")),
                UssdRoteiro.Passo("2048", setOf("quantidade", "megabytes", "quantos mb", "amount in mb")),
                UssdRoteiro.Passo("841234567", setOf("numero de destino", "numero do destinatario", "destinatario", "recipient", "destination number"))
            ),
            VodacomUssdProtocol.roteiroTransferencia(2048, "841234567")
        )
    }
}
