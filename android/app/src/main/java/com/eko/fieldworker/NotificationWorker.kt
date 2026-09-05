package com.eko.fieldworker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.net.HttpURLConnection
import java.net.URL

class NotificationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    private val TAG = "EkoNotifWorker"
    private val CHANNEL_ID = "eko_ops_notifications"

    override suspend fun doWork(): Result {
        val sharedPrefs = applicationContext.getSharedPreferences("eko_prefs", Context.MODE_PRIVATE)
        val userId = sharedPrefs.getString("user_id", null) ?: return Result.success()
        val baseUrl = sharedPrefs.getString("api_base", "https://eko-field-worker-api.onrender.com") ?: return Result.success()

        Log.i(TAG, "Polling notifications for user: $userId")

        try {
            val url = URL("$baseUrl/api/notifications")
            val conn = url.openConnection() as HttpURLConnection
            conn.setRequestProperty("X-User-Id", userId)
            conn.connectTimeout = 10000
            conn.readTimeout = 10000

            if (conn.responseCode == 200) {
                val json = conn.inputStream.bufferedReader().use { it.readText() }
                val listType = object : TypeToken<List<NotificationItem>>() {}.type
                val notifications: List<NotificationItem> = Gson().fromJson(json, listType)

                for (notif in notifications) {
                    showNotification(notif)
                    // Mark as read in backend
                    markAsRead(baseUrl, userId, notif.id)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Notification poll failed: ${e.message}")
            return Result.retry()
        }

        return Result.success()
    }

    private fun showNotification(item: NotificationItem) {
        val notificationManager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Eko Operations Alerts", NotificationManager.IMPORTANCE_HIGH)
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("deep_link", item.deep_link)
        }
        val pendingIntent = PendingIntent.getActivity(applicationContext, item.id.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE)

        val builder = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(item.title)
            .setContentText(item.message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        notificationManager.notify(item.id.hashCode(), builder.build())
    }

    private fun markAsRead(baseUrl: String, userId: String, notifId: String) {
        try {
            val url = URL("$baseUrl/api/notifications/mark-read/$notifId")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("X-User-Id", userId)
            conn.responseCode
        } catch (e: Exception) {
            Log.e(TAG, "Failed to mark as read: ${e.message}")
        }
    }

    data class NotificationItem(
        val id: String,
        val title: String,
        val message: String,
        val deep_link: String?
    )
}
