package com.ursinhox.automation.agent

import org.junit.Assert.assertEquals
import org.junit.Test

class UssdResultadoClassifierTest {
    @Test fun reconheceConfirmacaoExplicita() {
        assertEquals(true, UssdResultadoClassifier.classificar("Transferência efetuada com sucesso"))
    }

    @Test fun reconheceFalhaMesmoComAcentos() {
        assertEquals(false, UssdResultadoClassifier.classificar("A transferência não foi concluída"))
    }

    @Test fun respostaAmbiguaNaoEConsideradaSucesso() {
        assertEquals(null, UssdResultadoClassifier.classificar("Pedido recebido. Aguarde confirmação."))
    }

    @Test fun falhaTemPrioridadeSobreTextoPositivoAmbiguo() {
        assertEquals(false, UssdResultadoClassifier.classificar("Transferência concluída, mas ocorreu erro na transferência"))
    }
}
