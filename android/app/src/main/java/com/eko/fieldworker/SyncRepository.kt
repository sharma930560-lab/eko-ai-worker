package com.eko.fieldworker

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

class SyncRepository(private val syncDao: SyncDao) {

    suspend fun addToQueue(endpoint: String, method: String, body: String) {
        syncDao.insert(SyncItem(endpoint = endpoint, method = method, body = body))
    }

    suspend fun processQueue(baseUrl: String, userId: String) {
        val items = syncDao.getAll()
        if (items.isEmpty()) return

        Log.i("EkoSync", "Processing queue: ${items.size} items")

        for (item in items) {
            val success = sendRequest(baseUrl + item.endpoint, item.method, item.body, userId)
            if (success) {
                syncDao.delete(item)
                Log.i("EkoSync", "Synced item ${item.id}")
            } else {
                Log.w("EkoSync", "Failed to sync item ${item.id}, stopping queue")
                break // Stop processing on first failure to maintain order
            }
        }
    }

    private suspend fun sendRequest(urlStr: String, method: String, body: String, userId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val url = URL(urlStr)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = method
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("X-User-Id", userId)
            conn.connectTimeout = 5000
            conn.readTimeout = 5000

            if (method == "POST" || method == "PATCH") {
                conn.doOutput = true
                conn.outputStream.use { os ->
                    os.write(body.toByteArray())
                }
            }

            val code = conn.responseCode
            return@withContext code in 200..299
        } catch (e: Exception) {
            Log.e("EkoSync", "Sync request error: ${e.message}")
            return@withContext false
        }
    }
}
