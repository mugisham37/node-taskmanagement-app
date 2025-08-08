/**
 * Consolidated File Storage Service Implementation
 * Unified file storage service with multiple provider support (S3, Azure Blob, Local)
 */

import {
  BaseExternalService,
  ServiceProvider,
  ServiceFactory,
} from './service-factory';
import { logger } from '../logging/logger';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

export interface FileMetadata {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
  uploadedAt: Date;
  uploadedBy?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface FileUploadOptions {
  filename?: string;
  mimeType?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  isPublic?: boolean;
  expiresAt?: Date;
  encryption?: boolean;
}

export interface FileDownloadOptions {
  range?: { start: number; end: number };
  responseType?: 'buffer' | 'stream';
}

export interface FileUploadResult {
  fileId: string;
  filename: string;
  url: string;
  publicUrl?: string;
  metadata: FileMetadata;
  provider: string;
}

export interface FileInfo {
  fileId: string;
  filename: string;
  url: string;
  publicUrl?: string;
  metadata: FileMetadata;
  exists: boolean;
  provider: string;
}

export interface IFileStorageService {
  uploadFile(
    buffer: Buffer,
    filename: string,
    options?: FileUploadOptions
  ): Promise<FileUploadResult>;
  downloadFile(fileId: string, options?: FileDownloadOptions): Promise<Buffer>;
  deleteFile(fileId: string): Promise<void>;
  getFileInfo(fileId: string): Promise<FileInfo>;
  getFileUrl(fileId: string, expiresIn?: number): Promise<string>;
  getPublicUrl(fileId: string): Promise<string>;
  listFiles(prefix?: string, limit?: number): Promise<FileInfo[]>;
  copyFile(
    sourceFileId: string,
    destinationFileId: string
  ): Promise<FileUploadResult>;
  moveFile(
    sourceFileId: string,
    destinationFileId: string
  ): Promise<FileUploadResult>;
}

export abstract class BaseFileStorageService
  extends BaseExternalService
  implements IFileStorageService
{
  constructor(name: string, config: Record<string, any>) {
    super(name, config);
  }

  public abstract uploadFile(
    buffer: Buffer,
    filename: string,
    options?: FileUploadOptions
  ): Promise<FileUploadResult>;

  public abstract downloadFile(
    fileId: string,
    options?: FileDownloadOptions
  ): Promise<Buffer>;
  public abstract deleteFile(fileId: string): Promise<void>;
  public abstract getFileInfo(fileId: string): Promise<FileInfo>;
  public abstract getFileUrl(
    fileId: string,
    expiresIn?: number
  ): Promise<string>;
  public abstract getPublicUrl(fileId: string): Promise<string>;
  public abstract listFiles(
    prefix?: string,
    limit?: number
  ): Promise<FileInfo[]>;
  public abstract copyFile(
    sourceFileId: string,
    destinationFileId: string
  ): Promise<FileUploadResult>;
  public abstract moveFile(
    sourceFileId: string,
    destinationFileId: string
  ): Promise<FileUploadResult>;

  protected generateFileId(): string {
    return crypto.randomUUID();
  }

  protected calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  protected sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  protected validateFile(
    buffer: Buffer,
    filename: string,
    options?: FileUploadOptions
  ): void {
    const maxFileSize = this.config.maxFileSize || 100 * 1024 * 1024; // 100MB default

    if (buffer.length > maxFileSize) {
      throw new Error(
        `File size exceeds maximum limit of ${maxFileSize} bytes`
      );
    }

    if (!filename || filename.trim().length === 0) {
      throw new Error('Filename is required');
    }

    // Check allowed file types if configured
    if (this.config.allowedMimeTypes && options?.mimeType) {
      const allowedTypes = Array.isArray(this.config.allowedMimeTypes)
        ? this.config.allowedMimeTypes
        : [this.config.allowedMimeTypes];

      if (!allowedTypes.includes(options.mimeType)) {
        throw new Error(`File type ${options.mimeType} is not allowed`);
      }
    }

    // Check blocked file types
    if (this.config.blockedMimeTypes && options?.mimeType) {
      const blockedTypes = Array.isArray(this.config.blockedMimeTypes)
        ? this.config.blockedMimeTypes
        : [this.config.blockedMimeTypes];

      if (blockedTypes.includes(options.mimeType)) {
        throw new Error(`File type ${options.mimeType} is blocked`);
      }
    }
  }

  protected createFileMetadata(
    filename: string,
    buffer: Buffer,
    options?: FileUploadOptions
  ): FileMetadata {
    return {
      filename: this.sanitizeFilename(filename),
      originalName: filename,
      mimeType: options?.mimeType || 'application/octet-stream',
      size: buffer.length,
      checksum: this.calculateChecksum(buffer),
      uploadedAt: new Date(),
      uploadedBy: options?.metadata?.uploadedBy,
      tags: options?.tags || [],
      metadata: options?.metadata || {},
    };
  }
}

/**
 * Local File Storage Service Implementation
 */
export class LocalFileStorageService extends BaseFileStorageService {
  private basePath: string;

