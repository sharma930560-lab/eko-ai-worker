package com.eko.fieldworker

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

enum class NetworkStatus { ONLINE, OFFLINE, SYNCING, ERROR }

class EkoViewModel(application: Application) : AndroidViewModel(application) {

    private val repository: SyncRepository
    private val auditDao: AuditLogDao
    private val _status = MutableLiveData<NetworkStatus>(NetworkStatus.ONLINE)
    val status: LiveData<NetworkStatus> = _status

    private var baseUrl: String = "http://10.0.2.2:8000" // Default for emulator
    private var userId: String = "demo_user_123"

    init {
        val database = AppDatabase.getDatabase(application)
        repository = SyncRepository(database.syncDao())
        auditDao = database.auditLogDao()
    }

    fun logAction(action: String, details: String) {
        viewModelScope.launch {
            auditDao.insert(AuditLogItem(action = action, details = details))
        }
    }

    fun setConfig(url: String, uid: String) {
        baseUrl = url
        userId = uid
    }

    fun updateNetworkStatus(online: Boolean) {
        if (online) {
            _status.value = NetworkStatus.ONLINE
            triggerSync()
        } else {
            _status.value = NetworkStatus.OFFLINE
        }
    }

    fun queueAction(endpoint: String, method: String, body: String) {
        viewModelScope.launch {
            repository.addToQueue(endpoint, method, body)
            if (_status.value == NetworkStatus.ONLINE) {
                triggerSync()
            }
        }
    }

    private fun triggerSync() {
        if (_status.value == NetworkStatus.SYNCING) return
        
        viewModelScope.launch {
            _status.value = NetworkStatus.SYNCING
            // Small delay to show syncing state in UI
            delay(1000)
            repository.processQueue(baseUrl, userId)
            _status.value = NetworkStatus.ONLINE
        }
    }
}
