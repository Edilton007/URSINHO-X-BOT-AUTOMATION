package com.ursinhox.automation.agent

/**
 * Sequência USSD documentada pela Vodacom Moçambique para transferência
 * de megabytes. Rever este protocolo após qualquer alteração da operadora.
 */
internal object VodacomUssdProtocol {
    const val CODIGO_CONSULTA_SALDO = "*100#"
    const val CODIGO_TRANSFERENCIA_MEGAS = "*111#"

    fun roteiroTransferencia(megas: Int, destino: String): List<String> =
        listOf("5", "8", "2", megas.toString(), destino)
}