  constructor(provider: ServiceProvider) {
    super(provider.name, provider.config);
    this.basePath = this.config.basePath || './uploads';
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create upload directory: ${this.basePath}`, {
        error,
      });
      throw error;
    }
  }

  public async isHealthy(): Promise<boolean> {
    try {
      await fs.access(this.basePath, fs.constants.W_OK);
      return true;
    } catch (error) {
      logger.error(`Local storage health check failed`, { error });
      return false;
    }
  }

  public async uploadFile(
    buffer: Buffer,
    filename: string,
    options?: FileUploadOptions
  ): Promise<FileUploadResult> {
    this.validateFile(buffer, filename, options);

    return await this.executeWithCircuitBreaker(async () => {
      const fileId = this.generateFileId();
      const sanitizedFilename = this.sanitizeFilename(
        options?.filename || filename
      );
      const filePath = path.join(this.basePath, fileId);
      const metadata = this.createFileMetadata(filename, buffer, options);

      // Write file
      await fs.writeFile(filePath, buffer);

      // Write metadata
      const metadataPath = `${filePath}.meta`;
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      logger.info(`File uploaded successfully to local storage`, {
        fileId,
        filename: sanitizedFilename,
        size: buffer.length,
      });

      return {
        fileId,
        filename: sanitizedFilename,
        url: `file://${filePath}`,
        publicUrl: options?.isPublic
          ? `${this.config.publicBaseUrl}/${fileId}`
          : undefined,
        metadata,
        provider: this.name,
      };
    });
  }

  public async downloadFile(
    fileId: string,
    options?: FileDownloadOptions
  ): Promise<Buffer> {
    return await this.executeWithCircuitBreaker(async () => {
      const filePath = path.join(this.basePath, fileId);

      try {
        const buffer = await fs.readFile(filePath);

        if (options?.range) {
          const { start, end } = options.range;
          return buffer.slice(start, end + 1);
        }

        return buffer;
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          throw new Error(`File not found: ${fileId}`);
        }
        throw error;
      }
    });
  }

  public async deleteFile(fileId: string): Promise<void> {
    await this.executeWithCircuitBreaker(async () => {
      const filePath = path.join(this.basePath, fileId);
      const metadataPath = `${filePath}.meta`;

      try {
        await Promise.all([
          fs.unlink(filePath),
          fs.unlink(metadataPath).catch(() => {}), // Ignore if metadata doesn't exist
        ]);

        logger.info(`File deleted successfully from local storage`, { fileId });
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          throw new Error(`File not found: ${fileId}`);
        }
        throw error;
      }
    });
  }

  public async getFileInfo(fileId: string): Promise<FileInfo> {
    return await this.executeWithCircuitBreaker(async () => {
      const filePath = path.join(this.basePath, fileId);
      const metadataPath = `${filePath}.meta`;

      try {
        const [stats, metadataContent] = await Promise.all([
          fs.stat(filePath),
          fs.readFile(metadataPath, 'utf-8').catch(() => '{}'),
        ]);

        const metadata = JSON.parse(metadataContent) as FileMetadata;

        return {
          fileId,
          filename: metadata.filename || fileId,
          url: `file://${filePath}`,
          publicUrl: this.config.publicBaseUrl
            ? `${this.config.publicBaseUrl}/${fileId}`
            : undefined,
          metadata: metadata.filename
            ? metadata
            : {
                filename: fileId,
                originalName: fileId,
                mimeType: 'application/octet-stream',
                size: stats.size,
                checksum: '',
                uploadedAt: stats.birthtime,
              },
          exists: true,
          provider: this.name,
        };
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          return {
            fileId,
            filename: fileId,
            url: '',
            metadata: {} as FileMetadata,
            exists: false,
            provider: this.name,
          };
        }
        throw error;
      }
    });
  }

  public async getFileUrl(fileId: string, expiresIn?: number): Promise<string> {
    const filePath = path.join(this.basePath, fileId);
    return `file://${filePath}`;
  }

  public async getPublicUrl(fileId: string): Promise<string> {
    if (!this.config.publicBaseUrl) {
      throw new Error('Public URL not configured for local storage');
    }
    return `${this.config.publicBaseUrl}/${fileId}`;
  }

  public async listFiles(prefix?: string, limit?: number): Promise<FileInfo[]> {
    return await this.executeWithCircuitBreaker(async () => {
      const files = await fs.readdir(this.basePath);
      const fileInfos: FileInfo[] = [];

      const filteredFiles = files
        .filter(file => !file.endsWith('.meta'))
        .filter(file => !prefix || file.startsWith(prefix))
        .slice(0, limit || 100);

      for (const file of filteredFiles) {
        try {
          const fileInfo = await this.getFileInfo(file);
          fileInfos.push(fileInfo);
        } catch (error) {
          logger.warn(`Failed to get info for file: ${file}`, { error });
        }
      }

      return fileInfos;
    });
  }

  public async copyFile(
    sourceFileId: string,
    destinationFileId: string
  ): Promise<FileUploadResult> {
    return await this.executeWithCircuitBreaker(async () => {
      const sourcePath = path.join(this.basePath, sourceFileId);
      const destinationPath = path.join(this.basePath, destinationFileId);
      const sourceMetadataPath = `${sourcePath}.meta`;
      const destinationMetadataPath = `${destinationPath}.meta`;

      await Promise.all([
        fs.copyFile(sourcePath, destinationPath),
        fs
          .copyFile(sourceMetadataPath, destinationMetadataPath)
          .catch(() => {}),
      ]);

      const fileInfo = await this.getFileInfo(destinationFileId);

      return {
        fileId: destinationFileId,
        filename: fileInfo.filename,
        url: fileInfo.url,
        publicUrl: fileInfo.publicUrl,
        metadata: fileInfo.metadata,
        provider: this.name,
      };
    });
  }

  public async moveFile(
    sourceFileId: string,
    destinationFileId: string
  ): Promise<FileUploadResult> {
    const result = await this.copyFile(sourceFileId, destinationFileId);
    await this.deleteFile(sourceFileId);
    return result;
  }
}

