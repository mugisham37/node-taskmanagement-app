import NetInfo from '@react-native-async-storage/async-storage';
import { Project, Task } from '@taskmanagement/types';
import { apiService } from '../api/ApiService';
import { sqliteService, SyncQueueItem } from '../database/SQLiteService';

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  conflicts: ConflictItem[];
  errors: string[];
}

export interface ConflictItem {
  id: string;
  entityType: string;
  localData: any;
  remoteData: any;
  conflictType: 'UPDATE_CONFLICT' | 'DELETE_CONFLICT' | 'CREATE_CONFLICT';
}

export type ConflictResolutionStrategy = 'LOCAL_WINS' | 'REMOTE_WINS' | 'MANUAL' | 'MERGE';

class SyncService {
  private isSyncing = false;
  private syncListeners: ((result: SyncResult) => void)[] = [];
  private conflictResolvers: Map<string, (conflict: ConflictItem) => Promise<ConflictResolutionStrategy>> = new Map();

  constructor() {
    this.setupNetworkListener();
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      if (state.isConnected && !this.isSyncing) {
        this.performBackgroundSync();
      }
    });
  }

  async performFullSync(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      syncedItems: 0,
      failedItems: 0,
      conflicts: [],
      errors: []
    };

    try {
      // Step 1: Upload local changes
      await this.uploadLocalChanges(result);

      // Step 2: Download remote changes
      await this.downloadRemoteChanges(result);

      // Step 3: Resolve conflicts
      await this.resolveConflicts(result);

      // Step 4: Clean up completed sync items
      await sqliteService.clearSyncedItems();

      this.notifyListeners(result);
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  private async uploadLocalChanges(result: SyncResult): Promise<void> {
    const pendingItems = await sqliteService.getPendingSyncItems();
    
    for (const item of pendingItems) {
      try {
        await sqliteService.updateSyncItemStatus(item.id, 'SYNCING');
        
        switch (item.operation) {
          case 'CREATE':
            await this.uploadCreate(item);
            break;
          case 'UPDATE':
            await this.uploadUpdate(item);
            break;
          case 'DELETE':
            await this.uploadDelete(item);
            break;
        }

        await sqliteService.updateSyncItemStatus(item.id, 'COMPLETED');
        result.syncedItems++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        await sqliteService.updateSyncItemStatus(item.id, 'FAILED', errorMessage);
        result.failedItems++;
        result.errors.push(`Failed to upload ${item.table} ${item.operation}: ${errorMessage}`);
      }
    }
  }

  private async uploadCreate(item: SyncQueueItem): Promise<void> {
    switch (item.table) {
      case 'tasks':
        const createdTask = await apiService.createTask(item.data);
        // Update local record with server-generated data
        await sqliteService.update('tasks', item.data.id, {
          ...createdTask,
          is_synced: 1,
          last_sync_at: new Date().toISOString()
        });
        break;
      case 'projects':
        const createdProject = await apiService.createProject(item.data);
        await sqliteService.update('projects', item.data.id, {
          ...createdProject,
          is_synced: 1,
          last_sync_at: new Date().toISOString()
        });
        break;
      default:
        throw new Error(`Unsupported table for create: ${item.table}`);
    }
  }

  private async uploadUpdate(item: SyncQueueItem): Promise<void> {
    switch (item.table) {
      case 'tasks':
        const updatedTask = await apiService.updateTask(item.data.id, item.data);
        await sqliteService.update('tasks', item.data.id, {
          ...updatedTask,
          is_synced: 1,
          last_sync_at: new Date().toISOString()
        });
        break;
      case 'projects':
        const updatedProject = await apiService.updateProject(item.data.id, item.data);
        await sqliteService.update('projects', item.data.id, {
          ...updatedProject,
          is_synced: 1,
          last_sync_at: new Date().toISOString()
        });
        break;
      default:
        throw new Error(`Unsupported table for update: ${item.table}`);
    }
  }

  private async uploadDelete(item: SyncQueueItem): Promise<void> {
    switch (item.table) {
      case 'tasks':
        await apiService.deleteTask(item.data.id);
        // Remove from local database
        await sqliteService.delete('tasks', item.data.id);
        break;
      case 'projects':
        await apiService.deleteProject(item.data.id);
        await sqliteService.delete('projects', item.data.id);
        break;
      default:
        throw new Error(`Unsupported table for delete: ${item.table}`);
    }
  }

  private async downloadRemoteChanges(result: SyncResult): Promise<void> {
    try {
      // Get last sync timestamp
      const lastSyncTime = await this.getLastSyncTimestamp();
      
      // Download tasks
      const remoteTasks = await apiService.getTasksSince(lastSyncTime);
      for (const task of remoteTasks) {
        await this.processRemoteTask(task, result);
      }

      // Download projects
      const remoteProjects = await apiService.getProjectsSince(lastSyncTime);
      for (const project of remoteProjects) {
        await this.processRemoteProject(project, result);
      }

      // Update last sync timestamp
      await this.updateLastSyncTimestamp();
    } catch (error) {
      result.errors.push(`Failed to download remote changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processRemoteTask(remoteTask: Task, result: SyncResult): Promise<void> {
    const localTask = await sqliteService.findById('tasks', remoteTask.id);
    
    if (!localTask) {
      // New remote task - insert locally
      await sqliteService.insert('tasks', {
        ...remoteTask,
        is_synced: 1,
        last_sync_at: new Date().toISOString()
      });
      result.syncedItems++;
    } else {
      // Check for conflicts
      const localUpdatedAt = new Date(localTask.updated_at);
      const remoteUpdatedAt = new Date(remoteTask.updated_at);
      
      if (localTask.is_synced === 0 && localUpdatedAt > remoteUpdatedAt) {
        // Local changes are newer - conflict detected
        result.conflicts.push({
          id: remoteTask.id,
          entityType: 'task',
          localData: localTask,
          remoteData: remoteTask,
          conflictType: 'UPDATE_CONFLICT'
        });
      } else {
        // Remote is newer or no local changes - update local
        await sqliteService.update('tasks', remoteTask.id, {
          ...remoteTask,
          is_synced: 1,
          last_sync_at: new Date().toISOString()
        });
        result.syncedItems++;
      }
    }
  }

  private async processRemoteProject(remoteProject: Project, result: SyncResult): Promise<void> {
    const localProject = await sqliteService.findById('projects', remoteProject.id);
    
    if (!localProject) {
      await sqliteService.insert('projects', {
        ...remoteProject,
        is_synced: 1,
        last_sync_at: new Date().toISOString()
      });
      result.syncedItems++;
    } else {
      const localUpdatedAt = new Date(localProject.updated_at);
      const remoteUpdatedAt = new Date(remoteProject.updated_at);
      
      if (localProject.is_synced === 0 && localUpdatedAt > remoteUpdatedAt) {
        result.conflicts.push({
          id: remoteProject.id,
          entityType: 'project',
          localData: localProject,
          remoteData: remoteProject,
          conflictType: 'UPDATE_CONFLICT'
        });
      } else {
        await sqliteService.update('projects', remoteProject.id, {
          ...remoteProject,
          is_synced: 1,
          last_sync_at: new Date().toISOString()
        });
        result.syncedItems++;
      }
    }
  }

  private async resolveConflicts(result: SyncResult): Promise<void> {
    for (const conflict of result.conflicts) {
      try {
        const resolver = this.conflictResolvers.get(conflict.entityType);
        const strategy = resolver ? await resolver(conflict) : 'REMOTE_WINS';
        
        await this.applyConflictResolution(conflict, strategy);
      } catch (error) {
        result.errors.push(`Failed to resolve conflict for ${conflict.entityType} ${conflict.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async applyConflictResolution(conflict: ConflictItem, strategy: ConflictResolutionStrategy): Promise<void> {
    switch (strategy) {
      case 'LOCAL_WINS':
        // Keep local data, upload to server
        await sqliteService.addToSyncQueue({
          table: conflict.entityType as keyof any,
          operation: 'UPDATE',
          data: conflict.localData,
          timestamp: Date.now()
        });
        break;
        
      case 'REMOTE_WINS':
        // Use remote data, update local
        await sqliteService.update(conflict.entityType as keyof any, conflict.id, {
          ...conflict.remoteData,
          is_synced: 1,
          last_sync_at: new Date().toISOString()
        });
        break;
        
      case 'MERGE':
        // Merge data (implementation depends on entity type)
        const mergedData = this.mergeConflictData(conflict);
        await sqliteService.update(conflict.entityType as keyof any, conflict.id, {
          ...mergedData,
          is_synced: 0, // Mark as needing sync
          last_sync_at: new Date().toISOString()
        });
        await sqliteService.addToSyncQueue({
          table: conflict.entityType as keyof any,
          operation: 'UPDATE',
          data: mergedData,
          timestamp: Date.now()
        });
        break;
        
      case 'MANUAL':
        // Store conflict for manual resolution
        await sqliteService.trackOfflineChange({
          entityId: conflict.id,
          entityType: conflict.entityType as keyof any,
          changeType: 'UPDATE',
          data: conflict,
          timestamp: Date.now(),
          conflictResolution: 'MANUAL'
        });
        break;
    }
  }

  private mergeConflictData(conflict: ConflictItem): any {
    // Simple merge strategy - prefer local for user-editable fields, remote for system fields
    const merged = { ...conflict.remoteData };
    
    // Merge user-editable fields from local data
    const userEditableFields = ['title', 'description', 'status', 'priority'];
    for (const field of userEditableFields) {
      if (conflict.localData[field] !== undefined) {
        merged[field] = conflict.localData[field];
      }
    }
    
    return merged;
  }

  async performBackgroundSync(): Promise<void> {
    if (this.isSyncing) return;
    
    try {
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) return;
      
      // Perform lightweight sync
      const pendingItems = await sqliteService.getPendingSyncItems();
      if (pendingItems.length > 0) {
        await this.performFullSync();
      }
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }

  private async getLastSyncTimestamp(): Promise<string> {
    // Implementation would get from AsyncStorage or database
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Last 24 hours
  }

  private async updateLastSyncTimestamp(): Promise<void> {
    // Implementation would save to AsyncStorage or database
  }

  // Public API
  addSyncListener(listener: (result: SyncResult) => void): void {
    this.syncListeners.push(listener);
  }

  removeSyncListener(listener: (result: SyncResult) => void): void {
    const index = this.syncListeners.indexOf(listener);
    if (index > -1) {
      this.syncListeners.splice(index, 1);
    }
  }

  private notifyListeners(result: SyncResult): void {
    this.syncListeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error('Sync listener error:', error);
      }
    });
  }

  setConflictResolver(
    entityType: string,
    resolver: (conflict: ConflictItem) => Promise<ConflictResolutionStrategy>
  ): void {
    this.conflictResolvers.set(entityType, resolver);
  }

  async getOfflineStats(): Promise<{
    pendingUploads: number;
    unresolvedConflicts: number;
    lastSyncTime: string | null;
  }> {
    const stats = await sqliteService.getStorageStats();
    return {
      pendingUploads: stats.pendingSyncItems,
      unresolvedConflicts: stats.unresolvedChanges,
      lastSyncTime: await this.getLastSyncTimestamp()
    };
  }

  get isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }
}

export const syncService = new SyncService();