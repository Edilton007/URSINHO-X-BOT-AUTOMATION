package com.ursinhox.automation.agent

/**
 * Guarda a sequência de respostas que o UssdAccessibilityService deve enviar
 * automaticamente, uma por uma, conforme cada etapa do menu USSD aparece.
 *
 * Exemplo de uso para "transferir 10GB para 840132257" via *162#:
 *   UssdRoteiro.iniciar(listOf("8", "2", "10", "840132257"))
 * (o próprio código *162# é discado separadamente pela MainActivity; este
 * roteiro cobre só as respostas ENVIADAS DEPOIS que o menu já está aberto)
 *
 * Isto é um objeto simples em memória (singleton do processo do app) — não
 * sobrevive a reinício do app nem é seguro entre processos. Suficiente para
 * a Fase 1/2 de teste; numa versão futura isto deve vir do backend.
 */
object UssdRoteiro {

    @Volatile
    var ativo: Boolean = false
        private set

    /** Identificador crescente para distinguir duas sessões com menus idênticos. */
    @Volatile
    var geracaoSessao: Long = 0L
        private set

    private val fila: ArrayDeque<String> = ArrayDeque()

    /** Log de tudo o que o serviço de acessibilidade foi vendo/fazendo, para depuração. */
    private val historico = mutableListOf<String>()

    /**
     * Chamado uma única vez quando o roteiro termina (com sucesso, falha, ou
     * parada de segurança). Usado para encadear várias discagens em sequência
     * (ex: consultar saldo → transferir → consultar saldo de novo).
     */
    var aoTerminar: (() -> Unit)? = null

    fun iniciar(passos: List<String>): Boolean {
        if (ativo) {
            registrar(
                "AVISO: tentativa de iniciar um novo roteiro enquanto outro ainda " +
                "estava ativo — recusada, para não corromper a sessão USSD em andamento."
            )
            return false
        }
        fila.clear()
        fila.addAll(passos)
        geracaoSessao += 1L
        ativo = true
        return true
    }

    fun proximoPasso(): String? = fila.removeFirstOrNull()

    fun temProximoPasso(): Boolean = fila.isNotEmpty()

    fun parar() {
        fila.clear()
        ativo = false
        val callback = aoTerminar
        aoTerminar = null
        callback?.invoke()
    }

    fun registrar(linha: String) {
        historico.add(linha)
    }

    /** Limpa apenas quando começa um novo fluxo operacional completo. */
    fun limparHistorico() {
        historico.clear()
    }

    fun obterHistorico(): List<String> = historico.toList()
}
