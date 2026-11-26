package com.ursinhox.automation.agent

/**
 * Sequência USSD documentada pela Vodacom Moçambique para transferência
 * de megabytes. Cada resposta exige correspondência com a opção/pergunta.
 */
internal object VodacomUssdProtocol {
    const val CODIGO_CONSULTA_SALDO = "*100#"
    const val CODIGO_TRANSFERENCIA_MEGAS = "*111#"

    fun roteiroTransferencia(megas: Int, destino: String): List<UssdRoteiro.Passo> =
        listOf(
            UssdRoteiro.Passo("5", setOf("5. internet", "5 internet")),
            UssdRoteiro.Passo(
                "8",
                setOf("8. servicos de internet", "8 servicos de internet", "8. internet services")
            ),
            UssdRoteiro.Passo(
                "2",
                setOf("2. transferir megas", "2 transferir megas", "2. transfer megabytes")
            ),
            UssdRoteiro.Passo(
                megas.toString(),
                setOf("quantidade de megabytes", "quantidade em mb", "quantos mb", "amount in mb")
            ),
            UssdRoteiro.Passo(
                destino,
                setOf(
                    "numero de destino",
                    "numero do destinatario",
                    "introduza o numero",
                    "destinatario",
                    "recipient",
                    "destination number"
                )
            )
        )
}
