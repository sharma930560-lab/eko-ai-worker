package com.eko.fieldworker

import android.content.Context
import android.webkit.JavascriptInterface
import android.widget.Toast

/**
 * EkoBridge — JavascriptInterface exposed to the WebView as `window.AndroidBridge`.
 *
 * All camera launches are delegated to MainActivity.triggerCamera() which uses
 * ActivityResultLauncher (ActivityResultContracts.StartActivityForResult) instead
 * of the deprecated Activity.startActivityForResult(Intent, Int).
 */
class EkoBridge(private val context: Context, private val viewModel: EkoViewModel) {

    @JavascriptInterface
    fun showToast(message: String) {
        if (context is MainActivity) {
            context.runOnUiThread {
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun queueSync(endpoint: String, method: String, body: String) {
        viewModel.queueAction(endpoint, method, body)
    }

    @JavascriptInterface
    fun setConfig(baseUrl: String, userId: String) {
        viewModel.setConfig(baseUrl, userId)
        if (context is MainActivity) {
            context.runOnUiThread {
                context.scheduleNotificationWorker(userId, baseUrl)
            }
        }
    }

    @JavascriptInterface
    fun logAudit(action: String, details: String) {
        viewModel.logAction(action, details)
    }

    @JavascriptInterface
    fun getNetworkStatus(): String {
        return viewModel.status.value?.name ?: "UNKNOWN"
    }

    /**
     * Launches the camera via MainActivity's ActivityResultLauncher.
     * This replaces the deprecated startActivityForResult(intent, 100) pattern.
     */
    @JavascriptInterface
    fun openCamera() {
        if (context is MainActivity) {
            context.runOnUiThread {
                context.triggerCamera()
            }
        }
    }

    @JavascriptInterface
    fun triggerBiometric() {
        if (context is MainActivity) {
            context.runOnUiThread {
                context.showBiometricPrompt()
            }
        }
    }

    @JavascriptInterface
    fun googleSignIn() {
        if (context is MainActivity) {
            context.runOnUiThread {
                context.triggerGoogleSignIn()
            }
        }
    }

    @JavascriptInterface
    fun isDebug(): Boolean {
        return BuildConfig.DEBUG
    }

    @JavascriptInterface
    fun getProductionApiBase(): String {
        return "https://eko-field-worker-api.onrender.com"
    }

    @JavascriptInterface
    fun googleSignOut() {
        if (context is MainActivity) {
            context.runOnUiThread {
                context.triggerGoogleSignOut()
            }
        }
    }
}
