import { FileEntity } from '../entities/file.entity';
import { AttachmentEntity } from '../entities/attachment.entity';
import { FileRepository } from '../repositories/file.repository';
import {
  FileStorageService,
  UploadOptions,
  UploadResult,
} from './file-storage.service';
import { FileMetadata } from '../value-objects/file-metadata.vo';
import { FileAccessControl } from '../value-objects/file-access-control.vo';
import { FileVersion } from '../value-objects/file-version.vo';
import { EnhancedClamAVScannerService } from '../../../infrastructure/storage/enhanced-clamav-scanner.service';
import { logger } from '../../../shared/utils/logger';
import * as crypto from 'crypto';

export interface FileUploadRequest {
  buffer: Buffer;
  filename: string;
  workspaceId: string;
  userId: string;
  attachTo?: {
    type: 'task' | 'comment' | 'project';
    id: string;
  };
  description?: string;
  generateThumbnail?: boolean;
  generatePreview?: boolean;
  runVirusScan?: boolean;
  compress?: boolean;
  maxSize?: number;
  allowedMimeTypes?: string[];
  customMetadata?: Record<string, any>;
  accessControl?: {
    isPublic?: boolean;
    workspaceLevel?: boolean;
    projectLevel?: boolean;
    specificUsers?: Array<{
      userId: string;
      permissions: string[];
    }>;
  };
}

export interface FileDownloadRequest {
  fileId: string;
  userId: string;
  version?: number;
  thumbnail?: boolean;
  preview?: boolean;
  range?: { start: number; end: number };
}

export interface FileSearchRequest {
  workspaceId?: string;
  userId?: string;
  mimeType?: string;
  sizeRange?: { min: number; max: number };
  dateRange?: { from: Date; to: Date };
  tags?: string[];
  fullTextSearch?: string;
  limit?: number;
  offset?: number;
}

