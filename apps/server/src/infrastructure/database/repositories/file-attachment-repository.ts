import {
  eq,
  and,
  gte,
  lte,
  desc,
  isNull,
  sql,
} from 'drizzle-orm';
import {
  FileAttachment,
  FileType,
  FileStatus,
} from '../../../domain/entities/file-attachment';
import { IFileAttachmentRepository } from '../../../domain/repositories/file-attachment-repository';
import { BaseDrizzleRepository } from './base-drizzle-repository';
import { fileAttachments } from '../schema/file-attachments';
import { logger } from '../../monitoring/logging-service';

interface FileAttachmentDrizzleModel {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: FileType;
  status: FileStatus;
  url: string | null;
  thumbnailUrl: string | null;
  checksum: string;
  uploadedBy: string;
  workspaceId: string | null;
  projectId: string | null;
  taskId: string | null;
  commentId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class FileAttachmentRepository
  extends BaseDrizzleRepository<
    FileAttachment,
    string,
    FileAttachmentDrizzleModel,
    typeof fileAttachments
  >
  implements IFileAttachmentRepository
{
  constructor() {
    super(fileAttachments, 'FileAttachment');
  }

  protected toDomain(drizzleModel: FileAttachmentDrizzleModel): FileAttachment {
    return new FileAttachment({
      id: drizzleModel.id,
      filename: drizzleModel.filename,
      originalName: drizzleModel.originalName,
      mimeType: drizzleModel.mimeType,
      size: drizzleModel.size,
      type: drizzleModel.type,
      status: drizzleModel.status,
      url: drizzleModel.url || undefined,
      thumbnailUrl: drizzleModel.thumbnailUrl || undefined,
      checksum: drizzleModel.checksum,
      uploadedBy: drizzleModel.uploadedBy,
      workspaceId: drizzleModel.workspaceId || undefined,
      projectId: drizzleModel.projectId || undefined,
      taskId: drizzleModel.taskId || undefined,
      commentId: drizzleModel.commentId || undefined,
      metadata: drizzleModel.metadata,
      createdAt: drizzleModel.createdAt,
      updatedAt: drizzleModel.updatedAt,
      deletedAt: drizzleModel.deletedAt || undefined,
    });
  }

  protected toDrizzle(
    entity: FileAttachment
  ): Partial<FileAttachmentDrizzleModel> {
    return {
      id: entity.id,
      filename: entity.filename,
      originalName: entity.originalName,
      mimeType: entity.mimeType,
      size: entity.size,
      type: entity.type,
      status: entity.status,
      url: entity.url || null,
      thumbnailUrl: entity.thumbnailUrl || null,
      checksum: entity.checksum,
      uploadedBy: entity.uploadedBy,
      workspaceId: entity.workspaceId || null,
      projectId: entity.projectId || null,
      taskId: entity.taskId || null,
      commentId: entity.commentId || null,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt || null,
    };
  }

  protected buildWhereClause(_specification: any): any {
    // Implementation for specifications if needed
    return undefined;
  }

  // Override save method to match interface
  override async save(entity: FileAttachment): Promise<FileAttachment> {
    return await super.save(entity);
  }

  async findByFilename(filename: string): Promise<FileAttachment | null> {
    try {
      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.filename, filename))
        .limit(1);

      if (results.length === 0) {
        return null;
      }

      return this.toDomain(results[0] as FileAttachmentDrizzleModel);
    } catch (error) {
      logger.error('Error finding file attachment by filename', error as Error, {
        filename,
      });
      throw error;
    }
  }

  async findByChecksum(checksum: string): Promise<FileAttachment[]> {
    try {
      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.checksum, checksum))
        .orderBy(desc(fileAttachments.createdAt));

      return results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );
    } catch (error) {
      logger.error('Error finding file attachments by checksum', error as Error, {
        checksum,
      });
      throw error;
    }
  }

  async findByUploadedBy(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<FileAttachment[]> {
    try {
      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(
          and(
            eq(fileAttachments.uploadedBy, userId),
            isNull(fileAttachments.deletedAt)
          )
        )
        .orderBy(desc(fileAttachments.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );
    } catch (error) {
      logger.error('Error finding file attachments by uploaded by', error as Error, {
        userId,
      });
      throw error;
    }
  }

  async findByWorkspaceId(
    workspaceId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<FileAttachment[]> {
    try {
      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(
          and(
            eq(fileAttachments.workspaceId, workspaceId),
            isNull(fileAttachments.deletedAt)
          )
        )
        .orderBy(desc(fileAttachments.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );
    } catch (error) {
      logger.error('Error finding file attachments by workspace ID', error as Error, {
        workspaceId,
      });
      throw error;
    }
  }

  async findByProjectId(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<FileAttachment[]> {
    try {
      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(
          and(
            eq(fileAttachments.projectId, projectId),
            isNull(fileAttachments.deletedAt)
          )
        )
        .orderBy(desc(fileAttachments.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );
    } catch (error) {
      logger.error('Error finding file attachments by project ID', error as Error, {
        projectId,
      });
      throw error;
    }
  }

  async findByTaskId(
    taskId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<FileAttachment[]> {
    try {
      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(
          and(
            eq(fileAttachments.taskId, taskId),
            isNull(fileAttachments.deletedAt)
          )
        )
        .orderBy(desc(fileAttachments.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );
    } catch (error) {
      logger.error('Error finding file attachments by task ID', error as Error, {
        taskId,
      });
      throw error;
    }
  }

  async findByCommentId(commentId: string): Promise<FileAttachment[]> {
    try {
      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(
          and(
            eq(fileAttachments.commentId, commentId),
            isNull(fileAttachments.deletedAt)
          )
        )
        .orderBy(desc(fileAttachments.createdAt));

      return results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );
    } catch (error) {
      logger.error('Error finding file attachments by comment ID', error as Error, {
        commentId,
      });
      throw error;
    }
  }

  async findByType(
    type: FileType,
    limit: number = 50,
    offset: number = 0
  ): Promise<FileAttachment[]> {
    try {
      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(
          and(eq(fileAttachments.type, type), isNull(fileAttachments.deletedAt))
        )
        .orderBy(desc(fileAttachments.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );
    } catch (error) {
      logger.error('Error finding file attachments by type', error as Error, { type });
      throw error;
    }
  }

  async findByStatus(
    status: FileStatus,
    limit: number = 50,
    offset: number = 0
  ): Promise<FileAttachment[]> {
    try {
      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.status, status))
        .orderBy(desc(fileAttachments.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );
    } catch (error) {
      logger.error('Error finding file attachments by status', error as Error, {
        status,
      });
      throw error;
    }
  }

  async findByMimeType(
    mimeType: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<FileAttachment[]> {
    try {
      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(
          and(
            eq(fileAttachments.mimeType, mimeType),
            isNull(fileAttachments.deletedAt)
          )
        )
        .orderBy(desc(fileAttachments.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );
    } catch (error) {
      logger.error('Error finding file attachments by MIME type', error as Error, {
        mimeType,
      });
      throw error;
    }
  }

  async findDeleted(
    limit: number = 50,
    offset: number = 0
  ): Promise<FileAttachment[]> {
    try {
      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(sql`${fileAttachments.deletedAt} IS NOT NULL`)
        .orderBy(desc(fileAttachments.deletedAt))
        .limit(limit)
        .offset(offset);

      return results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );
    } catch (error) {
      logger.error('Error finding deleted file attachments', error as Error);
      throw error;
    }
  }

  async findOrphaned(): Promise<FileAttachment[]> {
    try {
      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(
          and(
            isNull(fileAttachments.workspaceId),
            isNull(fileAttachments.projectId),
            isNull(fileAttachments.taskId),
            isNull(fileAttachments.commentId),
            isNull(fileAttachments.deletedAt)
          )
        )
        .orderBy(desc(fileAttachments.createdAt));

      return results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );
    } catch (error) {
      logger.error('Error finding orphaned file attachments', error as Error);
      throw error;
    }
  }

  async findLargeFiles(minSizeMB: number): Promise<FileAttachment[]> {
    try {
      const minSizeBytes = minSizeMB * 1024 * 1024;
      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(
          and(
            gte(fileAttachments.size, minSizeBytes),
            isNull(fileAttachments.deletedAt)
          )
        )
        .orderBy(desc(fileAttachments.size));

      return results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );
    } catch (error) {
      logger.error('Error finding large file attachments', error as Error, {
        minSizeMB,
      });
      throw error;
    }
  }

  async getStorageStats(
    workspaceId?: string,
    userId?: string
  ): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<FileType, { count: number; size: number }>;
    byStatus: Record<FileStatus, number>;
    averageSize: number;
  }> {
    try {
      const conditions = [isNull(fileAttachments.deletedAt)];

      if (workspaceId) {
        conditions.push(eq(fileAttachments.workspaceId, workspaceId));
      }
      if (userId) {
        conditions.push(eq(fileAttachments.uploadedBy, userId));
      }

      const whereClause = and(...conditions);

      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(whereClause);

      const files = results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );

      const stats = {
        totalFiles: files.length,
        totalSize: 0,
        byType: {} as Record<FileType, { count: number; size: number }>,
        byStatus: {} as Record<FileStatus, number>,
        averageSize: 0,
      };

      // Initialize type and status counts
      Object.values(FileType).forEach(type => {
        stats.byType[type] = { count: 0, size: 0 };
      });
      Object.values(FileStatus).forEach(status => {
        stats.byStatus[status] = 0;
      });

      // Calculate statistics
      files.forEach(file => {
        stats.totalSize += file.size;
        stats.byType[file.type].count++;
        stats.byType[file.type].size += file.size;
        stats.byStatus[file.status]++;
      });

      stats.averageSize = files.length > 0 ? stats.totalSize / files.length : 0;

      return stats;
    } catch (error) {
      logger.error('Error getting file attachment storage stats', error as Error, {
        ...(workspaceId && { workspaceId }),
        ...(userId && { userId }),
      });
      throw error;
    }
  }

  async searchFiles(query: {
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
  }): Promise<FileAttachment[]> {
    try {
      const conditions = [isNull(fileAttachments.deletedAt)];

      if (query.filename) {
        conditions.push(
          sql`${fileAttachments.filename} ILIKE '%${query.filename}%'`
        );
      }
      if (query.originalName) {
        conditions.push(
          sql`${fileAttachments.originalName} ILIKE '%${query.originalName}%'`
        );
      }
      if (query.mimeType) {
        conditions.push(eq(fileAttachments.mimeType, query.mimeType));
      }
      if (query.type) {
        conditions.push(eq(fileAttachments.type, query.type));
      }
      if (query.uploadedBy) {
        conditions.push(eq(fileAttachments.uploadedBy, query.uploadedBy));
      }
      if (query.workspaceId) {
        conditions.push(eq(fileAttachments.workspaceId, query.workspaceId));
      }
      if (query.projectId) {
        conditions.push(eq(fileAttachments.projectId, query.projectId));
      }
      if (query.taskId) {
        conditions.push(eq(fileAttachments.taskId, query.taskId));
      }
      if (query.minSize) {
        conditions.push(gte(fileAttachments.size, query.minSize));
      }
      if (query.maxSize) {
        conditions.push(lte(fileAttachments.size, query.maxSize));
      }
      if (query.uploadedAfter) {
        conditions.push(gte(fileAttachments.createdAt, query.uploadedAfter));
      }
      if (query.uploadedBefore) {
        conditions.push(lte(fileAttachments.createdAt, query.uploadedBefore));
      }

      const whereClause = and(...conditions);

      const results = await this.database
        .select()
        .from(fileAttachments)
        .where(whereClause)
        .orderBy(desc(fileAttachments.createdAt))
        .limit(query.limit || 50)
        .offset(query.offset || 0);

      return results.map(result =>
        this.toDomain(result as FileAttachmentDrizzleModel)
      );
    } catch (error) {
      logger.error('Error searching file attachments', error as Error, { query });
      throw error;
    }
  }

  async hardDelete(id: string): Promise<void> {
    try {
      await this.database
        .delete(fileAttachments)
        .where(eq(fileAttachments.id, id));
    } catch (error) {
      logger.error('Error hard deleting file attachment', error as Error, { id });
      throw error;
    }
  }

  async deleteByUploadedBy(userId: string): Promise<void> {
    try {
      await this.database
        .update(fileAttachments)
        .set({
          status: FileStatus.DELETED,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(fileAttachments.uploadedBy, userId));
    } catch (error) {
      logger.error('Error deleting file attachments by uploaded by', error as Error, {
        userId,
      });
      throw error;
    }
  }

  async deleteByWorkspaceId(workspaceId: string): Promise<void> {
    try {
      await this.database
        .update(fileAttachments)
        .set({
          status: FileStatus.DELETED,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(fileAttachments.workspaceId, workspaceId));
    } catch (error) {
      logger.error('Error deleting file attachments by workspace ID', error as Error, {
        workspaceId,
      });
      throw error;
    }
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    try {
      await this.database
        .update(fileAttachments)
        .set({
          status: FileStatus.DELETED,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(fileAttachments.projectId, projectId));
    } catch (error) {
      logger.error('Error deleting file attachments by project ID', error as Error, {
        projectId,
      });
      throw error;
    }
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    try {
      await this.database
        .update(fileAttachments)
        .set({
          status: FileStatus.DELETED,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(fileAttachments.taskId, taskId));
    } catch (error) {
      logger.error('Error deleting file attachments by task ID', error as Error, {
        taskId,
      });
      throw error;
    }
  }

  async deleteOlderThan(date: Date): Promise<number> {
    try {
      const results = await this.database
        .update(fileAttachments)
        .set({
          status: FileStatus.DELETED,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            lte(fileAttachments.createdAt, date),
            isNull(fileAttachments.deletedAt)
          )
        )
        .returning({ id: fileAttachments.id });

      return results.length;
    } catch (error) {
      logger.error('Error deleting file attachments older than date', error as Error, {
        date,
      });
      throw error;
    }
  }

  async cleanupOrphaned(): Promise<number> {
    try {
      const results = await this.database
        .update(fileAttachments)
        .set({
          status: FileStatus.DELETED,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            isNull(fileAttachments.workspaceId),
            isNull(fileAttachments.projectId),
            isNull(fileAttachments.taskId),
            isNull(fileAttachments.commentId),
            isNull(fileAttachments.deletedAt)
          )
        )
        .returning({ id: fileAttachments.id });

      return results.length;
    } catch (error) {
      logger.error('Error cleaning up orphaned file attachments', error as Error);
      throw error;
    }
  }
}
