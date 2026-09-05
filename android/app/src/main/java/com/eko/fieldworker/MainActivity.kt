package com.eko.fieldworker

import android.os.Bundle
import android.view.View
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.util.Log
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialInterruptedException
import androidx.credentials.exceptions.NoCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.CustomCredential
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.launch
import android.content.Intent
import android.graphics.Bitmap
import android.provider.MediaStore
import android.util.Base64
import java.io.ByteArrayOutputStream
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.ExistingPeriodicWorkPolicy
import java.util.concurrent.TimeUnit
import android.content.Context
import android.os.Build

class MainActivity : AppCompatActivity() {

    private val TAG = "EkoMainActivity"

    private lateinit var webView: WebView
    private lateinit var statusBanner: TextView
    private val viewModel: EkoViewModel by viewModels()
    private lateinit var connectivityManager: ConnectivityManager
    private val WEB_CLIENT_ID = "258255119262-hl7e15h4ohciliroc29gcpbfa6i1sf2l.apps.googleusercontent.com"

    // ── Camera via ActivityResultLauncher (replaces deprecated startActivityForResult) ──
    private val cameraLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK) {
            val imageBitmap: Bitmap? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                result.data?.extras?.getParcelable("data", Bitmap::class.java)
            } else {
                @Suppress("DEPRECATION")
                result.data?.extras?.get("data") as? Bitmap
            }
            if (imageBitmap != null) {
                val base64Image = encodeBitmapToBase64(imageBitmap)
                webView.evaluateJavascript("window.handleNativeCameraImage('$base64Image')", null)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        statusBanner = findViewById(R.id.status_banner)
        connectivityManager = getSystemService(ConnectivityManager::class.java)

        setupWebView()
        observeViewModel()
        registerNetworkCallback()
        handleIntent(intent)

        // ── Light status bar — modern API (replaces deprecated systemUiVisibility) ──
        window.statusBarColor = android.graphics.Color.WHITE
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = true

        // ── Back navigation — OnBackPressedCallback (replaces deprecated onBackPressed override) ──
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    // Disable this callback so the default back behavior (finish activity) runs
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val deepLink = intent?.getStringExtra("deep_link")
        if (!deepLink.isNullOrEmpty()) {
            Log.i(TAG, "Navigating to deep link: $deepLink")
            webView.evaluateJavascript("window.navigateTo('$deepLink')", null)
        }
    }

    // ── Called by EkoBridge to launch the camera ────────────────────────────────
    fun triggerCamera() {
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        cameraLauncher.launch(intent)
    }

    fun scheduleNotificationWorker(userId: String, apiBase: String) {
        val sharedPrefs = getSharedPreferences("eko_prefs", Context.MODE_PRIVATE)
        sharedPrefs.edit().apply {
            putString("user_id", userId)
            putString("api_base", apiBase)
            apply()
        }

        val workRequest = PeriodicWorkRequestBuilder<NotificationWorker>(15, TimeUnit.MINUTES)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "eko_notif_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )
        Log.i(TAG, "Notification worker scheduled for user: $userId")
    }

    private fun registerNetworkCallback() {
        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        connectivityManager.registerNetworkCallback(networkRequest, object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread { viewModel.updateNetworkStatus(true) }
            }

            override fun onLost(network: Network) {
                runOnUiThread { viewModel.updateNetworkStatus(false) }
            }
        })
    }

    private fun setupWebView() {
        // Production: HTTPS-only asset loader, no cleartext, no mixed content
        val assetLoader = WebViewAssetLoader.Builder()
            .setHttpAllowed(false)  // HTTPS only
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        // Dev-only: Allow mixed content so the HTTPS asset loader page can fetch http://10.0.2.2:8000.
        // This is needed because WebViewAssetLoader serves via https://appassets.androidplatform.net
        // but the emulator backend runs on plain HTTP. Replace with MIXED_CONTENT_NEVER_ALLOW
        // once the production backend is deployed on HTTPS.
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            mixedContentMode = if (BuildConfig.DEBUG) {
                WebSettings.MIXED_CONTENT_ALWAYS_ALLOW // Debug/emulator HTTP backend
            } else {
                WebSettings.MIXED_CONTENT_NEVER_ALLOW  // Production HTTPS only
            }
        }

        // Add Javascript Interface
        webView.addJavascriptInterface(EkoBridge(this, viewModel), "AndroidBridge")

        // Surface WebView console.log → Logcat under tag EkoWebView
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                val level = when (msg.messageLevel()) {
                    ConsoleMessage.MessageLevel.ERROR -> "ERROR"
                    ConsoleMessage.MessageLevel.WARNING -> "WARN"
                    else -> "INFO"
                }
                Log.i("EkoWebView", "[$level] ${msg.message()} (${msg.sourceId()}:${msg.lineNumber()})")
                return true
            }
        }

        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: android.webkit.WebResourceRequest
            ): android.webkit.WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: android.webkit.WebResourceRequest
            ): Boolean {
                val uri = request.url
                val url = uri.toString()
                Log.d(TAG, "shouldOverrideUrlLoading: $url")

                if (url.contains("accounts.google.com")) {
                    Log.e(TAG, "BLOCKING navigation to Google login page in WebView!")
                    return true // Block web Google login — use native Credential Manager
                }

                // Handle Phone Calls (tel: URLs) via Android Dialer
                if (url.startsWith("tel:")) {
                    try {
                        val dialIntent = android.content.Intent(android.content.Intent.ACTION_DIAL, uri)
                        startActivity(dialIntent)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to launch dialer for $url", e)
                        Toast.makeText(this@MainActivity, "Could not open dialer", Toast.LENGTH_SHORT).show()
                    }
                    return true
                }

                // Handle Email (mailto: URLs)
                if (url.startsWith("mailto:")) {
                    try {
                        val mailIntent = android.content.Intent(android.content.Intent.ACTION_SENDTO, uri)
                        startActivity(mailIntent)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to launch email client for $url", e)
                    }
                    return true
                }

                // Handle WhatsApp & External Web Links
                if (url.startsWith("https://wa.me/") || url.startsWith("whatsapp://") || url.startsWith("https://api.whatsapp.com/")) {
                    try {
                        val waIntent = android.content.Intent(android.content.Intent.ACTION_VIEW, uri)
                        startActivity(waIntent)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to launch WhatsApp for $url", e)
                        Toast.makeText(this@MainActivity, "WhatsApp not installed", Toast.LENGTH_SHORT).show()
                    }
                    return true
                }

                // Keep local app assets within WebView
                if (url.startsWith("https://appassets.androidplatform.net/")) {
                    return false
                }

                // External HTTP/HTTPS links (e.g. privacy policy on netlify) open in external browser
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    try {
                        val browserIntent = android.content.Intent(android.content.Intent.ACTION_VIEW, uri)
                        startActivity(browserIntent)
                        return true
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to open external URL $url", e)
                    }
                }

                return false
            }
        }


        // Load via HTTPS asset loader
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
    }

    private fun observeViewModel() {
        viewModel.status.observe(this) { status ->
            when (status) {
                NetworkStatus.ONLINE -> {
                    statusBanner.visibility = View.GONE
                }
                NetworkStatus.OFFLINE -> {
                    statusBanner.visibility = View.VISIBLE
                    statusBanner.text = "Offline — changes saved on this device"
                    statusBanner.setBackgroundColor(0xFF64748B.toInt())
                }
                NetworkStatus.SYNCING -> {
                    statusBanner.visibility = View.VISIBLE
                    statusBanner.text = "Syncing..."
                    statusBanner.setBackgroundColor(0xFF4F46E5.toInt())
                }
                NetworkStatus.ERROR -> {
                    statusBanner.visibility = View.VISIBLE
                    statusBanner.text = "Couldn't sync. We'll retry."
                    statusBanner.setBackgroundColor(0xFFDC2626.toInt())
                }
                else -> {}
            }
        }
    }

    fun triggerGoogleSignIn() {
        Log.i(TAG, "Auth: --- NATIVE SIGN-IN START ---")
        Log.i(TAG, "Auth: Package Name: $packageName")
        Log.i(TAG, "Auth: Server Client ID: $WEB_CLIENT_ID")
        
        Toast.makeText(this, "Opening Google Account Picker...", Toast.LENGTH_SHORT).show()
        
        lifecycleScope.launch {
            val credentialManager = CredentialManager.create(this@MainActivity)
            val nonce = java.util.UUID.randomUUID().toString()

            // 1. First attempt: Authorized accounts only
            try {
                Log.d(TAG, "Auth: Attempt 1 - Authorized accounts only (setFilterByAuthorizedAccounts = true)")
                val googleIdOption = GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(true)
                    .setServerClientId(WEB_CLIENT_ID)
                    .setAutoSelectEnabled(false)
                    .setNonce(nonce)
                    .build()

                val request = GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build()

                val result = credentialManager.getCredential(
                    context = this@MainActivity,
                    request = request
                )
                handleCredentialResult(result.credential)
            } catch (e: NoCredentialException) {
                Log.w(TAG, "Auth: Attempt 1 failed (NoCredentialException). Retrying with setFilterByAuthorizedAccounts = false")
                
                // 2. Second attempt: All accounts (setFilterByAuthorizedAccounts = false)
                try {
                    val googleIdOptionFallback = GetGoogleIdOption.Builder()
                        .setFilterByAuthorizedAccounts(false)
                        .setServerClientId(WEB_CLIENT_ID)
                        .setAutoSelectEnabled(false)
                        .setNonce(nonce)
                        .build()

                    val requestFallback = GetCredentialRequest.Builder()
                        .addCredentialOption(googleIdOptionFallback)
                        .build()

                    val result = credentialManager.getCredential(
                        context = this@MainActivity,
                        request = requestFallback
                    )
                    handleCredentialResult(result.credential)
                } catch (fallbackNoCred: NoCredentialException) {
                    Log.w(TAG, "Auth: Attempt 2 also threw NoCredentialException. Retrying with GetSignInWithGoogleOption explicit flow")
                    try {
                        val signInWithGoogleOption = GetSignInWithGoogleOption.Builder(serverClientId = WEB_CLIENT_ID)
                            .setNonce(nonce)
                            .build()

                        val explicitRequest = GetCredentialRequest.Builder()
                            .addCredentialOption(signInWithGoogleOption)
                            .build()

                        val result = credentialManager.getCredential(
                            context = this@MainActivity,
                            request = explicitRequest
                        )
                        handleCredentialResult(result.credential)
                    } catch (explicitEx: Exception) {
                        handleAuthError(explicitEx)
                    }
                } catch (fallbackEx: Exception) {
                    handleAuthError(fallbackEx)
                }
            } catch (e: Exception) {
                handleAuthError(e)
            } finally {
                Log.i(TAG, "Auth: --- NATIVE SIGN-IN FINISHED ---")
            }
        }
    }

    private fun handleCredentialResult(credential: androidx.credentials.Credential) {
        Log.i(TAG, "Auth: [ID TOKEN RECEIVED] Credential type: ${credential.type}")
        try {
            when {
                credential is GoogleIdTokenCredential -> {
                    val idToken = credential.idToken
                    Log.i(TAG, "Auth: [ID TOKEN RECEIVED] Source: GoogleIdTokenCredential. Token length: ${idToken.length}")
                    Log.i(TAG, "Auth: [PASSING TOKEN TO WEBVIEW] Calling window.handleNativeGoogleResponse via evaluateJavascript")
                    runOnUiThread {
                        webView.evaluateJavascript("window.handleNativeGoogleResponse('$idToken')") { result ->
                            Log.i(TAG, "Auth: [WEBVIEW CALLBACK TRIGGERED] evaluateJavascript result: $result")
                        }
                    }
                }
                credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL -> {
                    val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
                    val idToken = googleIdTokenCredential.idToken
                    Log.i(TAG, "Auth: [ID TOKEN RECEIVED] Source: CustomCredential. Token length: ${idToken.length}")
                    Log.i(TAG, "Auth: [PASSING TOKEN TO WEBVIEW] Calling window.handleNativeGoogleResponse via evaluateJavascript")
                    runOnUiThread {
                        webView.evaluateJavascript("window.handleNativeGoogleResponse('$idToken')") { result ->
                            Log.i(TAG, "Auth: [WEBVIEW CALLBACK TRIGGERED] evaluateJavascript result: $result")
                        }
                    }
                }
                else -> {
                    Log.w(TAG, "Auth: [ID TOKEN RECEIVED] Unexpected credential type: ${credential.type}")
                    runOnUiThread {
                        webView.evaluateJavascript("showAuthError('Unexpected credential type: ${credential.type}')", null)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Auth: [ID TOKEN RECEIVED] Failed to parse credential: ${e.message}", e)
            runOnUiThread {
                webView.evaluateJavascript("showAuthError('Failed to parse Google credential: ${e.message}')", null)
            }
        }
    }

    private fun handleAuthError(e: Exception) {
        Log.e(TAG, "Auth: Native Sign-in Failed")
        Log.e(TAG, "Auth: Exception Class: ${e.javaClass.simpleName}")
        Log.e(TAG, "Auth: Exception Message: ${e.message}")

        val userMessage = when (e) {
            is NoCredentialException -> "No Google accounts found. Please check device settings."
            is GetCredentialCancellationException -> "Sign-in cancelled."
            is GetCredentialInterruptedException -> "Request interrupted. Please try again."
            else -> "Native Sign-in failed: ${e.message}"
        }
        webView.evaluateJavascript("showAuthError('$userMessage')", null)
    }

    fun triggerGoogleSignOut() {
        lifecycleScope.launch {
            try {
                val credentialManager = CredentialManager.create(this@MainActivity)
                credentialManager.clearCredentialState(androidx.credentials.ClearCredentialStateRequest())
            } catch (e: Exception) {
                // Ignore sign out errors
            }
        }
    }

    fun showBiometricPrompt() {
        Toast.makeText(this, "Biometric Verification Requested (Hardware Stub)", Toast.LENGTH_SHORT).show()
        // Production: Implement BiometricPrompt here
        webView.evaluateJavascript("window.onBiometricSuccess()", null)
    }

    private fun encodeBitmapToBase64(bitmap: Bitmap): String {
        val outputStream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 85, outputStream)
        val byteArray = outputStream.toByteArray()
        return Base64.encodeToString(byteArray, Base64.NO_WRAP)
    }

    // NOTE: onActivityResult is intentionally removed — camera is now handled via
    // ActivityResultLauncher (cameraLauncher) registered above. The deprecated
    // onBackPressed override is replaced with OnBackPressedCallback in onCreate.
}
