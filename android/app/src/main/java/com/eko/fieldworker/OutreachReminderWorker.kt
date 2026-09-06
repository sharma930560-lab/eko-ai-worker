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

class OutreachReminderWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    private val CHANNEL_ID = "eko_outreach_reminders"

    override suspend fun doWork(): Result {
        val outreachId = inputData.getString("outreach_id") ?: "reminder"
        val title = inputData.getString("title") ?: "WhatsApp Follow-up"
        val message = inputData.getString("message") ?: "Time to follow up on your WhatsApp outreach."

        val notificationManager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "WhatsApp Follow-up Reminders", NotificationManager.IMPORTANCE_HIGH)
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("deep_link", "whatsapp-studio")
        }
        val pendingIntent = PendingIntent.getActivity(applicationContext, outreachId.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE)

        val builder = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        notificationManager.notify(outreachId.hashCode(), builder.build())
        Log.i("EkoReminderWorker", "Notified outreach reminder for $outreachId")
        return Result.success()
    }
}
