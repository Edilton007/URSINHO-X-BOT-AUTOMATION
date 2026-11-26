package com.ursinhox.automation.agent

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UssdDialogClassifierTest {

    @Test
    fun reconheceAvisoPromocionalMostradoPelaOperadora() {
        val texto = "We are very sorry we couldnt guess the best offer for you today! Dial now *109# and get your favorite."
        assertTrue(UssdDialogClassifier.deveFecharComOk(texto))
    }

    @Test
    fun reconheceMensagemInformativaDeSaldo() {
        assertTrue(
            UssdDialogClassifier.deveFecharComOk(
                "Saldo de Internet disponível: 1,5 GB"
            )
        )
    }

    @Test
    fun reconheceFormatoDeSaldoInternetDoParser() {
        assertTrue(
            UssdDialogClassifier.deveFecharComOk("Internet: 500 MB")
        )
    }

    @Test
    fun naoFechaMesmoQuandoMensagemDeResultadoPedeOutraConfirmacao() {
        assertFalse(
            UssdDialogClassifier.deveFecharComOk(
                "Transferência efetuada com sucesso. Deseja comprar outro pacote? Pressione OK para continuar."
            )
        )
    }

    @Test
    fun permiteFecharResultadoFinalSemDeclararSucessoNoCliente() {
        assertTrue(
            UssdDialogClassifier.deveFecharComOk(
                "Transferência efetuada com sucesso. Pressione OK."
            )
        )
    }

    @Test
    fun naoFechaConfirmacaoDeTransferencia() {
        assertFalse(
            UssdDialogClassifier.deveFecharComOk(
                "Deseja confirmar a transferência de 1 GB? Pressione OK para continuar."
            )
        )
    }

    @Test
    fun naoFechaConfirmacaoDeCompraOuCobranca() {
        assertFalse(
            UssdDialogClassifier.deveFecharComOk(
                "O pacote custa 50 MT. Pressione OK para comprar."
            )
        )
    }

    @Test
    fun naoFechaDialogoDesconhecido() {
        assertFalse(
            UssdDialogClassifier.deveFecharComOk(
                "We could not process your request. OK"
            )
        )
    }
}
