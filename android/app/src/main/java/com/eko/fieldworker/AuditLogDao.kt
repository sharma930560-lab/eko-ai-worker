package com.eko.fieldworker

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface AuditLogDao {
    @Insert
    suspend fun insert(log: AuditLogItem)

    @Query("SELECT * FROM audit_logs ORDER BY timestamp DESC")
    suspend fun getAll(): List<AuditLogItem>
}
