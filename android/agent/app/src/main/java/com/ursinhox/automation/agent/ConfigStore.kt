package com.ursinhox.automation.agent

import android.content.Context
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.net.URI
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Configuração do Android Agent.
 * Segredos e identificação do servidor são cifrados com AES/GCM usando chave
 * não exportável armazenada no Android Keystore. Valores antigos em texto
 * (de versões anteriores) são migrados na primeira leitura possível.
 *
 * O endereço do Backend é sempre reduzido à origem (esquema, host e porta).
 * Qualquer caminho digitado, como /tenant, é descartado, porque as rotas do
 * Agent começam em /automation/device e um prefixo extra gera 404 silencioso.
 */
object ConfigStore {
    private const val PREFS = "ursinho_config"
    private const val CHAVE_SERVIDOR = "servidor"
    private const val CHAVE_API_KEY = "api_key"
    private const val CHAVE_DEVICE_ID = "device_id"
    private const val KEY_ALIAS = "com.ursinhox.automation.agent.config.v1"
    private const val PREFIXO_CIFRADO = "enc:v1:"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"

    private fun secretKey(): SecretKey {
        val store = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val existing = store.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build()
        generator.init(spec)
        return generator.generateKey()
    }

    private fun cifrar(value: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        val packed = cipher.iv + encrypted
        return PREFIXO_CIFRADO + Base64.encodeToString(packed, Base64.NO_WRAP)
    }

    private fun decifrar(value: String): String {
        require(value.startsWith(PREFIXO_CIFRADO)) { "Formato cifrado desconhecido." }
        val packed = Base64.decode(value.removePrefix(PREFIXO_CIFRADO), Base64.NO_WRAP)
        require(packed.size > 12) { "Valor cifrado inválido." }
        val iv = packed.copyOfRange(0, 12)
        val payload = packed.copyOfRange(12, packed.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, iv))
        return String(cipher.doFinal(payload), Charsets.UTF_8)
    }

    private fun ler(context: Context, key: String): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val stored = prefs.getString(key, "") ?: ""
        if (stored.isBlank()) return ""
        if (stored.startsWith(PREFIXO_CIFRADO)) {
            return runCatching { decifrar(stored) }.getOrDefault("")
        }

        // Migração de configuração guardada em texto por versões antigas.
        val encrypted = runCatching { cifrar(stored) }.getOrNull() ?: return ""
        prefs.edit().putString(key, encrypted).apply()
        return stored
    }

    /**
     * Reduz o endereço à origem: https://host[:porta].
     * Exemplo: https://ursinho.wispbyte.org/tenant vira https://ursinho.wispbyte.org.
     * Se o valor não for um URL reconhecível, devolve-o sem barra final e a
     * validação em servidorSeguro decide se é aceite.
     */
    fun normalizarServidor(value: String): String {
        val limpo = value.trim()
        if (limpo.isEmpty()) return ""
        return runCatching {
            val uri = URI(limpo)
            val esquema = uri.scheme?.lowercase()
            val host = uri.host
            if (esquema.isNullOrBlank() || host.isNullOrBlank()) {
                limpo.trimEnd('/')
            } else {
                val porta = if (uri.port != -1) ":${uri.port}" else ""
                "$esquema://$host$porta"
            }
        }.getOrDefault(limpo.trimEnd('/'))
    }

    fun salvar(context: Context, servidor: String, apiKey: String, deviceId: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val servidorNormalizado = normalizarServidor(servidor)
        val encrypted = runCatching {
            Triple(cifrar(servidorNormalizado), cifrar(apiKey), cifrar(deviceId))
        }.getOrNull() ?: run {
            prefs.edit().remove(CHAVE_SERVIDOR).remove(CHAVE_API_KEY).remove(CHAVE_DEVICE_ID).apply()
            return
        }
        prefs.edit()
            .putString(CHAVE_SERVIDOR, encrypted.first)
            .putString(CHAVE_API_KEY, encrypted.second)
            .putString(CHAVE_DEVICE_ID, encrypted.third)
            .apply()
    }

    // A normalização na leitura corrige também configurações já gravadas com
    // caminho, sem obrigar o utilizador a reintroduzir os dados.
    fun servidor(context: Context): String = normalizarServidor(ler(context, CHAVE_SERVIDOR))

    fun apiKey(context: Context): String = ler(context, CHAVE_API_KEY)

    fun deviceId(context: Context): String = ler(context, CHAVE_DEVICE_ID)

    fun servidorSeguro(value: String): Boolean {
        return runCatching {
            val uri = Uri.parse(value.trim())
            uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.userInfo == null
        }.getOrDefault(false)
    }

    fun configurado(context: Context): Boolean =
        servidorSeguro(servidor(context)) && apiKey(context).isNotBlank() && deviceId(context).isNotBlank()
}
