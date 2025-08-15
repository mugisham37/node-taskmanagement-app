import React from "react";
import { useTaskStore } from "@/store/task-store";
import { useProjectStore } from "@/store/project-store";
import { useRealtimeStore } from "@/store/realtime-store";
import { getRealtimeIntegration } from "./realtime-integration";

interface SyncOptions {
  enableOptimisticUpdates?: boolean;
  conflictResolutionStrategy?: 'server-wins' | 'client-wins' | 'merge' | 'prompt-user';
  syncInterval?: number;
  batchSize?: number;
}

interface SyncQueueItem {
  id: string;
  type: 'task' | 'project';
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

export class StateSynchronization {
  private syncQueue: SyncQueueItem[] = [];
  private isProcessing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private options: Required<SyncOptions>;

  constructor(options: SyncOptions = {}) {
    this.options = {
      enableOptimisticUpdates: true,
      conflictResolutionStrategy: 'server-wins',
      syncInterval: 5000, // 5 seconds
      batchSize: 10,
      ...options,
    };

    this.startSyncInterval();
  }

  private startSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.processSyncQueue();
    }, this.options.syncInterval);
  }

  private async processSyncQueue(): Promise<void> {
    if (this.isProcessing || this.syncQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const realtimeStore = useRealtimeStore.getState();
    const integration = getRealtimeIntegration();

    if (!integration || !integration.isConnected()) {
      this.isProcessing = false;
      return;
    }

    try {
      // Process items in batches
      const batch = this.syncQueue.splice(0, this.options.batchSize);
      
      for (const item of batch) {
        try {
          await this.syncItem(item);
          realtimeStore.decrementPendingChanges();
        } catch (error) {
          console.error('Failed to sync item:', error);
          
          // Retry logic
          if (item.retryCount < item.maxRetries) {
            item.retryCount++;
            this.syncQueue.push(item);
          } else {
            realtimeStore.addSyncError(`Failed to sync ${item.type} ${item.id} after ${item.maxRetries} attempts`);
          }
        }
      }

      // Update sync status
      realtimeStore.setSyncStatus({
        lastSync: new Date(),
        pendingChanges: this.syncQueue.length,
      });

    } finally {
      this.isProcessing = false;
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    const integration = getRealtimeIntegration();
    if (!integration) {
      throw new Error('Real-time integration not available');
    }

    switch (item.type) {
      case 'task':
        return this.syncTaskItem(item, integration);
      case 'project':
        return this.syncProjectItem(item, integration);
      default:
        throw new Error(`Unknown sync item type: ${item.type}`);
    }
  }

  private async syncTaskItem(item: SyncQueueItem, integration: any): Promise<void> {
    switch (item.operation) {
      case 'create':
        return integration.send('task:create', item.data);
      case 'update':
        return integration.sendTaskUpdate(item.id, item.data);
      case 'delete':
        return integration.send('task:delete', { taskId: item.id });
    }
  }

  private async syncProjectItem(item: SyncQueueItem, integration: any): Promise<void> {
    switch (item.operation) {
      case 'create':
        return integration.send('project:create', item.data);
      case 'update':
        return integration.sendProjectUpdate(item.id, item.data);
      case 'delete':
        return integration.send('project:delete', { projectId: item.id });
    }
  }

  // Public API methods
  public queueTaskSync(id: string, operation: SyncQueueItem['operation'], data: any): void {
    this.queueSync({
      id,
      type: 'task',
      operation,
      data,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3,
    });
  }

  public queueProjectSync(id: string, operation: SyncQueueItem['operation'], data: any): void {
    this.queueSync({
      id,
      type: 'project',
      operation,
      data,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3,
    });
  }

  private queueSync(item: SyncQueueItem): void {
    // Remove any existing items for the same entity to avoid duplicates
    this.syncQueue = this.syncQueue.filter(
      existing => !(existing.id === item.id && existing.type === item.type)
    );

    this.syncQueue.push(item);
    
    const realtimeStore = useRealtimeStore.getState();
    realtimeStore.incrementPendingChanges();

    // Process immediately if optimistic updates are disabled
    if (!this.options.enableOptimisticUpdates) {
      this.processSyncQueue();
    }
  }

  public forceSyncAll(): void {
    this.processSyncQueue();
  }

  public clearSyncQueue(): void {
    this.syncQueue = [];
    const realtimeStore = useRealtimeStore.getState();
    realtimeStore.setSyncStatus({ pendingChanges: 0 });
  }

  public getSyncQueueStatus(): {
    queueLength: number;
    isProcessing: boolean;
    nextSyncIn: number;
  } {
    const nextSyncIn = this.syncInterval ? this.options.syncInterval : 0;
    
    return {
      queueLength: this.syncQueue.length,
      isProcessing: this.isProcessing,
      nextSyncIn,
    };
  }

  public updateOptions(newOptions: Partial<SyncOptions>): void {
    this.options = { ...this.options, ...newOptions };
    
    if (newOptions.syncInterval) {
      this.startSyncInterval();
    }
  }

  public destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.syncQueue = [];
  }
}