export class FileManagementService {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageService: FileStorageService,
    private readonly virusScanner?: EnhancedClamAVScannerService
  ) {}

  async uploadFile(request: FileUploadRequest): Promise<{
    file: FileEntity;
    attachment?: AttachmentEntity;
  }> {
    try {
      logger.info('Starting file upload', {
        filename: request.filename,
        size: request.buffer.length,
        workspaceId: request.workspaceId,
        userId: request.userId,
      });

      // Check for duplicate files
      const checksum = crypto
        .createHash('sha256')
        .update(request.buffer)
        .digest('hex');
      const existingFile = await this.fileRepository.findByChecksum(
        checksum,
        request.workspaceId
      );

      if (existingFile && !existingFile.isDeleted) {
        logger.info('Duplicate file detected, returning existing file', {
          existingFileId: existingFile.id,
          checksum,
        });

        // Create attachment if requested
        let attachment: AttachmentEntity | undefined;
        if (request.attachTo) {
          attachment = await this.createAttachment(existingFile.id, request);
        }

        return { file: existingFile, attachment };
      }

      // Upload to storage
      const uploadOptions: UploadOptions = {
        workspaceId: request.workspaceId,
        userId: request.userId,
        generateThumbnail: request.generateThumbnail,
        generatePreview: request.generatePreview,
        runVirusScan: request.runVirusScan,
        compress: request.compress,
        maxSize: request.maxSize,
        allowedMimeTypes: request.allowedMimeTypes,
        customMetadata: request.customMetadata,
      };

      const uploadResult = await this.storageService.upload(
        request.buffer,
        request.filename,
        uploadOptions
      );

      // Create file metadata
      const metadata = new FileMetadata({
        checksum: uploadResult.checksum,
        tags: [],
        customProperties: uploadResult.metadata,
        virusScanStatus: uploadResult.virusScanResult || 'pending',
        virusScanDate: uploadResult.virusScanResult ? new Date() : undefined,
        compressionRatio: uploadResult.compressionRatio,
        isCompressed: !!uploadResult.compressionRatio,
        thumbnailGenerated: !!uploadResult.thumbnailPath,
        previewGenerated: !!uploadResult.previewPath,
      });

      // Create access control
      const accessControl = new FileAccessControl({
        isPublic: request.accessControl?.isPublic || false,
        workspaceLevel: request.accessControl?.workspaceLevel || true,
        projectLevel: request.accessControl?.projectLevel || false,
        specificUsers: request.accessControl?.specificUsers || [],
        inheritFromParent: !!request.attachTo,
        parentType: request.attachTo?.type,
        parentId: request.attachTo?.id,
      });

      // Create file entity
      const fileEntity = new FileEntity({
        id: crypto.randomUUID(),
        workspaceId: request.workspaceId,
        uploadedBy: request.userId,
        originalName: request.filename,
        storagePath: uploadResult.storagePath,
        mimeType: uploadResult.mimeType,
        size: uploadResult.size,
        metadata,
        accessControl,
        versions: [],
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Save to repository
      const savedFile = await this.fileRepository.save(fileEntity);

      // Create attachment if requested
      let attachment: AttachmentEntity | undefined;
      if (request.attachTo) {
        attachment = await this.createAttachment(savedFile.id, request);
      }

      // Run virus scan if not done during upload
      if (
        request.runVirusScan &&
        this.virusScanner &&
        !uploadResult.virusScanResult
      ) {
        this.performVirusScan(savedFile.id, uploadResult.storagePath);
      }

      logger.info('File upload completed successfully', {
        fileId: savedFile.id,
        storagePath: uploadResult.storagePath,
        size: uploadResult.size,
        attachmentId: attachment?.id,
      });

      return { file: savedFile, attachment };
    } catch (error) {
      logger.error('File upload failed', {
        filename: request.filename,
        workspaceId: request.workspaceId,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async downloadFile(request: FileDownloadRequest) {
    try {
      // Get file from repository
      const file = await this.fileRepository.findById(request.fileId);
      if (!file) {
        throw new Error('File not found');
      }

      // Check permissions
      if (!(await this.checkFilePermission(file, request.userId, 'read'))) {
        throw new Error('Access denied');
      }

      // Check if file is deleted
      if (file.isDeleted) {
        throw new Error('File has been deleted');
      }

      // Download from storage
      const downloadResult = await this.storageService.download(
        file.storagePath,
        {
          version: request.version,
          thumbnail: request.thumbnail,
          preview: request.preview,
          range: request.range,
        }
      );

      logger.info('File download completed', {
        fileId: request.fileId,
        userId: request.userId,
        version: request.version,
        thumbnail: request.thumbnail,
        preview: request.preview,
      });

      return {
        file,
        stream: downloadResult.stream,
        mimeType: downloadResult.mimeType,
        size: downloadResult.size,
        filename: downloadResult.filename,
        lastModified: downloadResult.lastModified,
        etag: downloadResult.etag,
        contentRange: downloadResult.contentRange,
      };
    } catch (error) {
      logger.error('File download failed', {
        fileId: request.fileId,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async uploadFileVersion(
    fileId: string,
    buffer: Buffer,
    filename: string,
    userId: string,
    changeDescription?: string
  ): Promise<FileEntity> {
    try {
      // Get existing file
      const file = await this.fileRepository.findById(fileId);
      if (!file) {
        throw new Error('File not found');
      }

      // Check permissions
      if (!(await this.checkFilePermission(file, userId, 'write'))) {
        throw new Error('Access denied');
      }

      // Get next version number
      const nextVersion = Math.max(...file.versions.map(v => v.version), 0) + 1;

      // Upload new version
      const uploadResult = await this.storageService.uploadVersion(
        buffer,
        file.storagePath,
        nextVersion,
        {
          workspaceId: file.workspaceId,
          userId,
        }
      );

      // Create version object
      const version = new FileVersion({
        version: nextVersion,
        storagePath: uploadResult.storagePath,
        size: uploadResult.size,
        checksum: uploadResult.checksum,
        uploadedBy: userId,
        uploadedAt: new Date(),
        changeDescription,
        metadata: uploadResult.metadata,
      });

      // Add version to file
      file.addVersion(version);

      // Save updated file
      const updatedFile = await this.fileRepository.save(file);

      logger.info('File version uploaded successfully', {
        fileId,
        version: nextVersion,
        userId,
        size: uploadResult.size,
      });

      return updatedFile;
    } catch (error) {
      logger.error('File version upload failed', {
        fileId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async deleteFile(
    fileId: string,
    userId: string,
    permanent: boolean = false
  ): Promise<void> {
    try {
      // Get file
      const file = await this.fileRepository.findById(fileId);
      if (!file) {
        throw new Error('File not found');
      }

      // Check permissions
      if (!(await this.checkFilePermission(file, userId, 'delete'))) {
        throw new Error('Access denied');
      }

      if (permanent) {
        // Delete from storage
        await this.storageService.delete(file.storagePath);

        // Delete from repository
        await this.fileRepository.delete(fileId);

        logger.info('File permanently deleted', { fileId, userId });
      } else {
        // Soft delete
        await this.fileRepository.softDelete(fileId);

        logger.info('File soft deleted', { fileId, userId });
      }
    } catch (error) {
      logger.error('File deletion failed', {
        fileId,
        userId,
        permanent,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async restoreFile(fileId: string, userId: string): Promise<void> {
    try {
      // Get file
      const file = await this.fileRepository.findById(fileId);
      if (!file) {
        throw new Error('File not found');
      }

      // Check permissions
      if (!(await this.checkFilePermission(file, userId, 'write'))) {
        throw new Error('Access denied');
      }

      // Restore file
      await this.fileRepository.restore(fileId);

      logger.info('File restored', { fileId, userId });
    } catch (error) {
      logger.error('File restoration failed', {
        fileId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async searchFiles(request: FileSearchRequest): Promise<{
    files: FileEntity[];
    total: number;
  }> {
    try {
      const filters = {
        workspaceId: request.workspaceId,
        uploadedBy: request.userId,
        mimeType: request.mimeType,
        minSize: request.sizeRange?.min,
        maxSize: request.sizeRange?.max,
        createdAfter: request.dateRange?.from,
        createdBefore: request.dateRange?.to,
        tags: request.tags,
        search: request.fullTextSearch,
        isDeleted: false,
      };

      const files = await this.fileRepository.findMany(
        filters,
        request.limit,
        request.offset
      );

      const total = await this.fileRepository.count(filters);

      return { files, total };
    } catch (error) {
      logger.error('File search failed', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getFilesByAttachment(
    entityType: string,
    entityId: string,
    userId: string
  ): Promise<Array<{ file: FileEntity; attachment: AttachmentEntity }>> {
    try {
      const attachments = await this.fileRepository.findAttachments({
        attachedTo: entityType,
        attachedToId: entityId,
        isDeleted: false,
      });

      const fileIds = attachments.map(a => a.fileId);
      const files = await this.fileRepository.findFilesByIds(fileIds);

      // Filter files based on permissions
      const accessibleFiles = [];
      for (const file of files) {
        if (await this.checkFilePermission(file, userId, 'read')) {
          const attachment = attachments.find(a => a.fileId === file.id);
          if (attachment) {
            accessibleFiles.push({ file, attachment });
          }
        }
      }

      return accessibleFiles.sort(
        (a, b) => a.attachment.position - b.attachment.position
      );
    } catch (error) {
      logger.error('Failed to get files by attachment', {
        entityType,
        entityId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getStorageUsage(workspaceId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    sizeByMimeType: Record<string, number>;
  }> {
    try {
      return await this.fileRepository.getStorageUsageByWorkspace(workspaceId);
    } catch (error) {
      logger.error('Failed to get storage usage', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async cleanupFiles(olderThan: Date): Promise<{
    deletedFiles: string[];
    cleanedStorage: string[];
  }> {
    try {
      // Find files for cleanup
      const filesToCleanup =
        await this.fileRepository.findFilesForCleanup(olderThan);

      const deletedFiles: string[] = [];
      const cleanedStorage: string[] = [];

      for (const file of filesToCleanup) {
        try {
          // Delete from storage
          await this.storageService.delete(file.storagePath);
          cleanedStorage.push(file.storagePath);

          // Delete from repository
          await this.fileRepository.delete(file.id);
          deletedFiles.push(file.id);
        } catch (error) {
          logger.warn('Failed to cleanup file', {
            fileId: file.id,
            storagePath: file.storagePath,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Cleanup orphaned storage files
      const orphanedFiles = await this.storageService.cleanup(olderThan);
      cleanedStorage.push(...orphanedFiles);

      logger.info('File cleanup completed', {
        deletedFiles: deletedFiles.length,
        cleanedStorage: cleanedStorage.length,
        olderThan,
      });

      return { deletedFiles, cleanedStorage };
    } catch (error) {
      logger.error('File cleanup failed', {
        olderThan,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async createAttachment(
    fileId: string,
    request: FileUploadRequest
  ): Promise<AttachmentEntity> {
    if (!request.attachTo) {
      throw new Error('Attachment target not specified');
    }

    const attachment = new AttachmentEntity({
      id: crypto.randomUUID(),
      fileId,
      workspaceId: request.workspaceId,
      attachedTo: request.attachTo.type,
      attachedToId: request.attachTo.id,
      attachedBy: request.userId,
      description: request.description,
      position: 0, // Will be updated based on existing attachments
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.fileRepository.saveAttachment(attachment);
  }

  private async checkFilePermission(
    file: FileEntity,
    userId: string,
    permission: string
  ): Promise<boolean> {
    // Check if file is public and permission is read
    if (file.accessControl.isPublic && permission === 'read') {
      return true;
    }

    // Check specific user permissions
    if (file.accessControl.hasPermission(userId, permission)) {
      return true;
    }

    // Check if user is the uploader
    if (file.uploadedBy === userId) {
      return true;
    }

    // Additional workspace/project level checks would go here
    // This would typically involve checking workspace membership, project membership, etc.

    return false;
  }

  private async performVirusScan(
    fileId: string,
    storagePath: string
  ): Promise<void> {
    if (!this.virusScanner) return;

    try {
      const scanResult = await this.virusScanner.scanFile(storagePath);

      // Update file with scan results
      const file = await this.fileRepository.findById(fileId);
      if (file) {
        const updatedMetadata = file.metadata.updateVirusScanResult(
          scanResult.isClean ? 'clean' : 'infected'
        );

        file.updateMetadata(updatedMetadata.toPlainObject());
        await this.fileRepository.save(file);

        if (!scanResult.isClean) {
          logger.warn('Virus detected in file', {
            fileId,
            storagePath,
            virusName: scanResult.virusName,
          });
        }
      }
    } catch (error) {
      logger.error('Virus scan failed', {
        fileId,
        storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
