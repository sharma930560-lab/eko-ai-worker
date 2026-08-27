package com.eko.fieldworker

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sync_queue")
data class SyncItem(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val endpoint: String,
    val method: String,
    val body: String,
    val timestamp: Long = System.currentTimeMillis(),
    val retryCount: Int = 0
)
