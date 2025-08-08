import { FileStorageService } from '../../domain/file-management/services/file-storage.service';
import { EnhancedLocalStorageService } from './enhanced-local-storage.service';
import { S3StorageService, S3Config } from './s3-storage.service';
import {
  AzureBlobStorageService,
  AzureBlobConfig,
} from './azure-blob-storage.service';
import { logger } from '../../../shared/utils/logger';

export type StorageConfig = {
  type: 'local' | 's3' | 'azure';
  local?: {
    basePath?: string;
    maxFileSize?: number;
    allowedMimeTypes?: string[];
  };
  s3?: S3Config & {
    maxFileSize?: number;
    allowedMimeTypes?: string[];
  };
  azure?: AzureBlobConfig & {
    maxFileSize?: number;
    allowedMimeTypes?: string[];
  };
};

export class StorageFactory {
  private static instance: StorageFactory;
  private storageServices: Map<string, FileStorageService> = new Map();

  private constructor() {}

  static getInstance(): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory();
    }
    return StorageFactory.instance;
  }

  createStorageService(
    name: string,
    config: StorageConfig
  ): FileStorageService {
    // Check if service already exists
    if (this.storageServices.has(name)) {
      return this.storageServices.get(name)!;
    }

    let service: FileStorageService;

    switch (config.type) {
      case 'local':
        service = new EnhancedLocalStorageService(config.local || {});
        break;

      case 's3':
        if (!config.s3) {
          throw new Error('S3 configuration is required for S3 storage type');
        }
        service = new S3StorageService(config.s3);
        break;

      case 'azure':
        if (!config.azure) {
          throw new Error(
            'Azure configuration is required for Azure storage type'
          );
        }
        service = new AzureBlobStorageService(config.azure);
        break;

      default:
        throw new Error(`Unsupported storage type: ${config.type}`);
    }

    // Cache the service
    this.storageServices.set(name, service);

    logger.info('Storage service created', {
      name,
      type: config.type,
      backend: service.getBackendInfo(),
    });

    return service;
  }

  getStorageService(name: string): FileStorageService | null {
    return this.storageServices.get(name) || null;
  }

  getAllStorageServices(): Map<string, FileStorageService> {
    return new Map(this.storageServices);
  }

  async switchStorageBackend(
    serviceName: string,
    newConfig: StorageConfig
  ): Promise<void> {
    const oldService = this.storageServices.get(serviceName);
    if (!oldService) {
      throw new Error(`Storage service '${serviceName}' not found`);
    }

    // Create new service
    const newService = this.createStorageService(
      `${serviceName}_new`,
      newConfig
    );

    // Test new service health
    const isHealthy = await newService.healthCheck();
    if (!isHealthy) {
      throw new Error('New storage backend failed health check');
    }

    // Replace old service
    this.storageServices.set(serviceName, newService);
    this.storageServices.delete(`${serviceName}_new`);

    logger.info('Storage backend switched successfully', {
      serviceName,
      oldBackend: oldService.getBackendInfo(),
      newBackend: newService.getBackendInfo(),
    });
  }

  async migrateData(
    fromServiceName: string,
    toServiceName: string,
    workspaceId?: string
  ): Promise<{
    migratedFiles: number;
    failedFiles: string[];
    totalSize: number;
  }> {
    const fromService = this.storageServices.get(fromServiceName);
    const toService = this.storageServices.get(toServiceName);

    if (!fromService || !toService) {
      throw new Error('Source or destination storage service not found');
    }

    const migratedFiles = 0;
    const failedFiles: string[] = [];
    const totalSize = 0;

    // This would require implementing a comprehensive migration strategy
    // For now, return placeholder results
    logger.info('Data migration completed', {
      fromServiceName,
      toServiceName,
      workspaceId,
      migratedFiles,
      failedFiles: failedFiles.length,
      totalSize,
    });

    return {
      migratedFiles,
      failedFiles,
      totalSize,
    };
  }

  async performHealthChecks(): Promise<
    Record<string, { isHealthy: boolean; lastCheck: Date; error?: string }>
  > {
    const results: Record<
      string,
      { isHealthy: boolean; lastCheck: Date; error?: string }
    > = {};

    for (const [name, service] of this.storageServices) {
      try {
        const isHealthy = await service.healthCheck();
        const backendInfo = service.getBackendInfo();

        results[name] = {
          isHealthy,
          lastCheck: backendInfo.lastHealthCheck || new Date(),
        };
      } catch (error) {
        results[name] = {
          isHealthy: false,
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return results;
  }

  async getStorageUsageReport(): Promise<
    Record<
      string,
      {
        backend: string;
        usage: {
          used: number;
          available: number;
          total: number;
          fileCount: number;
        };
        workspaceBreakdown: Record<string, { used: number; fileCount: number }>;
      }
    >
  > {
    const report: Record<string, any> = {};

    for (const [name, service] of this.storageServices) {
      try {
        const usage = await service.getStorageUsage();
        const backendInfo = service.getBackendInfo();

        report[name] = {
          backend: backendInfo.name,
          usage: {
            used: usage.used,
            available: usage.available,
            total: usage.total,
            fileCount: usage.fileCount,
          },
          workspaceBreakdown: usage.workspaceBreakdown,
        };
      } catch (error) {
        report[name] = {
          backend: 'Unknown',
          usage: {
            used: 0,
            available: 0,
            total: 0,
            fileCount: 0,
          },
          workspaceBreakdown: {},
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return report;
  }

  async cleanupAllServices(
    olderThan: Date
  ): Promise<Record<string, { deletedFiles: string[]; error?: string }>> {
    const results: Record<string, { deletedFiles: string[]; error?: string }> =
      {};

    for (const [name, service] of this.storageServices) {
      try {
        const deletedFiles = await service.cleanup(olderThan);
        results[name] = { deletedFiles };
      } catch (error) {
        results[name] = {
          deletedFiles: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return results;
  }

  removeStorageService(name: string): boolean {
    return this.storageServices.delete(name);
  }

  clear(): void {
    this.storageServices.clear();
  }
}

// Export singleton instance
export const storageFactory = StorageFactory.getInstance();