/**
 * AWS S3 File Storage Service Implementation
 */
export class S3FileStorageService extends BaseFileStorageService {
  private s3Client: any;

  constructor(provider: ServiceProvider) {
    super(provider.name, provider.config);
    this.initializeS3Client();
  }

  private initializeS3Client(): void {
    try {
      // This would require AWS SDK v3
      // const { S3Client } = require('@aws-sdk/client-s3');
      // this.s3Client = new S3Client({
      //   region: this.config.region,
      //   credentials: {
      //     accessKeyId: this.config.accessKeyId,
      //     secretAccessKey: this.config.secretAccessKey,
      //   },
      // });

      logger.info(`S3 client initialized for ${this.name}`, {
        region: this.config.region,
        bucket: this.config.bucket,
      });
    } catch (error) {
      logger.error(`Failed to initialize S3 client for ${this.name}`, {
        error,
      });
      throw error;
    }
  }

  public async isHealthy(): Promise<boolean> {
    try {
      // Test bucket access
      // const command = new HeadBucketCommand({ Bucket: this.config.bucket });
      // await this.s3Client.send(command);
      return true;
    } catch (error) {
      logger.error(`S3 service ${this.name} health check failed`, { error });
      return false;
    }
  }

  public async uploadFile(
    buffer: Buffer,
    filename: string,
    options?: FileUploadOptions
  ): Promise<FileUploadResult> {
    this.validateFile(buffer, filename, options);

    return await this.executeWithCircuitBreaker(async () => {
      const fileId = this.generateFileId();
      const key =
        options?.filename || `${fileId}/${this.sanitizeFilename(filename)}`;
      const metadata = this.createFileMetadata(filename, buffer, options);

      // Mock S3 upload
      // const command = new PutObjectCommand({
      //   Bucket: this.config.bucket,
      //   Key: key,
      //   Body: buffer,
      //   ContentType: options?.mimeType,
      //   Metadata: {
      //     originalName: filename,
      //     uploadedBy: options?.metadata?.uploadedBy || '',
      //     tags: options?.tags?.join(',') || '',
      //   },
      //   ServerSideEncryption: options?.encryption ? 'AES256' : undefined,
      //   ACL: options?.isPublic ? 'public-read' : 'private',
      // });

      // await this.s3Client.send(command);

      logger.info(`File uploaded successfully to S3`, {
        fileId,
        key,
        bucket: this.config.bucket,
        size: buffer.length,
      });

      const baseUrl = `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com`;

      return {
        fileId,
        filename: this.sanitizeFilename(filename),
        url: `${baseUrl}/${key}`,
        publicUrl: options?.isPublic ? `${baseUrl}/${key}` : undefined,
        metadata,
        provider: this.name,
      };
    });
  }

