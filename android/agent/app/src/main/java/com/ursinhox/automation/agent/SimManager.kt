package com.ursinhox.automation.agent

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.telephony.SubscriptionManager

/**
 * Representa um SIM físico detetado no aparelho.
 * slotIndex: 0 = SIM 1, 1 = SIM 2 (conforme numeração do Android, não do utilizador).
 */
data class SimInfo(
    val slotIndex: Int,
    val subscriptionId: Int,
    val carrierName: String,
    val displayName: String,
    val phoneNumber: String?
)

object SimManager {

    /**
     * Lista os SIMs ativos. Devolve lista vazia se não houver permissão concedida
     * ou se não houver SIMs inseridos — nunca inventa dados.
     */
    @SuppressLint("MissingPermission")
    fun listarSimsAtivos(context: Context): List<SimInfo> {
        val subscriptionManager =
            context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
                ?: return emptyList()

        val lista = try {
            subscriptionManager.activeSubscriptionInfoList
        } catch (e: SecurityException) {
            // Permissão não concedida ainda — não assume nada, devolve vazio.
            null
        } ?: return emptyList()

        return lista.map { info ->
            SimInfo(
                slotIndex = info.simSlotIndex,
                subscriptionId = info.subscriptionId,
                carrierName = info.carrierName?.toString() ?: "Desconhecida",
                displayName = info.displayName?.toString() ?: "SIM ${info.simSlotIndex + 1}",
                phoneNumber = obterNumeroSeDisponivel(info)
            )
        }.sortedBy { it.slotIndex }
    }

    @SuppressLint("MissingPermission")
    private fun obterNumeroSeDisponivel(info: android.telephony.SubscriptionInfo): String? {
        // O número da linha nem sempre está disponível (depende da operadora gravar
        // isso no SIM). Nunca inventar — devolver null quando não disponível.
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                info.number.takeIf { !it.isNullOrBlank() }
            } else {
                @Suppress("DEPRECATION")
                info.number?.takeIf { it.isNotBlank() }
            }
        } catch (e: SecurityException) {
            null
        }
    }

    /**
     * Identifica de forma explícita se um SIM detetado é a linha Vodacom de teste
     * (SIM 1, conforme configuração combinada no projeto). Compara pelo nome da
     * operadora reportado pela rede — não assume, apenas verifica o texto real.
     */
    fun pareceVodacom(sim: SimInfo): Boolean =
        OperadoraVodacom.aceita(sim.carrierName)
}
