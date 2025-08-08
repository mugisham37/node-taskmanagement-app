import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as sharp from 'sharp';
import { Readable } from 'stream';
import {
  FileStorageService,
  UploadOptions,
  UploadResult,
  DownloadOptions,
  DownloadResult,
  StorageBackend,
} from '../../domain/file-management/services/file-storage.service';
import { logger } from '../../utils/logger';

export class LocalStorageService implements FileStorageService {
  private readonly basePath: string;
  private readonly maxFileSize: number;

  constructor(
    basePath: string = './uploads',
    maxFileSize: number = 100 * 1024 * 1024
  ) {
    this.basePath = basePath;
    this.maxFileSize = maxFileSize;
    this.ensureDirectoryExists(basePath);
  }

  async upload(
    buffer: Buffer,
    filename: string,
    options: UploadOptions
  ): Promise<UploadResult> {
    try {
      // Validate file size
      if (options.maxSize && buffer.length > options.maxSize) {
        throw new Error(
          `File size ${buffer.length} exceeds maximum allowed size ${options.maxSize}`
        );
      }

      if (buffer.length > this.maxFileSize) {
        throw new Error(
          `File size ${buffer.length} exceeds system maximum ${this.maxFileSize}`
        );
      }

      // Generate checksum
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

      // Detect MIME type
      const mimeType = await this.detectMimeType(buffer, filename);

      // Validate MIME type if restrictions are set
      if (
        options.allowedMimeTypes &&
        !options.allowedMimeTypes.includes(mimeType)
      ) {
        throw new Error(`MIME type ${mimeType} is not allowed`);
      }

      // Generate storage path
      const storagePath = this.generateStoragePath(
        options.workspaceId,
        filename,
        checksum
      );
      const fullPath = path.join(this.basePath, storagePath);

      // Ensure directory exists
      await this.ensureDirectoryExists(path.dirname(fullPath));

      // Write file
      await fs.writeFile(fullPath, buffer);

      // Extract metadata
      const metadata = await this.extractMetadata(buffer, mimeType);

      // Generate thumbnail if requested and supported
      if (options.generateThumbnail && this.canGenerateThumbnail(mimeType)) {
        await this.generateThumbnail(
          storagePath,
          this.getThumbnailPath(storagePath)
        );
      }

      // Generate preview if requested and supported
      if (options.generatePreview && this.canGeneratePreview(mimeType)) {
        await this.generatePreview(
          storagePath,
          this.getPreviewPath(storagePath)
        );
      }

      logger.info('File uploaded successfully', {
        storagePath,
        size: buffer.length,
        checksum,
        mimeType,
        workspaceId: options.workspaceId,
        userId: options.userId,
      });

      return {
        storagePath,
        size: buffer.length,
        checksum,
        mimeType,
        metadata,
      };
    } catch (error) {
      logger.error('Failed to upload file', {
        filename,
        error: error.message,
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

      // Handle thumbnail/preview requests
      if (options?.thumbnail) {
        actualPath = this.getThumbnailPath(storagePath);
      } else if (options?.preview) {
        actualPath = this.getPreviewPath(storagePath);
      }

      const fullPath = path.join(this.basePath, actualPath);

      // Check if file exists
      if (!(await this.exists(actualPath))) {
        throw new Error(`File not found: ${actualPath}`);
      }

      // Get file stats
      const stats = await fs.stat(fullPath);
      const mimeType = await this.detectMimeTypeFromPath(fullPath);

      // Create readable stream
      const stream = Readable.from(await fs.readFile(fullPath));

      return {
        stream,
        mimeType,
        size: stats.size,
        filename: path.basename(storagePath),
      };
    } catch (error) {
      logger.error('Failed to download file', {
        storagePath,
        error: error.message,
      });
      throw error;
    }
  }

  async delete(storagePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.basePath, storagePath);
      await fs.unlink(fullPath);

      // Also delete thumbnail and preview if they exist
      const thumbnailPath = path.join(
        this.basePath,
        this.getThumbnailPath(storagePath)
      );
      const previewPath = path.join(
        this.basePath,
        this.getPreviewPath(storagePath)
      );

      try {
        await fs.unlink(thumbnailPath);
      } catch {
        // Ignore if thumbnail doesn't exist
      }

      try {
        await fs.unlink(previewPath);
      } catch {
        // Ignore if preview doesn't exist
      }

      logger.info('File deleted successfully', { storagePath });
    } catch (error) {
      logger.error('Failed to delete file', {
        storagePath,
        error: error.message,
      });
      throw error;
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.basePath, storagePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(storagePath: string): Promise<Record<string, any>> {
    try {
      const fullPath = path.join(this.basePath, storagePath);
      const stats = await fs.stat(fullPath);
      const buffer = await fs.readFile(fullPath);
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

      return {
        size: stats.size,
        checksum,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        accessedAt: stats.atime,
      };
    } catch (error) {
      logger.error('Failed to get file metadata', {
        storagePath,
        error: error.message,
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
    const versionedPath = this.getVersionedPath(originalStoragePath, version);
    const result = await this.upload(buffer, path.basename(versionedPath), {
      ...options,
      generateThumbnail: false, // Don't generate thumbnails for versions
      generatePreview: false,
    });

    return {
      ...result,
      storagePath: versionedPath,
    };
  }

  async generateThumbnail(
    storagePath: string,
    outputPath: string,
    options?: { width?: number; height?: number; quality?: number }
  ): Promise<void> {
    try {
      const fullInputPath = path.join(this.basePath, storagePath);
      const fullOutputPath = path.join(this.basePath, outputPath);

      await this.ensureDirectoryExists(path.dirname(fullOutputPath));

      await sharp(fullInputPath)
        .resize(options?.width || 200, options?.height || 200, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: options?.quality || 80 })
        .toFile(fullOutputPath);

      logger.info('Thumbnail generated successfully', {
        storagePath,
        outputPath,
      });
    } catch (error) {
      logger.error('Failed to generate thumbnail', {
        storagePath,
        outputPath,
        error: error.message,
      });
      throw error;
    }
  }

  async generatePreview(
    storagePath: string,
    outputPath: string,
    options?: { width?: number; height?: number; quality?: number }
  ): Promise<void> {
    try {
      const fullInputPath = path.join(this.basePath, storagePath);
      const fullOutputPath = path.join(this.basePath, outputPath);

      await this.ensureDirectoryExists(path.dirname(fullOutputPath));

      await sharp(fullInputPath)
        .resize(options?.width || 800, options?.height || 600, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: options?.quality || 90 })
        .toFile(fullOutputPath);

      logger.info('Preview generated successfully', {
        storagePath,
        outputPath,
      });
    } catch (error) {
      logger.error('Failed to generate preview', {
        storagePath,
        outputPath,
        error: error.message,
      });
      throw error;
    }
  }

  async compressFile(
    storagePath: string,
    outputPath: string,
    options?: { quality?: number; format?: string }
  ): Promise<{ size: number; compressionRatio: number }> {
    try {
      const fullInputPath = path.join(this.basePath, storagePath);
      const fullOutputPath = path.join(this.basePath, outputPath);

      const originalStats = await fs.stat(fullInputPath);
      const originalSize = originalStats.size;

      await this.ensureDirectoryExists(path.dirname(fullOutputPath));

      // Compress based on format
      const format = options?.format || 'jpeg';
      const quality = options?.quality || 80;

      let sharpInstance = sharp(fullInputPath);

      if (format === 'jpeg') {
        sharpInstance = sharpInstance.jpeg({ quality });
      } else if (format === 'png') {
        sharpInstance = sharpInstance.png({ quality });
      } else if (format === 'webp') {
        sharpInstance = sharpInstance.webp({ quality });
      }

      await sharpInstance.toFile(fullOutputPath);

      const compressedStats = await fs.stat(fullOutputPath);
      const compressedSize = compressedStats.size;
      const compressionRatio = originalSize / compressedSize;

      logger.info('File compressed successfully', {
        storagePath,
        outputPath,
        originalSize,
        compressedSize,
        compressionRatio,
      });

      return {
        size: compressedSize,
        compressionRatio,
      };
    } catch (error) {
      logger.error('Failed to compress file', {
        storagePath,
        outputPath,
        error: error.message,
      });
      throw error;
    }
  }

  async backup(storagePath: string, backupPath: string): Promise<void> {
    try {
      const fullInputPath = path.join(this.basePath, storagePath);
      const fullBackupPath = path.join(this.basePath, backupPath);

      await this.ensureDirectoryExists(path.dirname(fullBackupPath));
      await fs.copyFile(fullInputPath, fullBackupPath);

      logger.info('File backed up successfully', {
        storagePath,
        backupPath,
      });
    } catch (error) {
      logger.error('Failed to backup file', {
        storagePath,
        backupPath,
        error: error.message,
      });
      throw error;
    }
  }

  async restore(backupPath: string, storagePath: string): Promise<void> {
    try {
      const fullBackupPath = path.join(this.basePath, backupPath);
      const fullStoragePath = path.join(this.basePath, storagePath);

      await this.ensureDirectoryExists(path.dirname(fullStoragePath));
      await fs.copyFile(fullBackupPath, fullStoragePath);

      logger.info('File restored successfully', {
        backupPath,
        storagePath,
      });
    } catch (error) {
      logger.error('Failed to restore file', {
        backupPath,
        storagePath,
        error: error.message,
      });
      throw error;
    }
  }

  async cleanup(olderThan: Date): Promise<string[]> {
    const deletedFiles: string[] = [];

    try {
      const files = await this.getAllFiles(this.basePath);

      for (const file of files) {
        const stats = await fs.stat(file);
        if (stats.mtime < olderThan) {
          await fs.unlink(file);
          deletedFiles.push(path.relative(this.basePath, file));
        }
      }

      logger.info('Cleanup completed', {
        deletedCount: deletedFiles.length,
        olderThan,
      });
    } catch (error) {
      logger.error('Failed to cleanup files', {
        error: error.message,
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
      const fullPath = path.join(this.basePath, storagePath);
      const buffer = await fs.readFile(fullPath);
      const actualChecksum = crypto
        .createHash('sha256')
        .update(buffer)
        .digest('hex');

      return actualChecksum === expectedChecksum;
    } catch (error) {
      logger.error('Failed to validate file integrity', {
        storagePath,
        error: error.message,
      });
      return false;
    }
  }

  getBackendInfo(): StorageBackend {
    return {
      name: 'Local File System',
      type: 'local',
    };
  }

  async getStorageUsage(): Promise<{
    used: number;
    available: number;
    total: number;
  }> {
    try {
      const stats = await fs.stat(this.basePath);
      // For local storage, we can't easily get disk usage, so return basic info
      const used = await this.calculateDirectorySize(this.basePath);

      return {
        used,
        available: -1, // Not available for local storage
        total: -1, // Not available for local storage
      };
    } catch (error) {
      logger.error('Failed to get storage usage', {
        error: error.message,
      });
      throw error;
    }
  }

  // Private helper methods
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private generateStoragePath(
    workspaceId: string,
    filename: string,
    checksum: string
  ): string {
    const ext = path.extname(filename);
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${workspaceId}/${year}/${month}/${day}/${checksum}${ext}`;
  }

  private getThumbnailPath(storagePath: string): string {
    const ext = path.extname(storagePath);
    const basePath = storagePath.replace(ext, '');
    return `${basePath}_thumb.jpg`;
  }

  private getPreviewPath(storagePath: string): string {
    const ext = path.extname(storagePath);
    const basePath = storagePath.replace(ext, '');
    return `${basePath}_preview.jpg`;
  }

  private getVersionedPath(originalPath: string, version: number): string {
    const ext = path.extname(originalPath);
    const basePath = originalPath.replace(ext, '');
    return `${basePath}_v${version}${ext}`;
  }

  private async detectMimeType(
    buffer: Buffer,
    filename: string
  ): Promise<string> {
    // Simple MIME type detection based on file extension
    // In a real implementation, you might want to use a library like 'file-type'
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
      '.xls': 'application/vnd.ms-excel',
      '.xlsx':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx':
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  private async detectMimeTypeFromPath(filePath: string): Promise<string> {
    const filename = path.basename(filePath);
    const buffer = Buffer.alloc(0); // Empty buffer for this simple implementation
    return this.detectMimeType(buffer, filename);
  }

  private async extractMetadata(
    buffer: Buffer,
    mimeType: string
  ): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {
      size: buffer.length,
      checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
    };

    // Extract image metadata if it's an image
    if (mimeType.startsWith('image/')) {
      try {
        const imageMetadata = await sharp(buffer).metadata();
        metadata.width = imageMetadata.width;
        metadata.height = imageMetadata.height;
        metadata.format = imageMetadata.format;
        metadata.channels = imageMetadata.channels;
        metadata.density = imageMetadata.density;
      } catch (error) {
        logger.warn('Failed to extract image metadata', {
          error: error.message,
        });
      }
    }

    return metadata;
  }

  private canGenerateThumbnail(mimeType: string): boolean {
    return mimeType.startsWith('image/') && !mimeType.includes('svg');
  }

  private canGeneratePreview(mimeType: string): boolean {
    return mimeType.startsWith('image/') && !mimeType.includes('svg');
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.getAllFiles(fullPath)));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  private async calculateDirectorySize(dir: string): Promise<number> {
    let size = 0;
    const files = await this.getAllFiles(dir);

    for (const file of files) {
      const stats = await fs.stat(file);
      size += stats.size;
    }

    return size;
  }
}
