import { FileEntity } from '../entities/file.entity';
import { AttachmentEntity } from '../entities/attachment.entity';

export interface FileFilters {
  workspaceId?: string;
  uploadedBy?: string;
  mimeType?: string;
  mimeTypePrefix?: string; // e.g., 'image/', 'video/'
  minSize?: number;
  maxSize?: number;
  tags?: string[];
  virusScanStatus?: 'pending' | 'clean' | 'infected' | 'error';
  isDeleted?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string; // Search in filename and OCR text
}

export interface AttachmentFilters {
  workspaceId?: string;
  attachedTo?: string;
  attachedToId?: string;
  attachedBy?: string;
  isDeleted?: boolean;
}

export interface FileRepository {
  // File operations
  save(file: FileEntity): Promise<FileEntity>;
  findById(id: string): Promise<FileEntity | null>;
  findByChecksum(
    checksum: string,
    workspaceId: string
  ): Promise<FileEntity | null>;
  findMany(
    filters: FileFilters,
    limit?: number,
    offset?: number
  ): Promise<FileEntity[]>;
  count(filters: FileFilters): Promise<number>;
  delete(id: string): Promise<void>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;

  // Attachment operations
  saveAttachment(attachment: AttachmentEntity): Promise<AttachmentEntity>;
  findAttachmentById(id: string): Promise<AttachmentEntity | null>;
  findAttachments(filters: AttachmentFilters): Promise<AttachmentEntity[]>;
  deleteAttachment(id: string): Promise<void>;
  softDeleteAttachment(id: string): Promise<void>;
  restoreAttachment(id: string): Promise<void>;

  // Bulk operations
  findFilesByIds(ids: string[]): Promise<FileEntity[]>;
  findAttachmentsByFileIds(fileIds: string[]): Promise<AttachmentEntity[]>;
  findOrphanedFiles(workspaceId: string): Promise<FileEntity[]>;

  // Analytics and reporting
  getStorageUsageByWorkspace(workspaceId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    sizeByMimeType: Record<string, number>;
  }>;
  getStorageUsageByUser(
    userId: string,
    workspaceId: string
  ): Promise<{
    totalFiles: number;
    totalSize: number;
  }>;

  // Maintenance operations
  findFilesForCleanup(olderThan: Date): Promise<FileEntity[]>;
  findFilesWithoutThumbnails(): Promise<FileEntity[]>;
  findFilesWithPendingVirusScan(): Promise<FileEntity[]>;
}
