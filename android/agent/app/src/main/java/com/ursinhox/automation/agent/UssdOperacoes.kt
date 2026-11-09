package com.ursinhox.automation.agent

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.telephony.TelephonyManager
import android.telephony.SubscriptionManager
import androidx.core.content.ContextCompat

/**
 * Coordena as operações USSD interativas.
 *
 * A regra de segurança é fail-closed: o código só inicia ACTION_CALL quando
 * consegue mapear um PhoneAccountHandle para o subscriptionId exato recebido
 * na tarefa do Backend. Nunca usa a posição da lista como se fosse slotIndex
 * e nunca deixa o Android escolher silenciosamente a linha predefinida.
 */
object UssdOperacoes {

    private fun obterPhoneAccountDoSim(
        context: Context,
        sim: SimInfo
    ): PhoneAccountHandle? {
        if (sim.subscriptionId < 0) {
            UssdRoteiro.registrar("USSD bloqueado: subscriptionId inválido para o SIM slot ${sim.slotIndex}.")
            return null
        }

        // TelephonyManager.getSubscriptionId(PhoneAccountHandle) está disponível
        // a partir da API 30. Em versões anteriores não assumimos que a ordem
        // de callCapablePhoneAccounts corresponde à ordem dos slots.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            UssdRoteiro.registrar("USSD bloqueado: Android anterior à API 30 não permite confirmar publicamente o subscriptionId do PhoneAccount. Não será escolhido um SIM por posição.")
            return null
        }

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE)
            != PackageManager.PERMISSION_GRANTED
        ) {
            UssdRoteiro.registrar("USSD bloqueado: permissão READ_PHONE_STATE em falta para validar o PhoneAccount.")
            return null
        }

        val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
            ?: return null
        val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
            ?: return null
        val subscriptionManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
            ?: return null

        return try {
            val subscriptionAtual = subscriptionManager.getActiveSubscriptionInfo(sim.subscriptionId)
            if (subscriptionAtual == null || subscriptionAtual.simSlotIndex != sim.slotIndex) {
                UssdRoteiro.registrar("USSD bloqueado: subscriptionId ${sim.subscriptionId} já não pertence ao slot ${sim.slotIndex}.")
                return null
            }

            telecomManager.callCapablePhoneAccounts.firstOrNull { handle ->
                try {
                    telephonyManager.getSubscriptionId(handle) == sim.subscriptionId
                } catch (_: SecurityException) {
                    false
                } catch (_: IllegalArgumentException) {
                    false
                }
            }
        } catch (e: SecurityException) {
            UssdRoteiro.registrar("USSD bloqueado: o Android não permitiu consultar as contas telefónicas: ${e.message}.")
            null
        }
    }

    /**
     * Retorna false quando não é possível garantir o SIM de saída.
     * Nessa situação não é lançado ACTION_CALL sem EXTRA_PHONE_ACCOUNT_HANDLE.
     */
    fun discar(context: Context, sim: SimInfo, codigo: String): Boolean {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE)
            != PackageManager.PERMISSION_GRANTED
        ) {
            UssdRoteiro.registrar("Permissão CALL_PHONE em falta.")
            UssdRoteiro.parar()
            return false
        }

        val phoneAccountHandle = obterPhoneAccountDoSim(context, sim)
        if (phoneAccountHandle == null) {
            UssdRoteiro.registrar("USSD não iniciado: nenhum PhoneAccount corresponde exatamente ao subscriptionId ${sim.subscriptionId} do slot ${sim.slotIndex}. O SIM predefinido não será utilizado como substituto.")
            UssdRoteiro.parar()
            return false
        }

        val uri = Uri.fromParts("tel", codigo, null)
        val intent = Intent(Intent.ACTION_CALL, uri).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            putExtra(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, phoneAccountHandle)
        }

        return try {
            context.startActivity(intent)
            true
        } catch (e: SecurityException) {
            UssdRoteiro.registrar("Falha ao iniciar USSD no SIM selecionado: permissão negada pelo Android.")
            UssdRoteiro.parar()
            false
        } catch (e: Exception) {
            UssdRoteiro.registrar("Falha ao iniciar USSD no SIM selecionado: ${e.message}.")
            UssdRoteiro.parar()
            false
        }
    }

    /** Consulta internet discando *100# e rejeitando a oferta que aparece. */
    fun consultarSaldo(
        context: Context,
        sim: SimInfo,
        preservarHistorico: Boolean = false,
        callback: (Int?) -> Unit
    ) {
        if (UssdRoteiro.ativo) {
            UssdRoteiro.registrar("Consulta de saldo recusada: já existe uma sessão USSD em andamento.")
            callback(null)
            return
        }
        // A consulta que inicia um fluxo limpa os registos antigos. A consulta
        // pós-transferência pode preservar o histórico anterior para enviar ao
        // Backend a sequência completa: saldo antes → transferência → saldo depois.
        if (!preservarHistorico) UssdRoteiro.limparHistorico()
        val iniciado = UssdRoteiro.iniciar(listOf("2"))
        if (!iniciado) {
            callback(null)
            return
        }
        UssdRoteiro.aoTerminar = {
            val saldo = SaldoParser.extrairSaldoMB(UssdRoteiro.obterHistorico())
            callback(saldo)
        }
        discar(context, sim, "*100#")
    }

    /**
     * Executa *162# → 8 (Internet) → 2 (Transferir) → quantidade → destino.
     * A chamada só é iniciada após confirmar o PhoneAccount do subscriptionId.
     */
    fun executarTransferencia(
        context: Context,
        sim: SimInfo,
        megas: Int,
        destino: String,
        callback: () -> Unit
    ) {
        if (!SimManager.pareceVodacom(sim)) {
            UssdRoteiro.registrar("Transferência bloqueada: apenas SIMs Vodacom podem executar transferências de internet nesta versão.")
            callback()
            return
        }
        if (UssdRoteiro.ativo) {
            UssdRoteiro.registrar("Transferência recusada: já existe uma sessão USSD em andamento.")
            callback()
            return
        }
        val iniciado = UssdRoteiro.iniciar(listOf("8", "2", megas.toString(), destino))
        if (!iniciado) {
            callback()
            return
        }
        UssdRoteiro.aoTerminar = callback
        discar(context, sim, "*162#")
    }
}