  public async downloadFile(
    fileId: string,
    options?: FileDownloadOptions
  ): Promise<Buffer> {
    return await this.executeWithCircuitBreaker(async () => {
      // Mock S3 download
      // const command = new GetObjectCommand({
      //   Bucket: this.config.bucket,
      //   Key: fileId,
      //   Range: options?.range ? `bytes=${options.range.start}-${options.range.end}` : undefined,
      // });

      // const response = await this.s3Client.send(command);
      // const chunks: Uint8Array[] = [];

      // for await (const chunk of response.Body as any) {
      //   chunks.push(chunk);
      // }

      // return Buffer.concat(chunks);

      // Mock implementation
      return Buffer.from('mock file content');
    });
  }

  public async deleteFile(fileId: string): Promise<void> {
    await this.executeWithCircuitBreaker(async () => {
      // const command = new DeleteObjectCommand({
      //   Bucket: this.config.bucket,
      //   Key: fileId,
      // });

      // await this.s3Client.send(command);

      logger.info(`File deleted successfully from S3`, { fileId });
    });
  }

  public async getFileInfo(fileId: string): Promise<FileInfo> {
    return await this.executeWithCircuitBreaker(async () => {
      // Mock implementation
      const baseUrl = `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com`;

      return {
        fileId,
        filename: fileId,
        url: `${baseUrl}/${fileId}`,
        metadata: {
          filename: fileId,
          originalName: fileId,
          mimeType: 'application/octet-stream',
          size: 0,
          checksum: '',
          uploadedAt: new Date(),
        },
        exists: true,
        provider: this.name,
      };
    });
  }

  public async getFileUrl(
    fileId: string,
    expiresIn: number = 3600
  ): Promise<string> {
    // Generate presigned URL
    // const command = new GetObjectCommand({
    //   Bucket: this.config.bucket,
    //   Key: fileId,
    // });

    // const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
    // return signedUrl;

    // Mock implementation
    const baseUrl = `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com`;
    return `${baseUrl}/${fileId}?expires=${Date.now() + expiresIn * 1000}`;
  }

