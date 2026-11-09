package com.ursinhox.automation.agent

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Cliente HTTP do URSINHO X BOT AUTOMATION.
 *
 * O Backend decide:
 * - qual tarefa deve ser executada
 * - qual SIM deve ser usado
 * - simId
 * - simSlot
 *
 * O Agent apenas executa e devolve evidência real.
 *
 * Todas as chamadas são bloqueantes.
 * Executar sempre fora da Main Thread.
 */
object BackendClient {

    data class Tarefa(
        val id: String,
        val opId: String,
        val megas: Int,
        val destino: String,
        val simId: String,
        val simSlot: Int,
        val subscriptionId: Int
    )

    data class InicioTarefa(
        val claimToken: String,
        val leaseExpiresAtMs: Long?,
        val simId: String,
        val simSlot: Int,
        val subscriptionId: Int,
        val estado: String,
        val idempotente: Boolean
    )

    sealed class Resultado<out T> {

        data class Sucesso<T>(
            val valor: T
        ) : Resultado<T>()

        data class Erro(
            val mensagem: String
        ) : Resultado<Nothing>()
    }

    /**
     * Busca tarefas pendentes destinadas a este Device.
     */
    fun buscarTarefas(
        baseUrl: String,
        apiKey: String,
        deviceId: String
    ): Resultado<List<Tarefa>> {

        val url =
            "${baseUrl.trimEnd('/')}/automation/device/$deviceId/tarefas"

        val (resposta, erro) =
            requisicao(
                url,
                "GET",
                apiKey,
                null
            )

        if (resposta == null) {

            return Resultado.Erro(
                erro ?: "Falha desconhecida de conexão."
            )
        }

        return try {

            val json =
                JSONObject(resposta)

            if (!json.optBoolean("ok", false)) {

                return Resultado.Erro(
                    "Backend respondeu ok=false: $resposta"
                )
            }

            val lista =
                mutableListOf<Tarefa>()

            val array: JSONArray =
                json.optJSONArray("tarefas")
                    ?: JSONArray()

            for (i in 0 until array.length()) {

                val item =
                    array.getJSONObject(i)

                val simId =
                    item.optString(
                        "simId",
                        ""
                    )

                val simSlot =
                    item.optInt(
                        "simSlot",
                        -1
                    )

                val subscriptionId =
                    item.optInt(
                        "subscriptionId",
                        -1
                    )

                lista.add(
                    Tarefa(
                        id =
                            item.getString("id"),

                        opId =
                            item.getString("opId"),

                        megas =
                            item.getInt("megas"),

                        destino =
                            item.getString("destino"),

                        simId =
                            simId,

                        simSlot =
                            simSlot,

                        subscriptionId =
                            subscriptionId
                    )
                )
            }

            Resultado.Sucesso(
                lista
            )

        } catch (e: Exception) {

            Resultado.Erro(
                "Resposta inesperada do backend: ${e.message}"
            )
        }
    }

    /**
     * Solicita ao Backend o início da execução.
     *
     * O Backend entrega:
     * - claimToken
     * - lease
     * - simId
     * - simSlot
     *
     * O Agent não escolhe o SIM.
     */
    fun iniciarTarefa(
        baseUrl: String,
        apiKey: String,
        deviceId: String,
        taskId: String
    ): Resultado<InicioTarefa> {

        val url =
            "${baseUrl.trimEnd('/')}/automation/device/$deviceId/tarefas/$taskId/iniciar"

        val (resposta, erro) =
            requisicao(
                url,
                "POST",
                apiKey,
                JSONObject().toString()
            )

        if (resposta == null) {

            return Resultado.Erro(
                erro ?: "Falha desconhecida de conexão."
            )
        }

        return try {

            val json =
                JSONObject(resposta)

            if (!json.optBoolean("ok", false)) {

                return Resultado.Erro(
                    json.optString(
                        "error",
                        "Backend recusou o início da tarefa."
                    )
                )
            }

            val claimToken =
                json.optString(
                    "claimToken",
                    ""
                )

            val simId =
                json.optString(
                    "simId",
                    ""
                )

            val simSlot =
                json.optInt(
                    "simSlot",
                    -1
                )

            val subscriptionId =
                json.optInt(
                    "subscriptionId",
                    -1
                )

            val estado =
                json.optString(
                    "estado",
                    ""
                )

            val idempotente =
                json.optBoolean(
                    "idempotente",
                    false
                )

            val leaseExpiresAtMs =
                if (
                    json.has("leaseExpiresAtMs") &&
                    !json.isNull("leaseExpiresAtMs")
                ) {
                    json.optLong(
                        "leaseExpiresAtMs"
                    )
                } else {
                    null
                }

            if (claimToken.isBlank()) {

                return Resultado.Erro(
                    "Backend não devolveu claimToken."
                )
            }

            if (simId.isBlank()) {

                return Resultado.Erro(
                    "Backend não devolveu simId."
                )
            }

            if (
                simSlot != 0 &&
                simSlot != 1
            ) {

                return Resultado.Erro(
                    "Backend devolveu simSlot inválido: $simSlot"
                )
            }

            if (subscriptionId < 0) {
                return Resultado.Erro(
                    "Backend não devolveu o subscriptionId do SIM selecionado."
                )
            }

            Resultado.Sucesso(
                InicioTarefa(
                    claimToken =
                        claimToken,

                    leaseExpiresAtMs =
                        leaseExpiresAtMs,

                    simId =
                        simId,

                    simSlot =
                        simSlot,

                    subscriptionId =
                        subscriptionId,

                    estado =
                        estado,

                    idempotente =
                        idempotente
                )
            )

        } catch (e: Exception) {

            Resultado.Erro(
                "Resposta inesperada do backend: ${e.message}"
            )
        }
    }

