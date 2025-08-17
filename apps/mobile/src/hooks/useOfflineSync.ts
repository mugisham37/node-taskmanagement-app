import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';
import { sqliteService } from '../services/database/SQLiteService';
import { syncService, type SyncResult } from '../services/sync/SyncService';

export interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  syncError: string | null;
  syncProgress: number;
}

export const useOfflineSync = () => {
  const [state, setState] = useState<OfflineSyncState>({
    isOnline: false,
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: 0,
    syncError: null,
    syncProgress: 0,
  });

  const updateSyncState = useCallback(async () => {
    try {
      const stats = await sqliteService.getStorageStats();
      const netInfo = await NetInfo.fetch();
      
      setState(prev => ({
        ...prev,
        isOnline: netInfo.isConnected || false,
        pendingChanges: stats.pendingSyncItems,
        isSyncing: syncService.isCurrentlySyncing,
      }));
    } catch (error) {
      console.error('Failed to update sync state:', error);
    }
  }, []);

  const performSync = useCallback(async (): Promise<SyncResult> => {
    setState(prev => ({ ...prev, isSyncing: true, syncError: null, syncProgress: 0 }));
    
    try {
      const result = await syncService.performFullSync();
      
      setState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        syncError: result.success ? null : result.errors.join(', '),
        syncProgress: 100,
      }));
      
      await updateSyncState();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setState(prev => ({
        ...prev,
        isSyncing: false,
        syncError: errorMessage,
        syncProgress: 0,
      }));
      
      throw error;
    }
  }, [updateSyncState]);

  const performBackgroundSync = useCallback(async () => {
    if (!state.isOnline || state.isSyncing) return;
    
    try {
      await syncService.performBackgroundSync();
      await updateSyncState();
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }, [state.isOnline, state.isSyncing, updateSyncState]);

  const clearSyncError = useCallback(() => {
    setState(prev => ({ ...prev, syncError: null }));
  }, []);

  // Set up listeners and periodic updates
  useEffect(() => {
    const syncListener = (result: SyncResult) => {
      setState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        syncError: result.success ? null : result.errors.join(', '),
        syncProgress: 100,
      }));
      updateSyncState();
    };

    syncService.addSyncListener(syncListener);
    
    // Initial state update
    updateSyncState();

    // Set up network listener
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      setState(prev => ({ ...prev, isOnline: state.isConnected || false }));
      
      // Trigger background sync when coming online
      if (state.isConnected && prev.pendingChanges > 0) {
        performBackgroundSync();
      }
    });

    // Periodic state updates
    const interval = setInterval(updateSyncState, 30000); // Every 30 seconds

    return () => {
      syncService.removeSyncListener(syncListener);
      unsubscribeNetInfo();
      clearInterval(interval);
    };
  }, [updateSyncState, performBackgroundSync]);

  return {
    ...state,
    performSync,
    performBackgroundSync,
    clearSyncError,
    refresh: updateSyncState,
  };
};