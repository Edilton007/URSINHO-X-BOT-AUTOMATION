package com.ursinhox.tenant

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.AlertDialog
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressLoading: ProgressBar
    private lateinit var offlinePanel: LinearLayout
    private lateinit var txtOfflineMessage: TextView
    private val prefs by lazy { getSharedPreferences("ursinho_tenant_app", MODE_PRIVATE) }
    private var baseHost: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Entrada suave e brilho discreto da faixa aurora; sem simular estado de rede.
        findViewById<View>(R.id.brandMark).apply {
            alpha = 0f
            scaleX = 0.90f
            scaleY = 0.90f
            animate()
                .alpha(1f)
                .scaleX(1f)
                .scaleY(1f)
                .setDuration(460L)
                .setInterpolator(AccelerateDecelerateInterpolator())
                .start()
        }
        ObjectAnimator.ofFloat(findViewById<View>(R.id.auroraAccent), View.ALPHA, 0.68f, 1f).apply {
            duration = 2100L
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
            start()
        }

        webView = findViewById(R.id.webview)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        swipeRefresh.setColorSchemeResources(
            R.color.accent_mint,
            R.color.accent_blue,
            R.color.accent_violet
        )
        // A loja/painel tem páginas longas: gesto vertical deve continuar a fazer scroll,
        // nunca ser interpretado como pedido de atualização.
        swipeRefresh.isEnabled = false
        progressLoading = findViewById(R.id.progressLoading)
        offlinePanel = findViewById(R.id.offlinePanel)
        txtOfflineMessage = findViewById(R.id.txtOfflineMessage)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = false
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.setSupportMultipleWindows(false)
        webView.settings.setSupportZoom(false)
        webView.settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.settings.safeBrowsingEnabled = true
        }
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressLoading.visibility = android.view.View.VISIBLE
                offlinePanel.visibility = android.view.View.GONE
                swipeRefresh.isRefreshing = false
            }
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                if (uri.scheme != "https" || uri.host != baseHost) {
                    if (uri.scheme == "https" || uri.scheme == "http") {
                        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    }
                    return true
                }
                return false
            }
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressLoading.visibility = android.view.View.GONE
                offlinePanel.visibility = android.view.View.GONE
                webView.visibility = android.view.View.VISIBLE
                swipeRefresh.isRefreshing = false
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) showOffline("Falha de ligação (${error?.errorCode ?: 0}). Verifique a Internet e tente novamente.")
            }

            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: android.webkit.WebResourceResponse?) {
                super.onReceivedHttpError(view, request, errorResponse)
                if (request?.isForMainFrame == true && (errorResponse?.statusCode ?: 0) >= 500) {
                    showOffline("O Backend respondeu com erro temporário. Tente novamente dentro de instantes.")
                }
            }
        }
        findViewById<Button>(R.id.btnReload).setOnClickListener { webView.reload() }
        findViewById<Button>(R.id.btnRetry).setOnClickListener { webView.reload() }

        findViewById<Button>(R.id.btnSettings).setOnClickListener { showServerDialog() }
        val saved = prefs.getString("server_url", "") ?: ""
        if (saved.isBlank()) showServerDialog() else loadPanel(saved)
    }

    private fun showServerDialog() {
        val input = EditText(this).apply {
            hint = "https://dominio-do-backend/tenant/"
            setSingleLine(true)
            setText(prefs.getString("server_url", "") ?: "")
        }
        AlertDialog.Builder(this)
            .setTitle("Configurar Backend")
            .setMessage("Informe o endereço HTTPS do servidor URSINHO X. Não use endereços HTTP em produção.")
            .setView(input)
            .setCancelable(prefs.getString("server_url", "").isNullOrBlank())
            .setPositiveButton("GUARDAR") { _, _ ->
                val value = normalizeUrl(input.text.toString())
                if (value == null) {
                    Toast.makeText(this, "Endereço inválido. Use HTTPS.", Toast.LENGTH_LONG).show()
                    showServerDialog()
                } else {
                    prefs.edit().putString("server_url", value).apply()
                    loadPanel(value)
                }
            }
            .setNegativeButton("CANCELAR") { _, _ ->
                if (prefs.getString("server_url", "").isNullOrBlank()) finish()
            }
            .show()
    }

    private fun normalizeUrl(raw: String): String? {
        var value = raw.trim().trimEnd('/')
        if (value.isBlank()) return null
        val uri = runCatching { Uri.parse(value) }.getOrNull() ?: return null
        if (uri.scheme != "https" || uri.host.isNullOrBlank() || uri.userInfo != null) return null
        if (!value.endsWith("/tenant")) value += "/tenant"
        return "$value/"
    }

    private fun loadPanel(url: String) {
        val uri = Uri.parse(url)
        if (uri.scheme != "https" || uri.host.isNullOrBlank()) {
            Toast.makeText(this, "URL HTTPS inválida.", Toast.LENGTH_LONG).show()
            showServerDialog()
            return
        }
        baseHost = uri.host
        offlinePanel.visibility = android.view.View.GONE
        webView.visibility = android.view.View.VISIBLE
        progressLoading.visibility = android.view.View.VISIBLE
        webView.loadUrl(url)
    }

    private fun showOffline(message: String) {
        progressLoading.visibility = android.view.View.GONE
        swipeRefresh.isRefreshing = false
        txtOfflineMessage.text = message
        webView.visibility = android.view.View.GONE
        offlinePanel.visibility = android.view.View.VISIBLE
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