    /**
     * Envia o resultado autenticado de uma tarefa.
     *
     * O Backend valida:
     * - claimToken
     * - simId
     * - simSlot
     * - saldo antes
     * - saldo depois
     *
     * A diferença real dos saldos é a autoridade para decidir
     * se a transferência foi concluída.
     */
    fun enviarResultado(
        baseUrl: String,
        apiKey: String,
        deviceId: String,
        taskId: String,
        claimToken: String,
        simId: String,
        simSlot: Int,
        subscriptionId: Int,
        saldoAntesMB: Int?,
        saldoDepoisMB: Int?,
        sucessoRedeReportado: Boolean?,
        logBruto: String
    ): Resultado<Boolean> {

        if (claimToken.isBlank()) {

            return Resultado.Erro(
                "claimToken vazio."
            )
        }

        if (simId.isBlank()) {

            return Resultado.Erro(
                "simId vazio."
            )
        }

        if (subscriptionId < 0) {
            return Resultado.Erro("subscriptionId inválido.")
        }

        if (
            simSlot != 0 &&
            simSlot != 1
        ) {

            return Resultado.Erro(
                "simSlot inválido. Use 0 ou 1."
            )
        }

        val url =
            "${baseUrl.trimEnd('/')}/automation/device/$deviceId/tarefas/$taskId/resultado"

        val corpo =
            JSONObject().apply {

                put(
                    "claimToken",
                    claimToken
                )

                put(
                    "simId",
                    simId
                )

                put(
                    "simSlot",
                    simSlot
                )

                put(
                    "subscriptionId",
                    subscriptionId
                )

                put(
                    "saldoAntesMB",
                    saldoAntesMB
                        ?: JSONObject.NULL
                )

                put(
                    "saldoDepoisMB",
                    saldoDepoisMB
                        ?: JSONObject.NULL
                )

                if (sucessoRedeReportado == null) {

                    put(
                        "sucessoRedeReportado",
                        JSONObject.NULL
                    )

                } else {

                    put(
                        "sucessoRedeReportado",
                        sucessoRedeReportado
                    )
                }

                put(
                    "logBruto",
                    logBruto
                )
            }

        val (resposta, erro) =
            requisicao(
                url,
                "POST",
                apiKey,
                corpo.toString()
            )

        if (resposta == null) {

            return Resultado.Erro(
                erro ?: "Falha desconhecida de conexão."
            )
        }

        return try {

            val json =
                JSONObject(resposta)

            if (!json.optBoolean("ok", false)) {

                Resultado.Erro(
                    json.optString(
                        "error",
                        "Backend respondeu ok=false: $resposta"
                    )
                )

            } else {

                Resultado.Sucesso(
                    true
                )
            }

        } catch (e: Exception) {

            Resultado.Erro(
                "Resposta inesperada do backend: ${e.message}"
            )
        }
    }