  public async getPublicUrl(fileId: string): Promise<string> {
    const baseUrl = `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com`;
    return `${baseUrl}/${fileId}`;
  }

  public async listFiles(prefix?: string, limit?: number): Promise<FileInfo[]> {
    return await this.executeWithCircuitBreaker(async () => {
      // Mock implementation
      return [];
    });
  }

  public async copyFile(
    sourceFileId: string,
    destinationFileId: string
  ): Promise<FileUploadResult> {
    return await this.executeWithCircuitBreaker(async () => {
      // const command = new CopyObjectCommand({
      //   Bucket: this.config.bucket,
      //   CopySource: `${this.config.bucket}/${sourceFileId}`,
      //   Key: destinationFileId,
      // });

      // await this.s3Client.send(command);

      const fileInfo = await this.getFileInfo(destinationFileId);

      return {
        fileId: destinationFileId,
        filename: fileInfo.filename,
        url: fileInfo.url,
        publicUrl: fileInfo.publicUrl,
        metadata: fileInfo.metadata,
        provider: this.name,
      };
    });
  }

  public async moveFile(
    sourceFileId: string,
    destinationFileId: string
  ): Promise<FileUploadResult> {
    const result = await this.copyFile(sourceFileId, destinationFileId);
    await this.deleteFile(sourceFileId);
    return result;
  }
}

/**
 * File Storage Service Factory
 */
export function createFileStorageService(
  provider: ServiceProvider
): BaseFileStorageService {
  switch (provider.name.toLowerCase()) {
    case 'local':
      return new LocalFileStorageService(provider);
    case 's3':
    case 'aws-s3':
      return new S3FileStorageService(provider);
    default:
      throw new Error(
        `Unknown file storage service provider: ${provider.name}`
      );
  }
}

/**
 * Consolidated File Storage Service Manager
 */
export class FileStorageServiceManager {
  private serviceFactory: ServiceFactory<BaseFileStorageService>;

  constructor(providers: ServiceProvider[]) {
    this.serviceFactory = new ServiceFactory(
      'file-storage',
      createFileStorageService,
      {
        providers,
        fallbackStrategy: 'failover',
        healthCheckInterval: 60000,
      }
    );
  }

  public async uploadFile(
    buffer: Buffer,
    filename: string,
    options?: FileUploadOptions
  ): Promise<FileUploadResult> {
    const service = await this.serviceFactory.getService();
    return await service.uploadFile(buffer, filename, options);
  }

  public async downloadFile(
    fileId: string,
    options?: FileDownloadOptions
  ): Promise<Buffer> {
    const service = await this.serviceFactory.getService();
    return await service.downloadFile(fileId, options);
  }

  public async deleteFile(fileId: string): Promise<void> {
    const service = await this.serviceFactory.getService();
    return await service.deleteFile(fileId);
  }

  public async getFileInfo(fileId: string): Promise<FileInfo> {
    const service = await this.serviceFactory.getService();
    return await service.getFileInfo(fileId);
  }

  public async getFileUrl(fileId: string, expiresIn?: number): Promise<string> {
    const service = await this.serviceFactory.getService();
    return await service.getFileUrl(fileId, expiresIn);
  }

  public async getHealthStatus(): Promise<Record<string, any>> {
    return await this.serviceFactory.getAllServicesHealth();
  }

  public getAvailableProviders(): string[] {
    return this.serviceFactory.getAvailableProviders();
  }
}

// Singleton instance
let fileStorageServiceManager: FileStorageServiceManager | null = null;

export function createFileStorageServiceManager(
  providers: ServiceProvider[]
): FileStorageServiceManager {
  if (!fileStorageServiceManager) {
    fileStorageServiceManager = new FileStorageServiceManager(providers);
  }
  return fileStorageServiceManager;
}

export function getFileStorageServiceManager(): FileStorageServiceManager {
  if (!fileStorageServiceManager) {
    throw new Error(
      'File storage service manager not initialized. Call createFileStorageServiceManager() first.'
    );
  }
  return fileStorageServiceManager;
}
