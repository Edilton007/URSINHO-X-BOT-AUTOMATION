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
                UssdRoteiro.Passo("5", setOf("5. internet", "5 internet")),
                UssdRoteiro.Passo("8", setOf("8. servicos de internet", "8 servicos de internet", "8. internet services")),
                UssdRoteiro.Passo("2", setOf("2. transferir megas", "2 transferir megas", "2. transfer megabytes")),
                UssdRoteiro.Passo("2048", setOf("quantidade de megabytes", "quantidade em mb", "quantos mb", "amount in mb")),
                UssdRoteiro.Passo("841234567", setOf("numero de destino", "numero do destinatario", "introduza o numero", "destinatario", "recipient", "destination number"))
            ),
            VodacomUssdProtocol.roteiroTransferencia(2048, "841234567")
        )
    }
}
