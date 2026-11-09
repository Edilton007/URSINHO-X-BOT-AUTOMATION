package com.ursinhox.automation.agent

import org.junit.Assert.assertEquals
import org.junit.Test

class OperadoraVodacomTest {
    @Test fun aceitaNomesConhecidosDaVodacom() {
        assertEquals(true, OperadoraVodacom.aceita("Vodacom"))
        assertEquals(true, OperadoraVodacom.aceita("Vodacom MZ"))
        assertEquals(true, OperadoraVodacom.aceita("Vodacom Moçambique"))
        assertEquals(true, OperadoraVodacom.aceita("VODACOM MOZAMBIQUE"))
    }

    @Test fun rejeitaEtiquetasQueApenasContemVodacom() {
        assertEquals(false, OperadoraVodacom.aceita("NotVodacom"))
        assertEquals(false, OperadoraVodacom.aceita("Vodacom Fake"))
        assertEquals(false, OperadoraVodacom.aceita("Movitel"))
        assertEquals(false, OperadoraVodacom.aceita(null))
    }
}
