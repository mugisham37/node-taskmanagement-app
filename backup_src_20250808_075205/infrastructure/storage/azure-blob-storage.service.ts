import {
  FileStorageService,
  UploadOptions,
  UploadResult,
  DownloadOptions,
  DownloadResult,
  StorageBackend,
  FileValidationResult,
  BackupOptions,
  StorageUsage,
} from '../../domain/file-management/services/file-storage.service';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import * as path from 'path';
import { logger } from '../../utils/logger';

export interface AzureBlobConfig {
  connectionString: string;
  containerName: string;
  accountName?: string;
  accountKey?: string;
}

export class AzureBlobStorageService implements FileStorageService {
  private readonly blobServiceClient: BlobServiceClient;
  private readonly containerClient: ContainerClient;
  private readonly containerName: string;
  private readonly backend: StorageBackend;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: Set<string>;

  constructor(
    config: AzureBlobConfig & {
      maxFileSize?: number;
      allowedMimeTypes?: string[];
    }
  ) {
    this.blobServiceClient = BlobServiceClient.fromConnectionString(
      config.connectionString
    );
    this.containerName = config.containerName;
    this.containerClient = this.blobServiceClient.getContainerClient(
      this.containerName
    );

    this.maxFileSize = config.maxFileSize || 100 * 1024 * 1024; // 100MB default
    this.allowedMimeTypes = new Set(
      config.allowedMimeTypes || [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/csv',
        'application/json',
        'video/mp4',
        'audio/mpeg',
        'application/zip',
      ]
    );

    this.backend = {
      name: 'Azure Blob Storage',
      type: 'azure',
      config: {
        containerName: config.containerName,
        accountName: config.accountName,
      },
      isHealthy: true,
      lastHealthCheck: new Date(),
    };

    this.ensureContainerExists();
  }

  private async ensureContainerExists(): Promise<void> {
    try {
      await this.containerClient.createIfNotExists({
        access: 'private',
      });
    } catch (error) {
      logger.error('Failed to create Azure Blob container', {
        containerName: this.containerName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private generateStoragePath(
    workspaceId: string,
    filename: string,
    version?: number
  ): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');

    const versionSuffix = version ? `_v${version}` : '';

    return `${workspaceId}/${sanitizedName}_${timestamp}_${random}${versionSuffix}${ext}`;
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.zip': 'application/zip',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  async validateFile(
    buffer: Buffer,
    filename: string,
    options: UploadOptions
  ): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata: Record<string, any> = {};

    // Size validation
    if (buffer.length > (options.maxSize || this.maxFileSize)) {
      errors.push(
        `File size ${buffer.length} exceeds maximum allowed size ${options.maxSize || this.maxFileSize}`
      );
    }

    // MIME type validation
    const mimeType = this.getMimeType(filename);
    const allowedTypes = options.allowedMimeTypes
      ? new Set(options.allowedMimeTypes)
      : this.allowedMimeTypes;

    if (!allowedTypes.has(mimeType)) {
      errors.push(`File type ${mimeType} is not allowed`);
    }

    // Filename validation
    if (filename.length > 255) {
      errors.push('Filename is too long (max 255 characters)');
    }

    metadata.checksum = this.calculateChecksum(buffer);
    metadata.size = buffer.length;
    metadata.mimeType = mimeType;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata,
    };
  }

  async scanForVirus(
    storagePath: string
  ): Promise<'clean' | 'infected' | 'error'> {
    // Placeholder for virus scanning
    return 'clean';
  }

  async upload(
    buffer: Buffer,
    filename: string,
    options: UploadOptions
  ): Promise<UploadResult> {
    try {
      // Validate file first
      const validation = await this.validateFile(buffer, filename, options);
      if (!validation.isValid) {
        throw new Error(
          `File validation failed: ${validation.errors.join(', ')}`
        );
      }

      const storagePath = this.generateStoragePath(
        options.workspaceId,
        filename
      );
      const checksum = this.calculateChecksum(buffer);
      const mimeType = validation.metadata.mimeType;

      // Prepare metadata
      const metadata = {
        originalName: filename,
        uploadedAt: new Date().toISOString(),
        uploadedBy: options.userId,
        checksum,
        workspaceId: options.workspaceId,
        ...options.customMetadata,
      };

      // Upload to Azure Blob
      const blockBlobClient =
        this.containerClient.getBlockBlobClient(storagePath);

      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: mimeType,
        },
        metadata: Object.fromEntries(
          Object.entries(metadata).map(([key, value]) => [key, String(value)])
        ),
      });

