package com.ursinhox.automation.agent

/**
 * Sequência USSD documentada pela Vodacom Moçambique para transferência
 * de megabytes. Cada resposta exige correspondência com o texto do menu.
 */
internal object VodacomUssdProtocol {
    const val CODIGO_CONSULTA_SALDO = "*100#"
    const val CODIGO_TRANSFERENCIA_MEGAS = "*111#"

    fun roteiroTransferencia(megas: Int, destino: String): List<UssdRoteiro.Passo> =
        listOf(
            UssdRoteiro.Passo("5", setOf("internet")),
            UssdRoteiro.Passo(
                "8",
                setOf("servicos de internet", "servicos internet", "internet services")
            ),
            UssdRoteiro.Passo(
                "2",
                setOf("transferir megas", "transferencia de megas", "transfer megabytes")
            ),
            UssdRoteiro.Passo(
                megas.toString(),
                setOf("quantidade", "megabytes", "quantos mb", "amount in mb")
            ),
            UssdRoteiro.Passo(
                destino,
                setOf(
                    "numero de destino",
                    "numero do destinatario",
                    "destinatario",
                    "recipient",
                    "destination number"
                )
            )
        )
}
