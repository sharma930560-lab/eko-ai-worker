package com.eko.fieldworker

import androidx.room.*

@Dao
interface SyncDao {
    @Query("SELECT * FROM sync_queue ORDER BY timestamp ASC")
    suspend fun getAll(): List<SyncItem>

    @Insert
    suspend fun insert(item: SyncItem)

    @Delete
    suspend fun delete(item: SyncItem)

    @Query("DELETE FROM sync_queue")
    suspend fun clear()
}
