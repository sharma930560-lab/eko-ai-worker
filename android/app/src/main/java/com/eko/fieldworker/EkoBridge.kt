package com.eko.fieldworker

import android.content.Context
import android.webkit.JavascriptInterface
import android.widget.Toast
import android.content.Intent
import android.provider.MediaStore
import android.app.Activity

class EkoBridge(private val context: Context, private val viewModel: EkoViewModel) {

    @JavascriptInterface
    fun showToast(message: String) {
        if (context is Activity) {
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
    }

    @JavascriptInterface
    fun logAudit(action: String, details: String) {
        viewModel.logAction(action, details)
    }

    @JavascriptInterface
    fun getNetworkStatus(): String {
        return viewModel.status.value?.name ?: "UNKNOWN"
    }

    @JavascriptInterface
    fun openCamera() {
        if (context is Activity) {
            context.runOnUiThread {
                val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                context.startActivityForResult(intent, 100)
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
    fun googleSignOut() {
        if (context is MainActivity) {
            context.runOnUiThread {
                context.triggerGoogleSignOut()
            }
        }
    }
}
