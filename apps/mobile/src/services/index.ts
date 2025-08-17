// Database and Sync Services
export { sqliteService, type DatabaseSchema, type OfflineChange, type SyncQueueItem } from './database/SQLiteService';
export { syncService, type ConflictItem, type ConflictResolutionStrategy, type SyncResult } from './sync/SyncService';

// Notification Services
export { pushNotificationService, type NotificationCategory, type NotificationData, type ScheduledNotification } from './notifications/PushNotificationService';

// Authentication Services
export { biometricAuthService, type BiometricAuthOptions, type BiometricAuthResult, type BiometricCapabilities } from './auth/BiometricAuthService';

// Camera and Media Services
export { cameraService, type CameraOptions, type CompressionOptions, type DocumentScanResult, type ImageResult } from './camera/CameraService';

// Performance Services
export { performanceService, type PerformanceConfig, type PerformanceMetrics } from './performance/PerformanceService';

// Service initialization and management
class MobileServicesManager {
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.performInitialization();
    await this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      console.log('Initializing mobile services...');

      // Initialize services in order of dependency
      await performanceService.initialize();
      await sqliteService.initialize();
      await pushNotificationService.initialize();
      await cameraService.initialize();

      // Set up sync service listeners
      syncService.addSyncListener((result) => {
        console.log('Sync completed:', result);
        if (!result.success) {
          performanceService.recordError(new Error(`Sync failed: ${result.errors.join(', ')}`));
        }
      });

      // Set up conflict resolvers
      syncService.setConflictResolver('task', async (conflict) => {
        // Default to remote wins for now
        // In a real app, this would show a UI for user to resolve
        return 'REMOTE_WINS';
      });

      syncService.setConflictResolver('project', async (conflict) => {
        return 'REMOTE_WINS';
      });

      this.isInitialized = true;
      console.log('Mobile services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize mobile services:', error);
      await performanceService.recordError(error as Error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      console.log('Cleaning up mobile services...');

      await pushNotificationService.cleanup();
      await performanceService.cleanup();
      await sqliteService.close();

      this.isInitialized = false;
      this.initializationPromise = null;
      
      console.log('Mobile services cleaned up successfully');
    } catch (error) {
      console.error('Failed to cleanup mobile services:', error);
    }
  }

  get initialized(): boolean {
    return this.isInitialized;
  }

  async getServiceStatus(): Promise<{
    database: boolean;
    notifications: boolean;
    biometrics: boolean;
    camera: boolean;
    performance: boolean;
    sync: boolean;
  }> {
    try {
      const [
        biometricCapabilities,
        cameraPermissions,
        syncStats
      ] = await Promise.all([
        biometricAuthService.getCapabilities(),
        cameraService.checkPermissions(),
        syncService.getOfflineStats()
      ]);

      return {
        database: this.isInitialized,
        notifications: pushNotificationService.pushToken !== null,
        biometrics: biometricCapabilities.isAvailable,
        camera: cameraPermissions.camera,
        performance: this.isInitialized,
        sync: syncStats.pendingUploads === 0
      };
    } catch (error) {
      console.error('Failed to get service status:', error);
      return {
        database: false,
        notifications: false,
        biometrics: false,
        camera: false,
        performance: false,
        sync: false
      };
    }
  }

  async performHealthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check database health
      const dbStats = await sqliteService.getStorageStats();
      if (dbStats.pendingSyncItems > 100) {
        issues.push('High number of pending sync items');
        recommendations.push('Check network connection and sync manually');
      }

      // Check biometric setup
      const biometricValidation = await biometricAuthService.validateBiometricSetup();
      issues.push(...biometricValidation.issues);
      recommendations.push(...biometricValidation.recommendations);

      // Check performance
      const performanceReport = await performanceService.getPerformanceReport();
      if (performanceReport.summary.errorRate > 0.1) {
        issues.push('High error rate detected');
        recommendations.push('Check app logs and report issues');
      }

      if (performanceReport.summary.avgScreenLoadTime > 3000) {
        issues.push('Slow screen load times');
        recommendations.push('Clear app cache or restart app');
      }

      // Check storage usage
      const storageUsage = await cameraService.getStorageUsage();
      if (storageUsage.totalSize > 100 * 1024 * 1024) { // 100MB
        issues.push('High storage usage by camera files');
        recommendations.push('Clean up temporary files');
      }

      return {
        healthy: issues.length === 0,
        issues,
        recommendations
      };
    } catch (error) {
      return {
        healthy: false,
        issues: ['Health check failed'],
        recommendations: ['Restart the app']
      };
    }
  }

  async performMaintenance(): Promise<void> {
    try {
      console.log('Performing maintenance tasks...');

      // Clean up old data
      await sqliteService.clearOldData(30); // 30 days
      await cameraService.cleanupTempFiles();
      
      // Clear old performance metrics
      const performanceReport = await performanceService.getPerformanceReport();
      if (performanceReport.details.memoryUsage.length > 1000) {
        await performanceService.clearMetrics();
      }

      // Perform background sync if needed
      if (!syncService.isCurrentlySyncing) {
        await syncService.performBackgroundSync();
      }

      console.log('Maintenance tasks completed');
    } catch (error) {
      console.error('Maintenance failed:', error);
      await performanceService.recordError(error as Error);
    }
  }
}

export const mobileServicesManager = new MobileServicesManager();

// Convenience exports for commonly used services
export const services = {
  database: sqliteService,
  sync: syncService,
  notifications: pushNotificationService,
  biometrics: biometricAuthService,
  camera: cameraService,
  performance: performanceService,
  manager: mobileServicesManager
};

// Service hooks for React components
export const useServices = () => services;

// Initialize services on app start
export const initializeMobileServices = async (): Promise<void> => {
  await mobileServicesManager.initialize();
};

// Cleanup services on app exit
export const cleanupMobileServices = async (): Promise<void> => {
  await mobileServicesManager.cleanup();
};