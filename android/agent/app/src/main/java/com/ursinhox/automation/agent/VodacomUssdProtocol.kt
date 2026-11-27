package com.ursinhox.automation.agent

/**
 * Sequência USSD de transferência de megabytes confirmada pelo responsável
 * operacional do projecto: *162# → 8 → 2 → quantidade → destino.
 * Cada resposta exige correspondência com a opção/pergunta visível.
 *
 * O último "1" só é enviado se a rede apresentar explicitamente a opção
 * de confirmar e repetir a quantidade e o número de destino desta tarefa.
 */
internal object VodacomUssdProtocol {
    // *131# é reportado por referência externa como consulta de dados.
    // A resposta e a quota mensal só ficam validadas após teste real da SIM.
    const val CODIGO_CONSULTA_SALDO = "*131#"
    const val CODIGO_TRANSFERENCIA_MEGAS = "*162#"

    fun roteiroTransferencia(megas: Int, destino: String): List<UssdRoteiro.Passo> {
        require(megas in 100..10240) {
            "A transferência deve ter entre 100 MB e 10.240 MB."
        }
        val destinoLocal = destino.filter(Char::isDigit).let {
            if (it.startsWith("258") && it.length == 12) it.drop(3) else it
        }
        require(Regex("^(84|85)\\d{7}$").matches(destinoLocal)) {
            "O destino deve ser um número Vodacom válido (84/85)."
        }
        val quantidade = megas.toString()

        return listOf(
            UssdRoteiro.Passo(
                "8",
                setOf(
                    "8. servicos de internet",
                    "8 servicos de internet",
                    "8. internet services",
                    "8. internet",
                    "8 internet",
                    "8. transferir megas",
                    "8 transferir megas"
                )
            ),
            UssdRoteiro.Passo(
                "2",
                setOf("2. transferir megas", "2 transferir megas", "2. transfer megabytes")
            ),
            UssdRoteiro.Passo(
                quantidade,
                setOf("quantidade de megabytes", "quantidade em mb", "quantos mb", "amount in mb")
            ),
            UssdRoteiro.Passo(
                destinoLocal,
                setOf(
                    "numero de destino",
                    "numero do destinatario",
                    "introduza o numero",
                    "destinatario",
                    "recipient",
                    "destination number"
                )
            ),
            UssdRoteiro.Passo(
                "1",
                setOf(
                    "1 para confirmar",
                    "1. confirmar",
                    "1 - confirmar",
                    "1 confirmar",
                    "press 1 to confirm",
                    "reply 1 to confirm"
                ),
                termosObrigatorios = setOf(destinoLocal),
                gruposTermosAlternativos = listOf(
                    setOf("$quantidade mb", "${quantidade}mb"),
                    setOf("transferir", "transferencia", "transfer")
                ),
                // A tarefa não transporta uma autorização de preço/taxa USSD.
                // Qualquer referência a cobrança exige revisão humana.
                termosProibidos = setOf(
                    "taxa", "taxas", "custo", "custos", "fee", "fees",
                    "charge", "charged", "cobrar", "cobrado", "cobrada",
                    "debitado", "debitada", "sera debitado", "serao debitados",
                    "pagar", "pagamento", "payment"
                )
            )
        )
    }
}
