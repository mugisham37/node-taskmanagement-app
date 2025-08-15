import React from "react";
import { getStateSynchronization } from "./state-synchronization";
import { useRealtimeStore } from "@/store/realtime-store";
import { useTaskStore } from "@/store/task-store";
import { useProjectStore } from "@/store/project-store";
import { toast } from "sonner";
import { AppError, normalizeError, isRetryableError } from '@taskmanagement/shared';
import { RetryMechanism } from './retry-mechanism';
import { ClientErrorHandler } from './error-handler';

interface OfflineQueueItem {
  id: string;
  type: 'task' | 'project';
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
  priority: 'high' | 'medium' | 'low';
}

interface OfflineStorageData {
  queue: OfflineQueueItem[];
  lastSync: string;
  version: number;
}

export class OfflineSupport {
  private isOnline = navigator.onLine;
  private offlineQueue: OfflineQueueItem[] = [];
  private storageKey = 'taskmanagement-offline-queue';
  private version = 1;
  private retryMechanism: RetryMechanism;
  private processingQueue = false;

  constructor() {
    this.retryMechanism = new RetryMechanism({
      maxAttempts: 3,
      baseDelay: 2000,
      backoffFactor: 2,
      jitter: true,
      onRetry: (attempt, error, delay) => {
        ClientErrorHandler.addBreadcrumb(
          `Retrying offline operation (attempt ${attempt}): ${error.message}`
        );
      },
    });
    
    this.setupEventListeners();
    this.loadOfflineQueue();
    this.registerServiceWorker();
  }

  private setupEventListeners(): void {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Listen for visibility change to check connection
    document.addEventListener('visibilitychange', this.checkConnection.bind(this));
  }

  private handleOnline(): void {
    this.isOnline = true;
    const realtimeStore = useRealtimeStore.getState();
    realtimeStore.setSyncStatus({ isOnline: true });
    
    toast.success("Back Online", {
      description: "Connection restored. Syncing offline changes...",
    });

    this.processOfflineQueue();
  }

  private handleOffline(): void {
    this.isOnline = false;
    const realtimeStore = useRealtimeStore.getState();
    realtimeStore.setSyncStatus({ isOnline: false });
    
    toast.warning("Offline Mode", {
      description: "You're now offline. Changes will be synced when connection is restored.",
    });
  }

  private async checkConnection(): void {
    if (document.visibilityState === 'visible') {
      // Try to make a simple request to check actual connectivity
      try {
        const response = await fetch('/api/health', { 
          method: 'HEAD',
          cache: 'no-cache',
        });
        
        const wasOnline = this.isOnline;
        this.isOnline = response.ok;
        
        if (!wasOnline && this.isOnline) {
          this.handleOnline();
        } else if (wasOnline && !this.isOnline) {
          this.handleOffline();
        }
      } catch (error) {
        if (this.isOnline) {
          this.handleOffline();
        }
      }
    }
  }

