package com.ursinhox.automation.agent

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import androidx.annotation.RequiresApi

/**
 * Envia um código USSD usando a API oficial do Android e devolve a resposta
 * real da rede através do callback. Não inventa nem simula resposta:
 * se a operadora/Android não devolver nada, o callback de erro é chamado.
 *
 * Requer API 26+ (Android 8.0 Oreo). Para Android 7.0/7.1 (API 24-25),
 * ver UssdAccessibilityService.kt — não existe API oficial nessas versões.
 */
object UssdSender {

    interface Callback {
        fun onRespostaRecebida(resposta: String)
        fun onErro(codigo: Int, mensagem: String)
    }

    @RequiresApi(Build.VERSION_CODES.O)
    @SuppressLint("MissingPermission")
    fun enviar(context: Context, sim: SimInfo, codigoUssd: String, callback: Callback) {
        val telephonyManagerBase =
            context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

        // Confirma que a subscrição continua ativa e no mesmo slot físico antes
        // de criar o TelephonyManager específico. Não usa a subscrição predefinida.
        val subscriptionManager =
            context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
        val subscriptionAtual = try {
            subscriptionManager.getActiveSubscriptionInfo(sim.subscriptionId)
        } catch (e: SecurityException) {
            callback.onErro(-1, "READ_PHONE_STATE não permite validar o SIM selecionado.")
            return
        }

        if (subscriptionAtual == null || subscriptionAtual.simSlotIndex != sim.slotIndex) {
            callback.onErro(-1, "O subscriptionId ${sim.subscriptionId} já não pertence ao slot ${sim.slotIndex}. USSD cancelado.")
            return
        }

        // Associa o TelephonyManager explicitamente ao subscriptionId autorizado.
        val telephonyManagerDoSim = try {
            telephonyManagerBase.createForSubscriptionId(sim.subscriptionId)
        } catch (e: Exception) {
            callback.onErro(-1, "Não foi possível criar o contexto telefónico do SIM selecionado: ${e.message}")
            return
        }

        val mainHandler = Handler(Looper.getMainLooper())

        try {
            telephonyManagerDoSim.sendUssdRequest(
                codigoUssd,
                object : TelephonyManager.UssdResponseCallback() {
                override fun onReceiveUssdResponse(
                    telephonyManager: TelephonyManager,
                    request: String,
                    response: CharSequence
                ) {
                    mainHandler.post {
                        callback.onRespostaRecebida(response.toString())
                    }
                }

                override fun onReceiveUssdResponseFailed(
                    telephonyManager: TelephonyManager,
                    request: String,
                    failureCode: Int
                ) {
                    mainHandler.post {
                        val mensagem = when (failureCode) {
                            TelephonyManager.USSD_RETURN_FAILURE -> "A rede recusou ou terminou a sessão USSD."
                            TelephonyManager.USSD_ERROR_SERVICE_UNAVAIL -> "Serviço USSD indisponível neste momento (possível indisponibilidade detectada)."
                            else -> "Falha desconhecida (código $failureCode)."
                        }
                        callback.onErro(failureCode, mensagem)
                    }
                }
                },
                mainHandler
            )
        } catch (e: SecurityException) {
            callback.onErro(-1, "Permissão insuficiente para executar USSD nesta subscrição.")
        } catch (e: Exception) {
            callback.onErro(-1, "Falha ao iniciar USSD: ${e.message}")
        }
    }

    fun apiSuportada(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
}