// Singleton instance
let globalStateSynchronization: StateSynchronization | null = null;

export function createStateSynchronization(options?: SyncOptions): StateSynchronization {
  if (globalStateSynchronization) {
    globalStateSynchronization.destroy();
  }
  
  globalStateSynchronization = new StateSynchronization(options);
  return globalStateSynchronization;
}

export function getStateSynchronization(): StateSynchronization | null {
  return globalStateSynchronization;
}

// React hook for state synchronization
export function useStateSynchronization(options?: SyncOptions) {
  const [sync] = React.useState(() => {
    return getStateSynchronization() || createStateSynchronization(options);
  });

  React.useEffect(() => {
    return () => {
      // Don't destroy on unmount as it's a singleton
    };
  }, []);

  return {
    queueTaskSync: sync.queueTaskSync.bind(sync),
    queueProjectSync: sync.queueProjectSync.bind(sync),
    forceSyncAll: sync.forceSyncAll.bind(sync),
    clearSyncQueue: sync.clearSyncQueue.bind(sync),
    getSyncQueueStatus: sync.getSyncQueueStatus.bind(sync),
    updateOptions: sync.updateOptions.bind(sync),
  };
}

// Enhanced store hooks with automatic synchronization
export function useTaskStoreWithSync() {
  const taskStore = useTaskStore();
  const { queueTaskSync } = useStateSynchronization();

  const addTaskWithSync = React.useCallback((task: any) => {
    taskStore.addTask(task);
    queueTaskSync(task.id, 'create', task);
  }, [taskStore, queueTaskSync]);

  const updateTaskWithSync = React.useCallback((id: string, updates: any) => {
    taskStore.updateTask(id, updates);
    queueTaskSync(id, 'update', updates);
  }, [taskStore, queueTaskSync]);

  const removeTaskWithSync = React.useCallback((id: string) => {
    taskStore.removeTask(id);
    queueTaskSync(id, 'delete', {});
  }, [taskStore, queueTaskSync]);

  return {
    ...taskStore,
    addTask: addTaskWithSync,
    updateTask: updateTaskWithSync,
    removeTask: removeTaskWithSync,
  };
}

export function useProjectStoreWithSync() {
  const projectStore = useProjectStore();
  const { queueProjectSync } = useStateSynchronization();

  const addProjectWithSync = React.useCallback((project: any) => {
    projectStore.addProject(project);
    queueProjectSync(project.id, 'create', project);
  }, [projectStore, queueProjectSync]);

  const updateProjectWithSync = React.useCallback((id: string, updates: any) => {
    projectStore.updateProject(id, updates);
    queueProjectSync(id, 'update', updates);
  }, [projectStore, queueProjectSync]);

  const removeProjectWithSync = React.useCallback((id: string) => {
    projectStore.removeProject(id);
    queueProjectSync(id, 'delete', {});
  }, [projectStore, queueProjectSync]);

  return {
    ...projectStore,
    addProject: addProjectWithSync,
    updateProject: updateProjectWithSync,
    removeProject: removeProjectWithSync,
  };
}