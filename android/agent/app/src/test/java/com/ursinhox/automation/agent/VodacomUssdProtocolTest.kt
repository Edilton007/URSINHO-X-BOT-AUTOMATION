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
            listOf("5", "8", "2", "2048", "841234567"),
            VodacomUssdProtocol.roteiroTransferencia(2048, "841234567")
        )
    }
}
