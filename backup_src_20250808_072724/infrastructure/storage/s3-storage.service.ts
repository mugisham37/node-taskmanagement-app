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
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import * as path from 'path';
import { logger } from '../../utils/logger';

export interface S3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export class S3StorageService implements FileStorageService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly backend: StorageBackend;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: Set<string>;

  constructor(
    config: S3Config & {
      maxFileSize?: number;
      allowedMimeTypes?: string[];
    }
  ) {
    this.s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle || false,
    });

    this.bucket = config.bucket;
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
      name: 'Amazon S3',
      type: 's3',
      config: {
        region: config.region,
        bucket: config.bucket,
        endpoint: config.endpoint,
      },
      isHealthy: true,
      lastHealthCheck: new Date(),
    };
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

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
        Body: buffer,
        ContentType: mimeType,
        Metadata: Object.fromEntries(
          Object.entries(metadata).map(([key, value]) => [key, String(value)])
        ),
        ServerSideEncryption: options.encryption ? 'AES256' : undefined,
      });

      await this.s3Client.send(command);

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

      logger.info('File uploaded to S3 successfully', {
        storagePath,
        size: buffer.length,
        checksum,
        mimeType,
        workspaceId: options.workspaceId,
        userId: options.userId,
      });

      return result;
    } catch (error) {
      logger.error('Failed to upload file to S3', {
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

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: actualPath,
        Range: options?.range
          ? `bytes=${options.range.start}-${options.range.end}`
          : undefined,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('No file content received from S3');
      }

      return {
        stream: response.Body as Readable,
        mimeType: response.ContentType || 'application/octet-stream',
        size: response.ContentLength || 0,
        filename: path.basename(storagePath),
        lastModified: response.LastModified,
        etag: response.ETag,
        contentRange: response.ContentRange,
      };
    } catch (error) {
      logger.error('Failed to download file from S3', {
        storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async delete(storagePath: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      });

      await this.s3Client.send(command);

      // Delete versions if they exist
      const versions = await this.listVersions(storagePath);
      for (const version of versions) {
        const deleteVersionCommand = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: version.storagePath,
        });
        await this.s3Client.send(deleteVersionCommand);
      }

      logger.info('File deleted from S3 successfully', { storagePath });
    } catch (error) {
      logger.error('Failed to delete file from S3', {
        storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      });

      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(storagePath: string): Promise<Record<string, any>> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      });

      const response = await this.s3Client.send(command);

      return {
        size: response.ContentLength,
        mimeType: response.ContentType,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata || {},
        serverSideEncryption: response.ServerSideEncryption,
      };
    } catch (error) {
      logger.error('Failed to get file metadata from S3', {
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

      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${directory}/${basename}_v`,
      });

      const response = await this.s3Client.send(command);
      const versions = [];

      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key) {
            const match = object.Key.match(
              new RegExp(`${basename}_v(\\d+)${extension}$`)
            );
            if (match) {
              const version = parseInt(match[1]);
              const metadata = await this.getMetadata(object.Key);

              versions.push({
                version,
                storagePath: object.Key,
                size: object.Size || 0,
                uploadedAt: object.LastModified || new Date(),
                checksum: metadata.metadata?.checksum || '',
              });
            }
          }
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

  async generateThumbnail(
    storagePath: string,
    outputPath: string,
    options?: { width?: number; height?: number; quality?: number }
  ): Promise<void> {
    // This would require downloading the file, processing it, and re-uploading
    // Placeholder implementation
    logger.info('Thumbnail generation not implemented for S3', {
      storagePath,
      outputPath,
    });
  }

  async generatePreview(
    storagePath: string,
    outputPath: string,
    options?: { width?: number; height?: number; quality?: number }
  ): Promise<void> {
    // This would require downloading the file, processing it, and re-uploading
    // Placeholder implementation
    logger.info('Preview generation not implemented for S3', {
      storagePath,
      outputPath,
    });
  }

  async compressFile(
    storagePath: string,
    outputPath: string,
    options?: { quality?: number; format?: string }
  ): Promise<{ size: number; compressionRatio: number }> {
    // This would require downloading the file, compressing it, and re-uploading
    // Placeholder implementation
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
    // Placeholder implementation
    return { size: 0, optimizationRatio: 1.0 };
  }

  async backup(
    storagePath: string,
    backupPath: string,
    options?: BackupOptions
  ): Promise<void> {
    try {
      // Copy object within S3
      const copyCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: backupPath,
        CopySource: `${this.bucket}/${storagePath}`,
      });

      await this.s3Client.send(copyCommand);

      logger.info('File backed up in S3 successfully', {
        storagePath,
        backupPath,
      });
    } catch (error) {
      logger.error('Failed to backup file in S3', {
        storagePath,
        backupPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async restore(backupPath: string, storagePath: string): Promise<void> {
    await this.backup(backupPath, storagePath); // Same operation in S3
  }

  async createSnapshot(workspaceId: string): Promise<string> {
    const snapshotId = `snapshot_${workspaceId}_${Date.now()}`;

    // List all objects in workspace
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: `${workspaceId}/`,
    });

    const response = await this.s3Client.send(command);

    // In a real implementation, you might create a manifest file
    // For now, just return the snapshot ID
    return snapshotId;
  }

  async restoreFromSnapshot(
    snapshotId: string,
    workspaceId: string
  ): Promise<void> {
    // Placeholder implementation
    logger.info('Snapshot restore not fully implemented for S3', {
      snapshotId,
      workspaceId,
    });
  }

  async cleanup(olderThan: Date): Promise<string[]> {
    const deletedFiles: string[] = [];

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
      });

      const response = await this.s3Client.send(command);

      if (response.Contents) {
        for (const object of response.Contents) {
          if (
            object.Key &&
            object.LastModified &&
            object.LastModified < olderThan
          ) {
            await this.delete(object.Key);
            deletedFiles.push(object.Key);
          }
        }
      }

      logger.info('S3 cleanup completed', {
        deletedCount: deletedFiles.length,
        olderThan,
      });
    } catch (error) {
      logger.error('Failed to cleanup S3 files', {
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
    // Placeholder implementation
    return [];
  }

  getBackendInfo(): StorageBackend {
    return { ...this.backend, lastHealthCheck: new Date() };
  }

  async getStorageUsage(workspaceId?: string): Promise<StorageUsage> {
    try {
      const prefix = workspaceId ? `${workspaceId}/` : '';
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);
      let totalSize = 0;
      let fileCount = 0;
      const workspaceBreakdown: Record<
        string,
        { used: number; fileCount: number }
      > = {};

      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key && object.Size) {
            totalSize += object.Size;
            fileCount++;

            // Extract workspace from key
            const workspaceFromKey = object.Key.split('/')[0];
            if (!workspaceBreakdown[workspaceFromKey]) {
              workspaceBreakdown[workspaceFromKey] = { used: 0, fileCount: 0 };
            }
            workspaceBreakdown[workspaceFromKey].used += object.Size;
            workspaceBreakdown[workspaceFromKey].fileCount++;
          }
        }
      }

      return {
        used: totalSize,
        available: -1, // S3 doesn't have a fixed limit
        total: -1, // S3 doesn't have a fixed limit
        fileCount,
        workspaceBreakdown,
      };
    } catch (error) {
      logger.error('Failed to get S3 storage usage', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Try to list objects to test connectivity
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      });

      await this.s3Client.send(command);

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
    throw new Error('Backend switching not implemented for S3 storage');
  }

  async createSignedUrl(
    storagePath: string,
    expiresIn: number,
    permissions?: ('read' | 'write' | 'delete')[]
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      logger.error('Failed to create signed URL', {
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
    // Process deletes in parallel with concurrency limit
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
    // Copy to new location
    await this.backup(fromPath, toPath);

    // Delete original
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
    // Placeholder for file indexing
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
    // Placeholder for file search
    return [];
  }
}
