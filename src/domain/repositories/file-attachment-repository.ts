import {
  FileAttachment,
  FileType,
  FileStatus,
} from '../entities/file-attachment';

export interface IFileAttachmentRepository {
  save(file: FileAttachment): Promise<FileAttachment>;
  findById(id: string): Promise<FileAttachment | null>;
  findByFilename(filename: string): Promise<FileAttachment | null>;
  findByChecksum(checksum: string): Promise<FileAttachment[]>;
  findByUploadedBy(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<FileAttachment[]>;
  findByWorkspaceId(
    workspaceId: string,
    limit?: number,
    offset?: number
  ): Promise<FileAttachment[]>;
  findByProjectId(
    projectId: string,
    limit?: number,
    offset?: number
  ): Promise<FileAttachment[]>;
  findByTaskId(
    taskId: string,
    limit?: number,
    offset?: number
  ): Promise<FileAttachment[]>;
  findByCommentId(commentId: string): Promise<FileAttachment[]>;
  findByType(
    type: FileType,
    limit?: number,
    offset?: number
  ): Promise<FileAttachment[]>;
  findByStatus(
    status: FileStatus,
    limit?: number,
    offset?: number
  ): Promise<FileAttachment[]>;
  findByMimeType(
    mimeType: string,
    limit?: number,
    offset?: number
  ): Promise<FileAttachment[]>;
  findDeleted(limit?: number, offset?: number): Promise<FileAttachment[]>;
  findOrphaned(): Promise<FileAttachment[]>;
  findLargeFiles(minSizeMB: number): Promise<FileAttachment[]>;
  getStorageStats(
    workspaceId?: string,
    userId?: string
  ): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<FileType, { count: number; size: number }>;
    byStatus: Record<FileStatus, number>;
    averageSize: number;
  }>;
  searchFiles(query: {
    filename?: string;
    originalName?: string;
    mimeType?: string;
    type?: FileType;
    uploadedBy?: string;
    workspaceId?: string;
    projectId?: string;
    taskId?: string;
    minSize?: number;
    maxSize?: number;
    uploadedAfter?: Date;
    uploadedBefore?: Date;
    limit?: number;
    offset?: number;
  }): Promise<FileAttachment[]>;
  delete(id: string): Promise<void>;
  hardDelete(id: string): Promise<void>;
  deleteByUploadedBy(userId: string): Promise<void>;
  deleteByWorkspaceId(workspaceId: string): Promise<void>;
  deleteByProjectId(projectId: string): Promise<void>;
  deleteByTaskId(taskId: string): Promise<void>;
  deleteOlderThan(date: Date): Promise<number>;
  cleanupOrphaned(): Promise<number>;
}