      const result: UploadResult = {
        storagePath,
        size: buffer.length,
        checksum,
        mimeType,
        metadata,
      };

      // Virus scan if requested
      if (options.runVirusScan) {
        result.virusScanResult = await this.scanForVirus(storagePath);
      }

      logger.info('File uploaded to Azure Blob successfully', {
        storagePath,
        size: buffer.length,
        checksum,
        mimeType,
        workspaceId: options.workspaceId,
        userId: options.userId,
      });

      return result;
    } catch (error) {
      logger.error('Failed to upload file to Azure Blob', {
        filename,
        error: error instanceof Error ? error.message : 'Unknown error',
        workspaceId: options.workspaceId,
        userId: options.userId,
      });
      throw error;
    }
  }

  async download(
    storagePath: string,
    options?: DownloadOptions
  ): Promise<DownloadResult> {
    try {
      let actualPath = storagePath;

      if (options?.version) {
        actualPath = this.getVersionPath(storagePath, options.version);
      }

      const blockBlobClient =
        this.containerClient.getBlockBlobClient(actualPath);
      const downloadResponse = await blockBlobClient.download();

      if (!downloadResponse.readableStreamBody) {
        throw new Error('No file content received from Azure Blob');
      }

      return {
        stream: downloadResponse.readableStreamBody,
        mimeType: downloadResponse.contentType || 'application/octet-stream',
        size: downloadResponse.contentLength || 0,
        filename: path.basename(storagePath),
        lastModified: downloadResponse.lastModified,
        etag: downloadResponse.etag,
        contentRange: downloadResponse.contentRange,
      };
    } catch (error) {
      logger.error('Failed to download file from Azure Blob', {
        storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async delete(storagePath: string): Promise<void> {
    try {
      const blockBlobClient =
        this.containerClient.getBlockBlobClient(storagePath);
      await blockBlobClient.delete();

      // Delete versions if they exist
      const versions = await this.listVersions(storagePath);
      for (const version of versions) {
        const versionBlobClient = this.containerClient.getBlockBlobClient(
          version.storagePath
        );
        await versionBlobClient.delete();
      }

      logger.info('File deleted from Azure Blob successfully', { storagePath });
    } catch (error) {
      logger.error('Failed to delete file from Azure Blob', {
        storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      const blockBlobClient =
        this.containerClient.getBlockBlobClient(storagePath);
      return await blockBlobClient.exists();
    } catch {
      return false;
    }
  }

  async getMetadata(storagePath: string): Promise<Record<string, any>> {
    try {
      const blockBlobClient =
        this.containerClient.getBlockBlobClient(storagePath);
      const properties = await blockBlobClient.getProperties();

      return {
        size: properties.contentLength,
        mimeType: properties.contentType,
        lastModified: properties.lastModified,
        etag: properties.etag,
        metadata: properties.metadata || {},
      };
    } catch (error) {
      logger.error('Failed to get file metadata from Azure Blob', {
        storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async uploadVersion(
    buffer: Buffer,
    originalStoragePath: string,
    version: number,
    options: UploadOptions
  ): Promise<UploadResult> {
    const versionPath = this.getVersionPath(originalStoragePath, version);
    const result = await this.upload(
      buffer,
      path.basename(versionPath),
      options
    );

    return {
      ...result,
      storagePath: versionPath,
      metadata: {
        ...result.metadata,
        version,
        originalPath: originalStoragePath,
      },
    };
  }

  async listVersions(storagePath: string): Promise<
    Array<{
      version: number;
      storagePath: string;
      size: number;
      uploadedAt: Date;
      checksum: string;
    }>
  > {
    try {
      const directory = path.dirname(storagePath);
      const basename = path.basename(storagePath, path.extname(storagePath));
      const extension = path.extname(storagePath);

      const versions = [];
      const prefix = `${directory}/${basename}_v`;

      for await (const blob of this.containerClient.listBlobsFlat({
        prefix,
      })) {
        const match = blob.name.match(
          new RegExp(`${basename}_v(\\d+)${extension}$`)
        );
        if (match) {
          const version = parseInt(match[1]);
          const metadata = await this.getMetadata(blob.name);

          versions.push({
            version,
            storagePath: blob.name,
            size: blob.properties.contentLength || 0,
            uploadedAt: blob.properties.lastModified || new Date(),
            checksum: metadata.metadata?.checksum || '',
          });
        }
      }

      return versions.sort((a, b) => b.version - a.version);
    } catch {
      return [];
    }
  }

  async deleteVersion(storagePath: string, version: number): Promise<void> {
    const versionPath = this.getVersionPath(storagePath, version);
    await this.delete(versionPath);
  }

  private getVersionPath(storagePath: string, version: number): string {
    const ext = path.extname(storagePath);
    return storagePath.replace(ext, `_v${version}${ext}`);
  }

  // Placeholder implementations for remaining methods
  async generateThumbnail(
    storagePath: string,
    outputPath: string,
    options?: { width?: number; height?: number; quality?: number }
  ): Promise<void> {
    logger.info('Thumbnail generation not implemented for Azure Blob', {
      storagePath,
      outputPath,
    });
  }

  async generatePreview(
    storagePath: string,
    outputPath: string,
    options?: { width?: number; height?: number; quality?: number }
  ): Promise<void> {
    logger.info('Preview generation not implemented for Azure Blob', {
      storagePath,
      outputPath,
    });
  }

  async compressFile(
    storagePath: string,
    outputPath: string,
    options?: { quality?: number; format?: string }
  ): Promise<{ size: number; compressionRatio: number }> {
    return { size: 0, compressionRatio: 1.0 };
  }

  async optimizeImage(
    storagePath: string,
    outputPath: string,
    options?: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    }
  ): Promise<{ size: number; optimizationRatio: number }> {
    return { size: 0, optimizationRatio: 1.0 };
  }

  async backup(
    storagePath: string,
    backupPath: string,
    options?: BackupOptions
  ): Promise<void> {
    try {
      const sourceBlobClient =
        this.containerClient.getBlockBlobClient(storagePath);
      const targetBlobClient =
        this.containerClient.getBlockBlobClient(backupPath);

      await targetBlobClient.syncCopyFromURL(sourceBlobClient.url);

      logger.info('File backed up in Azure Blob successfully', {
        storagePath,
        backupPath,
      });
    } catch (error) {
      logger.error('Failed to backup file in Azure Blob', {
        storagePath,
        backupPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async restore(backupPath: string, storagePath: string): Promise<void> {
    await this.backup(backupPath, storagePath);
  }

  async createSnapshot(workspaceId: string): Promise<string> {
    const snapshotId = `snapshot_${workspaceId}_${Date.now()}`;
    // In a real implementation, you might create a snapshot of the container
    return snapshotId;
  }

  async restoreFromSnapshot(
    snapshotId: string,
    workspaceId: string
  ): Promise<void> {
    logger.info('Snapshot restore not fully implemented for Azure Blob', {
      snapshotId,
      workspaceId,
    });
  }

  async cleanup(olderThan: Date): Promise<string[]> {
    const deletedFiles: string[] = [];

    try {
      for await (const blob of this.containerClient.listBlobsFlat()) {
        if (
          blob.properties.lastModified &&
          blob.properties.lastModified < olderThan
        ) {
          await this.delete(blob.name);
          deletedFiles.push(blob.name);
        }
      }

      logger.info('Azure Blob cleanup completed', {
        deletedCount: deletedFiles.length,
        olderThan,
      });
    } catch (error) {
      logger.error('Failed to cleanup Azure Blob files', {
        error: error instanceof Error ? error.message : 'Unknown error',
        olderThan,
      });
      throw error;
    }

    return deletedFiles;
  }

  async validateIntegrity(
    storagePath: string,
    expectedChecksum: string
  ): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(storagePath);
      const actualChecksum = metadata.metadata?.checksum;
      return actualChecksum === expectedChecksum;
    } catch {
      return false;
    }
  }

  async repairCorruptedFiles(): Promise<
    Array<{
      storagePath: string;
      status: 'repaired' | 'failed' | 'unrecoverable';
    }>
  > {
    return [];
  }

  getBackendInfo(): StorageBackend {
    return { ...this.backend, lastHealthCheck: new Date() };
  }

  async getStorageUsage(workspaceId?: string): Promise<StorageUsage> {
    try {
      const prefix = workspaceId ? `${workspaceId}/` : '';
      let totalSize = 0;
      let fileCount = 0;
      const workspaceBreakdown: Record<
        string,
        { used: number; fileCount: number }
      > = {};

      for await (const blob of this.containerClient.listBlobsFlat({
        prefix,
      })) {
        if (blob.properties.contentLength) {
          totalSize += blob.properties.contentLength;
          fileCount++;

          // Extract workspace from blob name
          const workspaceFromName = blob.name.split('/')[0];
          if (!workspaceBreakdown[workspaceFromName]) {
            workspaceBreakdown[workspaceFromName] = { used: 0, fileCount: 0 };
          }
          workspaceBreakdown[workspaceFromName].used +=
            blob.properties.contentLength;
          workspaceBreakdown[workspaceFromName].fileCount++;
        }
      }

      return {
        used: totalSize,
        available: -1, // Azure Blob doesn't have a fixed limit
        total: -1, // Azure Blob doesn't have a fixed limit
        fileCount,
        workspaceBreakdown,
      };
    } catch (error) {
      logger.error('Failed to get Azure Blob storage usage', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.containerClient.getProperties();
      this.backend.isHealthy = true;
      this.backend.lastHealthCheck = new Date();
      return true;
    } catch {
      this.backend.isHealthy = false;
      this.backend.lastHealthCheck = new Date();
      return false;
    }
  }

  async switchBackend(newBackend: StorageBackend): Promise<void> {
    throw new Error('Backend switching not implemented for Azure Blob storage');
  }

  async createSignedUrl(
    storagePath: string,
    expiresIn: number,
    permissions?: ('read' | 'write' | 'delete')[]
  ): Promise<string> {
    try {
      const blockBlobClient =
        this.containerClient.getBlockBlobClient(storagePath);
      // This would require implementing SAS token generation
      // For now, return a placeholder URL
      return `${blockBlobClient.url}?sas=placeholder`;
    } catch (error) {
      logger.error('Failed to create signed URL for Azure Blob', {
        storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async bulkUpload(
    files: Array<{ buffer: Buffer; filename: string; options: UploadOptions }>
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    // Process uploads in parallel with concurrency limit
    const concurrency = 5;
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchPromises = batch.map(async file => {
        try {
          return await this.upload(file.buffer, file.filename, file.options);
        } catch (error) {
          return {
            storagePath: '',
            size: 0,
            checksum: '',
            mimeType: '',
            metadata: {
              error: error instanceof Error ? error.message : 'Upload failed',
            },
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  async bulkDelete(storagePaths: string[]): Promise<void> {
    const concurrency = 10;
    for (let i = 0; i < storagePaths.length; i += concurrency) {
      const batch = storagePaths.slice(i, i + concurrency);
      const deletePromises = batch.map(path =>
        this.delete(path).catch(() => {})
      );
      await Promise.all(deletePromises);
    }
  }

  async moveFile(
    fromPath: string,
    toPath: string,
    preserveVersions?: boolean
  ): Promise<void> {
    await this.backup(fromPath, toPath);
    await this.delete(fromPath);

    if (preserveVersions) {
      const versions = await this.listVersions(fromPath);
      for (const version of versions) {
        const newVersionPath = this.getVersionPath(toPath, version.version);
        await this.backup(version.storagePath, newVersionPath);
        await this.delete(version.storagePath);
      }
    }
  }

  async copyFile(
    fromPath: string,
    toPath: string,
    preserveVersions?: boolean
  ): Promise<void> {
    await this.backup(fromPath, toPath);

    if (preserveVersions) {
      const versions = await this.listVersions(fromPath);
      for (const version of versions) {
        const newVersionPath = this.getVersionPath(toPath, version.version);
        await this.backup(version.storagePath, newVersionPath);
      }
    }
  }

  async indexFile(storagePath: string): Promise<void> {
    logger.info('File indexed (placeholder)', { storagePath });
  }

  async searchFiles(query: {
    workspaceId?: string;
    mimeType?: string;
    sizeRange?: { min: number; max: number };
    dateRange?: { from: Date; to: Date };
    tags?: string[];
    fullTextSearch?: string;
  }): Promise<
    Array<{
      storagePath: string;
      filename: string;
      size: number;
      mimeType: string;
      uploadedAt: Date;
      relevanceScore?: number;
    }>
  > {
    return [];
  }
}
