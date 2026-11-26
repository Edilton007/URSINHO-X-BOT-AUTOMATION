package com.ursinhox.automation.agent

import java.text.Normalizer
import java.util.Locale

/**
 * Classifica apenas diálogos USSD que podem ser fechados sem aceitar uma
 * operação. Esta decisão nunca declara uma transferência como concluída.
 */
internal object UssdDialogClassifier {

    fun deveFecharComOk(texto: String): Boolean {
        val normalizado = normalizar(texto)
        if (normalizado.isBlank()) return false

        // Nunca fechar automaticamente um diálogo cujo OK possa avançar,
        // aceitar, comprar, pagar, subscrever ou confirmar uma operação.
        // Esta verificação vem antes da classificação de resultado final para
        // que qualquer pedido de decisão continue bloqueado.
        val exigeDecisao = listOf(
            "confirm", "confirmation", "para continuar", "continuar para",
            "continue", "proceed", "pretende", "deseja",
            "aceitar", "aceita", "accept", "comprar", "adquirir", "buy", "purchase",
            "subscrever", "subscription", "assinar", "pagar", "pagamento", "pay",
            "payment", "sera debitado", "serao debitados", "charged", "charge",
            "custo", "taxa", "fee", "cost", "cobrado", "cobrada", "transferir agora",
            "introduza", "digite", "responda", "selecione", "escolha",
            "press 1", "reply with", "enter the", "select", "choose", "option", "opcao",
            "retry", "try again", "again", "repeat", "another transfer",
            "transfer again", "tentar novamente", "repetir", "nova transferencia",
            "mais uma transferencia"
        ).any { normalizado.contains(it) }
        if (exigeDecisao) return false

        // Resultados explícitos da rede são informativos: podem ser fechados,
        // mas continuam sujeitos à validação independente do Backend.
        val resultadoFinal = listOf(
            "transferencia efetuada com sucesso",
            "transferencia realizada com sucesso",
            "transferencia concluida com sucesso",
            "transferencia nao concluida",
            "nao foi possivel efetuar a transferencia",
            "nao foi possivel concluir a transferencia",
            "transfer failed",
            "transaction failed",
            "transfer successful",
            "transfer completed",
            "insufficient balance",
            "insufficient funds"
        ).any { normalizado.contains(it) }
        if (resultadoFinal) return true

        // Mensagem promocional específica observada no telefone de teste.
        val avisoPromocionalConhecido =
            normalizado.contains("couldnt guess the best offer") &&
            normalizado.contains("dial now")
        if (avisoPromocionalConhecido) return true

        // Respostas de consulta de saldo/dados sem pedido de decisão.
        val quantidadeDeDados = Regex("""\b\d+(?:[,.]\d+)?\s*(?:mb|gb)\b""")
            .containsMatchIn(normalizado)
        val informacaoDeSaldo =
            ((normalizado.contains("saldo") || normalizado.contains("balance")) &&
                listOf("internet", "dados", "disponivel", "restante", "remaining", "available", "mb", "gb")
                    .any(normalizado::contains)) ||
                ((normalizado.contains("internet") || normalizado.contains("data")) && quantidadeDeDados)
        if (informacaoDeSaldo) return true

        val informacaoDeConsulta = listOf(
            "consulta concluida",
            "consulta efetuada",
            "consulta realizada",
            "consultation completed",
            "request completed"
        ).any(normalizado::contains)

        val informacaoDeDados =
            (normalizado.contains("you have") || normalizado.contains("voce tem")) &&
            listOf("internet", "data", "mb", "gb").any(normalizado::contains)

        val quotaMensalInformativa =
            listOf("mensal", "mensais", "monthly").any(normalizado::contains) &&
                Regex("""\b\d+(?:[,.]\d+)?\s*(?:mb|gb)\b""")
                    .containsMatchIn(normalizado)

        return informacaoDeConsulta || informacaoDeDados || quotaMensalInformativa
    }

    private fun normalizar(texto: String): String =
        Normalizer.normalize(texto.lowercase(Locale.ROOT), Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "")
            .replace(Regex("\\s+"), " ")
            .trim()
}