  private loadOfflineQueue(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data: OfflineStorageData = JSON.parse(stored);
        
        // Check version compatibility
        if (data.version === this.version) {
          this.offlineQueue = data.queue.map(item => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }));
        } else {
          // Clear incompatible data
          localStorage.removeItem(this.storageKey);
        }
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      localStorage.removeItem(this.storageKey);
    }
  }

  private saveOfflineQueue(): void {
    try {
      const data: OfflineStorageData = {
        queue: this.offlineQueue,
        lastSync: new Date().toISOString(),
        version: this.version,
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
      
      // If storage is full, try to clear old items
      if (error instanceof DOMException && error.code === 22) {
        this.clearOldQueueItems();
        try {
          const data: OfflineStorageData = {
            queue: this.offlineQueue,
            lastSync: new Date().toISOString(),
            version: this.version,
          };
          localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (retryError) {
          console.error('Failed to save offline queue after cleanup:', retryError);
        }
      }
    }
  }

  private clearOldQueueItems(): void {
    // Remove items older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.offlineQueue = this.offlineQueue.filter(item => item.timestamp > oneDayAgo);
  }

  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0 || this.processingQueue) {
      return;
    }

    this.processingQueue = true;

    try {
      const sync = getStateSynchronization();
      if (!sync) {
        console.warn('State synchronization not available');
        return;
      }

      // Sort by priority and timestamp
      const sortedQueue = [...this.offlineQueue].sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        
        return a.timestamp.getTime() - b.timestamp.getTime();
      });

      const realtimeStore = useRealtimeStore.getState();
      let processedCount = 0;
      let failedCount = 0;
      const failedItems: OfflineQueueItem[] = [];

      for (const item of sortedQueue) {
        try {
          // Use retry mechanism for each item
          await this.retryMechanism.execute(async () => {
            if (item.type === 'task') {
              sync.queueTaskSync(item.id, item.operation, item.data);
            } else if (item.type === 'project') {
              sync.queueProjectSync(item.id, item.operation, item.data);
            }
          });
          
          processedCount++;
        } catch (error) {
          const normalizedError = normalizeError(error);
          
          // Only keep retryable errors in queue
          if (isRetryableError(normalizedError) && item.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000) {
            failedItems.push(item);
          }
          
          ClientErrorHandler.handle(normalizedError, {
            operation: 'offline_queue_processing',
            item: item.id,
            type: item.type,
          });
          
          failedCount++;
        }
      }

      // Update queue with only failed retryable items
      this.offlineQueue = failedItems;
      this.saveOfflineQueue();

      // Force sync all queued items
      if (processedCount > 0) {
        sync.forceSyncAll();
      }

      // Show result notification
      if (processedCount > 0) {
        toast.success("Offline Changes Synced", {
          description: `${processedCount} changes synced successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        });
      }

      if (failedCount > 0) {
        realtimeStore.addSyncError(`${failedCount} offline changes failed to sync`);
      }

    } finally {
      this.processingQueue = false;
    }
  }

  // Public API methods
  public queueOfflineAction(
    id: string,
    type: 'task' | 'project',
    operation: 'create' | 'update' | 'delete',
    data: any,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): void {
    const item: OfflineQueueItem = {
      id,
      type,
      operation,
      data,
      timestamp: new Date(),
      priority,
    };

    // Remove any existing items for the same entity to avoid duplicates
    this.offlineQueue = this.offlineQueue.filter(
      existing => !(existing.id === id && existing.type === type)
    );

    this.offlineQueue.push(item);
    this.saveOfflineQueue();

    // If we're online, try to process immediately
    if (this.isOnline) {
      this.processOfflineQueue();
    }
  }

  public isOffline(): boolean {
    return !this.isOnline;
  }

  public getQueueLength(): number {
    return this.offlineQueue.length;
  }

  public clearQueue(): void {
    this.offlineQueue = [];
    this.saveOfflineQueue();
  }

  public getQueueItems(): OfflineQueueItem[] {
    return [...this.offlineQueue];
  }

  public forceSync(): void {
    if (this.isOnline) {
      this.processOfflineQueue();
    } else {
      toast.warning("Still Offline", {
        description: "Cannot sync while offline. Changes will sync when connection is restored.",
      });
    }
  }

  private registerServiceWorker(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);
          
          // Listen for sync events
          if ('sync' in registration) {
            registration.addEventListener('sync', (event) => {
              if (event.tag === 'background-sync') {
                this.processOfflineQueue();
              }
            });
          }
        })
        .catch(error => {
          console.warn('Service Worker registration failed:', error);
        });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_COMPLETE') {
          toast.success('Background Sync Complete', {
            description: `${event.data.processedCount} operations processed`,
          });
        }
      });
    }
  }

  public destroy(): void {
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    document.removeEventListener('visibilitychange', this.checkConnection.bind(this));
  }
}

// Singleton instance
let globalOfflineSupport: OfflineSupport | null = null;

export function createOfflineSupport(): OfflineSupport {
  if (globalOfflineSupport) {
    globalOfflineSupport.destroy();
  }
  
  globalOfflineSupport = new OfflineSupport();
  return globalOfflineSupport;
}

export function getOfflineSupport(): OfflineSupport | null {
  return globalOfflineSupport;
}

// React hook for offline support
export function useOfflineSupport() {
  const [offlineSupport] = React.useState(() => {
    return getOfflineSupport() || createOfflineSupport();
  });

  React.useEffect(() => {
    return () => {
      // Don't destroy on unmount as it's a singleton
    };
  }, []);

  const queueOfflineTask = React.useCallback((
    id: string,
    operation: 'create' | 'update' | 'delete',
    data: any,
    priority?: 'high' | 'medium' | 'low'
  ) => {
    offlineSupport.queueOfflineAction(id, 'task', operation, data, priority);
  }, [offlineSupport]);

  const queueOfflineProject = React.useCallback((
    id: string,
    operation: 'create' | 'update' | 'delete',
    data: any,
    priority?: 'high' | 'medium' | 'low'
  ) => {
    offlineSupport.queueOfflineAction(id, 'project', operation, data, priority);
  }, [offlineSupport]);

  return {
    isOffline: offlineSupport.isOffline(),
    queueLength: offlineSupport.getQueueLength(),
    queueOfflineTask,
    queueOfflineProject,
    forceSync: offlineSupport.forceSync.bind(offlineSupport),
    clearQueue: offlineSupport.clearQueue.bind(offlineSupport),
    getQueueItems: offlineSupport.getQueueItems.bind(offlineSupport),
  };
}

// Enhanced store hooks with offline support
export function useTaskStoreWithOffline() {
  const taskStore = useTaskStore();
  const { queueOfflineTask, isOffline } = useOfflineSupport();

  const addTaskWithOffline = React.useCallback((task: any) => {
    taskStore.addTask(task);
    
    if (isOffline) {
      queueOfflineTask(task.id, 'create', task, 'high');
    }
  }, [taskStore, queueOfflineTask, isOffline]);

  const updateTaskWithOffline = React.useCallback((id: string, updates: any) => {
    taskStore.updateTask(id, updates);
    
    if (isOffline) {
      queueOfflineTask(id, 'update', updates, 'medium');
    }
  }, [taskStore, queueOfflineTask, isOffline]);

  const removeTaskWithOffline = React.useCallback((id: string) => {
    taskStore.removeTask(id);
    
    if (isOffline) {
      queueOfflineTask(id, 'delete', {}, 'high');
    }
  }, [taskStore, queueOfflineTask, isOffline]);

  return {
    ...taskStore,
    addTask: addTaskWithOffline,
    updateTask: updateTaskWithOffline,
    removeTask: removeTaskWithOffline,
    isOffline,
  };
}

export function useProjectStoreWithOffline() {
  const projectStore = useProjectStore();
  const { queueOfflineProject, isOffline } = useOfflineSupport();

  const addProjectWithOffline = React.useCallback((project: any) => {
    projectStore.addProject(project);
    
    if (isOffline) {
      queueOfflineProject(project.id, 'create', project, 'high');
    }
  }, [projectStore, queueOfflineProject, isOffline]);

  const updateProjectWithOffline = React.useCallback((id: string, updates: unknown) => {
    projectStore.updateProject(id, updates);
    
    if (isOffline) {
      queueOfflineProject(id, 'update', updates, 'medium');
    }
  }, [projectStore, queueOfflineProject, isOffline]);

  const removeProjectWithOffline = React.useCallback((id: string) => {
    projectStore.removeProject(id);
    
    if (isOffline) {
      queueOfflineProject(id, 'delete', {}, 'high');
    }
  }, [projectStore, queueOfflineProject, isOffline]);

  return {
    ...projectStore,
    addProject: addProjectWithOffline,
    updateProject: updateProjectWithOffline,
    removeProject: removeProjectWithOffline,
    isOffline,
  };
}