    /**
     * Compatibilidade com o MainActivity antigo.
     *
     * O MainActivity ainda usa a assinatura antiga.
     *
     * Aqui fazemos:
     * 1. iniciar a tarefa
     * 2. receber claimToken + SIM decidido pelo Backend
     * 3. enviar o resultado pela API nova
     *
     * Assim não precisamos alterar o MainActivity agora.
     */
    fun enviarResultado(
        baseUrl: String,
        apiKey: String,
        deviceId: String,
        taskId: String,
        saldoAntesMB: Int?,
        saldoDepoisMB: Int?,
        logBruto: String
    ): Resultado<Boolean> {

        return when (
            val inicio =
                iniciarTarefa(
                    baseUrl =
                        baseUrl,
                    apiKey =
                        apiKey,
                    deviceId =
                        deviceId,
                    taskId =
                        taskId
                )
        ) {

            is Resultado.Erro -> {

                Resultado.Erro(
                    inicio.mensagem
                )
            }

            is Resultado.Sucesso -> {

                val dados =
                    inicio.valor

                enviarResultado(
                    baseUrl =
                        baseUrl,

                    apiKey =
                        apiKey,

                    deviceId =
                        deviceId,

                    taskId =
                        taskId,

                    claimToken =
                        dados.claimToken,

                    simId =
                        dados.simId,

                    simSlot =
                        dados.simSlot,

                    subscriptionId =
                        dados.subscriptionId,

                    saldoAntesMB =
                        saldoAntesMB,

                    saldoDepoisMB =
                        saldoDepoisMB,

                    sucessoRedeReportado =
                        null,

                    logBruto =
                        logBruto
                )
            }
        }
    }

    /**
     * Envia telemetria real de um SIM.
     *
     * internetMB deve vir da leitura real do USSD.
     * saldoMT pode ser nulo quando não existir leitura
     * monetária disponível.
     */
    fun enviarStatusSim(
        baseUrl: String,
        apiKey: String,
        deviceId: String,
        slot: Int,
        operadora: String,
        internetMB: Int,
        subscriptionId: Int,
        saldoMT: Double? = null
    ): Resultado<Boolean> {

        if (
            slot != 0 &&
            slot != 1
        ) {

            return Resultado.Erro(
                "slot inválido. Use 0 ou 1."
            )
        }

        if (subscriptionId < 0) {
            return Resultado.Erro("subscriptionId inválido.")
        }

        val url =
            "${baseUrl.trimEnd('/')}/automation/device/$deviceId/sim-status"

        val corpo =
            JSONObject().apply {

                put(
                    "slot",
                    slot
                )

                put(
                    "operadora",
                    operadora
                )

                put(
                    "internetMB",
                    internetMB
                )

                put(
                    "subscriptionId",
                    subscriptionId
                )

                put(
                    "saldoMT",
                    saldoMT
                        ?: JSONObject.NULL
                )
            }

        val (resposta, erro) =
            requisicao(
                url,
                "POST",
                apiKey,
                corpo.toString()
            )

        if (resposta == null) {

            return Resultado.Erro(
                erro ?: "Falha desconhecida de conexão."
            )
        }

        return try {

            val json =
                JSONObject(resposta)

            if (
                !json.optBoolean(
                    "ok",
                    false
                )
            ) {

                Resultado.Erro(
                    "Backend respondeu ok=false: $resposta"
                )

            } else {

                Resultado.Sucesso(
                    true
                )
            }

        } catch (e: Exception) {

            Resultado.Erro(
                "Resposta inesperada do backend: ${e.message}"
            )
        }
    }

    /**
     * Requisição HTTP.
     *
     * Deve sempre ser executada fora da Main Thread.
     */
    private fun requisicao(
        urlStr: String,
        metodo: String,
        apiKey: String,
        corpo: String?
    ): Pair<String?, String?> {

        var conexao: HttpURLConnection? =
            null

        return try {

            conexao =
                URL(urlStr)
                    .openConnection() as HttpURLConnection

            conexao.requestMethod =
                metodo

            conexao.setRequestProperty(
                "x-api-key",
                apiKey
            )

            conexao.setRequestProperty(
                "Content-Type",
                "application/json"
            )

            conexao.setRequestProperty(
                "Accept",
                "application/json"
            )

            conexao.connectTimeout =
                10000

            conexao.readTimeout =
                10000

            conexao.useCaches =
                false

            if (corpo != null) {

                conexao.doOutput =
                    true

                OutputStreamWriter(
                    conexao.outputStream,
                    Charsets.UTF_8
                ).use { escritor ->

                    escritor.write(
                        corpo
                    )

                    escritor.flush()
                }
            }

            val codigo =
                conexao.responseCode

            val fluxo =
                if (codigo in 200..299) {

                    conexao.inputStream

                } else {

                    conexao.errorStream
                }

            val texto =
                if (fluxo != null) {

                    BufferedReader(
                        InputStreamReader(
                            fluxo,
                            Charsets.UTF_8
                        )
                    ).use { leitor ->

                        leitor.readText()
                    }

                } else {

                    ""
                }

            if (codigo !in 200..299) {

                Pair(
                    null,
                    "HTTP $codigo: $texto"
                )

            } else {

                Pair(
                    texto,
                    null
                )
            }

        } catch (e: Exception) {

            Pair(
                null,
                "${e.javaClass.simpleName}: ${e.message}"
            )

        } finally {

            conexao?.disconnect()
        }
    }
}
