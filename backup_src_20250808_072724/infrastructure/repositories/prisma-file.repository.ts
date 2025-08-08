import { PrismaClient } from '@prisma/client';
import { FileEntity } from '../../domain/file-management/entities/file.entity';
import { AttachmentEntity } from '../../domain/file-management/entities/attachment.entity';
import {
  FileRepository,
  FileFilters,
  AttachmentFilters,
} from '../../domain/file-management/repositories/file.repository';
import { FileMetadata } from '../../domain/file-management/value-objects/file-metadata.vo';
import { FileAccessControl } from '../../domain/file-management/value-objects/file-access-control.vo';
import { FileVersion } from '../../domain/file-management/value-objects/file-version.vo';
import { logger } from '../../utils/logger';

export class PrismaFileRepository implements FileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(file: FileEntity): Promise<FileEntity> {
    try {
      const data = {
        id: file.id,
        workspaceId: file.workspaceId,
        uploadedBy: file.uploadedBy,
        originalName: file.originalName,
        storagePath: file.storagePath,
        mimeType: file.mimeType,
        size: file.size,
        checksum: file.metadata.checksum,
        metadata: file.metadata.toPlainObject(),
        isPublic: file.accessControl.isPublic,
        workspaceLevel: file.accessControl.workspaceLevel,
        projectLevel: file.accessControl.projectLevel,
        currentVersion:
          file.versions.length > 0
            ? Math.max(...file.versions.map(v => v.version))
            : 1,
        virusScanStatus: file.metadata.virusScanStatus,
        virusScanDate: file.metadata.virusScanDate,
        thumbnailGenerated: file.metadata.thumbnailGenerated,
        previewGenerated: file.metadata.previewGenerated,
        isCompressed: file.metadata.isCompressed,
        compressionRatio: file.metadata.compressionRatio,
        isDeleted: file.isDeleted,
        deletedAt: file.deletedAt,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      };

      const savedFile = await this.prisma.file.upsert({
        where: { id: file.id },
        update: data,
        create: data,
        include: {
          versions: true,
          permissions: true,
        },
      });

      // Save versions if any
      for (const version of file.versions) {
        await this.prisma.fileVersion.upsert({
          where: {
            fileId_version: {
              fileId: file.id,
              version: version.version,
            },
          },
          update: {
            storagePath: version.storagePath,
            size: version.size,
            checksum: version.checksum,
            uploadedBy: version.uploadedBy,
            changeDescription: version.changeDescription,
            metadata: version.metadata,
          },
          create: {
            fileId: file.id,
            version: version.version,
            storagePath: version.storagePath,
            size: version.size,
            checksum: version.checksum,
            uploadedBy: version.uploadedBy,
            changeDescription: version.changeDescription,
            metadata: version.metadata,
            createdAt: version.uploadedAt,
          },
        });
      }

      // Save permissions
      const specificUsers = file.accessControl.specificUsers;
      for (const userPermission of specificUsers) {
        await this.prisma.filePermission.upsert({
          where: {
            fileId_userId: {
              fileId: file.id,
              userId: userPermission.userId,
            },
          },
          update: {
            permissions: userPermission.permissions,
            inheritFromParent: file.accessControl.inheritFromParent,
            parentType: file.accessControl.parentType,
            parentId: file.accessControl.parentId,
          },
          create: {
            fileId: file.id,
            userId: userPermission.userId,
            permissions: userPermission.permissions,
            inheritFromParent: file.accessControl.inheritFromParent,
            parentType: file.accessControl.parentType,
            parentId: file.accessControl.parentId,
          },
        });
      }

      return this.mapToEntity(savedFile);
    } catch (error) {
      logger.error('Failed to save file', {
        fileId: file.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findById(id: string): Promise<FileEntity | null> {
    try {
      const file = await this.prisma.file.findUnique({
        where: { id },
        include: {
          versions: true,
          permissions: true,
        },
      });

      return file ? this.mapToEntity(file) : null;
    } catch (error) {
      logger.error('Failed to find file by ID', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findByChecksum(
    checksum: string,
    workspaceId: string
  ): Promise<FileEntity | null> {
    try {
      const file = await this.prisma.file.findFirst({
        where: {
          checksum,
          workspaceId,
          isDeleted: false,
        },
        include: {
          versions: true,
          permissions: true,
        },
      });

      return file ? this.mapToEntity(file) : null;
    } catch (error) {
      logger.error('Failed to find file by checksum', {
        checksum,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findMany(
    filters: FileFilters,
    limit?: number,
    offset?: number
  ): Promise<FileEntity[]> {
    try {
      const where = this.buildWhereClause(filters);

      const files = await this.prisma.file.findMany({
        where,
        include: {
          versions: true,
          permissions: true,
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });

      return files.map(file => this.mapToEntity(file));
    } catch (error) {
      logger.error('Failed to find files', {
        filters,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async count(filters: FileFilters): Promise<number> {
    try {
      const where = this.buildWhereClause(filters);
      return await this.prisma.file.count({ where });
    } catch (error) {
      logger.error('Failed to count files', {
        filters,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.file.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to delete file', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.file.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to soft delete file', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async restore(id: string): Promise<void> {
    try {
      await this.prisma.file.update({
        where: { id },
        data: {
          isDeleted: false,
          deletedAt: null,
        },
      });
    } catch (error) {
      logger.error('Failed to restore file', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async saveAttachment(
    attachment: AttachmentEntity
  ): Promise<AttachmentEntity> {
    try {
      const data = {
        id: attachment.id,
        fileId: attachment.fileId,
        workspaceId: attachment.workspaceId,
        attachedTo: attachment.attachedTo,
        attachedToId: attachment.attachedToId,
        attachedBy: attachment.attachedBy,
        description: attachment.description,
        position: attachment.position,
        isDeleted: attachment.isDeleted,
        deletedAt: attachment.deletedAt,
        createdAt: attachment.createdAt,
        updatedAt: attachment.updatedAt,
      };

      const savedAttachment = await this.prisma.attachment.upsert({
        where: { id: attachment.id },
        update: data,
        create: data,
      });

      return this.mapToAttachmentEntity(savedAttachment);
    } catch (error) {
      logger.error('Failed to save attachment', {
        attachmentId: attachment.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findAttachmentById(id: string): Promise<AttachmentEntity | null> {
    try {
      const attachment = await this.prisma.attachment.findUnique({
        where: { id },
      });

      return attachment ? this.mapToAttachmentEntity(attachment) : null;
    } catch (error) {
      logger.error('Failed to find attachment by ID', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findAttachments(
    filters: AttachmentFilters
  ): Promise<AttachmentEntity[]> {
    try {
      const where = this.buildAttachmentWhereClause(filters);

      const attachments = await this.prisma.attachment.findMany({
        where,
        orderBy: { position: 'asc' },
      });

      return attachments.map(attachment =>
        this.mapToAttachmentEntity(attachment)
      );
    } catch (error) {
      logger.error('Failed to find attachments', {
        filters,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async deleteAttachment(id: string): Promise<void> {
    try {
      await this.prisma.attachment.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to delete attachment', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async softDeleteAttachment(id: string): Promise<void> {
    try {
      await this.prisma.attachment.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to soft delete attachment', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async restoreAttachment(id: string): Promise<void> {
    try {
      await this.prisma.attachment.update({
        where: { id },
        data: {
          isDeleted: false,
          deletedAt: null,
        },
      });
    } catch (error) {
      logger.error('Failed to restore attachment', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findFilesByIds(ids: string[]): Promise<FileEntity[]> {
    try {
      const files = await this.prisma.file.findMany({
        where: {
          id: { in: ids },
        },
        include: {
          versions: true,
          permissions: true,
        },
      });

      return files.map(file => this.mapToEntity(file));
    } catch (error) {
      logger.error('Failed to find files by IDs', {
        ids,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findAttachmentsByFileIds(
    fileIds: string[]
  ): Promise<AttachmentEntity[]> {
    try {
      const attachments = await this.prisma.attachment.findMany({
        where: {
          fileId: { in: fileIds },
          isDeleted: false,
        },
        orderBy: { position: 'asc' },
      });

      return attachments.map(attachment =>
        this.mapToAttachmentEntity(attachment)
      );
    } catch (error) {
      logger.error('Failed to find attachments by file IDs', {
        fileIds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findOrphanedFiles(workspaceId: string): Promise<FileEntity[]> {
    try {
      // Find files that have no attachments and are older than 24 hours
      const files = await this.prisma.file.findMany({
        where: {
          workspaceId,
          isDeleted: false,
          createdAt: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
          },
          attachments: {
            none: {},
          },
        },
        include: {
          versions: true,
          permissions: true,
        },
      });

      return files.map(file => this.mapToEntity(file));
    } catch (error) {
      logger.error('Failed to find orphaned files', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getStorageUsageByWorkspace(workspaceId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    sizeByMimeType: Record<string, number>;
  }> {
    try {
      const result = await this.prisma.file.groupBy({
        by: ['mimeType'],
        where: {
          workspaceId,
          isDeleted: false,
        },
        _count: {
          id: true,
        },
        _sum: {
          size: true,
        },
      });

      const totalFiles = result.reduce(
        (sum, group) => sum + group._count.id,
        0
      );
      const totalSize = result.reduce(
        (sum, group) => sum + (Number(group._sum.size) || 0),
        0
      );
      const sizeByMimeType: Record<string, number> = {};

      result.forEach(group => {
        sizeByMimeType[group.mimeType] = Number(group._sum.size) || 0;
      });

      return {
        totalFiles,
        totalSize,
        sizeByMimeType,
      };
    } catch (error) {
      logger.error('Failed to get storage usage by workspace', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getStorageUsageByUser(
    userId: string,
    workspaceId: string
  ): Promise<{
    totalFiles: number;
    totalSize: number;
  }> {
    try {
      const result = await this.prisma.file.aggregate({
        where: {
          workspaceId,
          uploadedBy: userId,
          isDeleted: false,
        },
        _count: {
          id: true,
        },
        _sum: {
          size: true,
        },
      });

      return {
        totalFiles: result._count.id || 0,
        totalSize: Number(result._sum.size) || 0,
      };
    } catch (error) {
      logger.error('Failed to get storage usage by user', {
        userId,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findFilesForCleanup(olderThan: Date): Promise<FileEntity[]> {
    try {
      const files = await this.prisma.file.findMany({
        where: {
          OR: [
            {
              isDeleted: true,
              deletedAt: {
                lt: olderThan,
              },
            },
            {
              createdAt: {
                lt: olderThan,
              },
              attachments: {
                none: {},
              },
            },
          ],
        },
        include: {
          versions: true,
          permissions: true,
        },
      });

      return files.map(file => this.mapToEntity(file));
    } catch (error) {
      logger.error('Failed to find files for cleanup', {
        olderThan,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findFilesWithoutThumbnails(): Promise<FileEntity[]> {
    try {
      const files = await this.prisma.file.findMany({
        where: {
          mimeType: {
            startsWith: 'image/',
          },
          thumbnailGenerated: false,
          isDeleted: false,
        },
        include: {
          versions: true,
          permissions: true,
        },
      });

      return files.map(file => this.mapToEntity(file));
    } catch (error) {
      logger.error('Failed to find files without thumbnails', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findFilesWithPendingVirusScan(): Promise<FileEntity[]> {
    try {
      const files = await this.prisma.file.findMany({
        where: {
          virusScanStatus: 'pending',
          isDeleted: false,
        },
        include: {
          versions: true,
          permissions: true,
        },
      });

      return files.map(file => this.mapToEntity(file));
    } catch (error) {
      logger.error('Failed to find files with pending virus scan', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private buildWhereClause(filters: FileFilters): any {
    const where: any = {};

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.uploadedBy) {
      where.uploadedBy = filters.uploadedBy;
    }

    if (filters.mimeType) {
      where.mimeType = filters.mimeType;
    }

    if (filters.mimeTypePrefix) {
      where.mimeType = {
        startsWith: filters.mimeTypePrefix,
      };
    }

    if (filters.minSize || filters.maxSize) {
      where.size = {};
      if (filters.minSize) {
        where.size.gte = filters.minSize;
      }
      if (filters.maxSize) {
        where.size.lte = filters.maxSize;
      }
    }

    if (filters.virusScanStatus) {
      where.virusScanStatus = filters.virusScanStatus;
    }

    if (filters.isDeleted !== undefined) {
      where.isDeleted = filters.isDeleted;
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) {
        where.createdAt.gte = filters.createdAfter;
      }
      if (filters.createdBefore) {
        where.createdAt.lte = filters.createdBefore;
      }
    }

    if (filters.search) {
      where.OR = [
        {
          originalName: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          searchIndex: {
            content: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    return where;
  }

  private buildAttachmentWhereClause(filters: AttachmentFilters): any {
    const where: any = {};

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.attachedTo) {
      where.attachedTo = filters.attachedTo;
    }

    if (filters.attachedToId) {
      where.attachedToId = filters.attachedToId;
    }

    if (filters.attachedBy) {
      where.attachedBy = filters.attachedBy;
    }

    if (filters.isDeleted !== undefined) {
      where.isDeleted = filters.isDeleted;
    }

    return where;
  }

  private mapToEntity(file: any): FileEntity {
    const metadata = new FileMetadata({
      checksum: file.checksum,
      encoding: file.metadata.encoding,
      width: file.metadata.width,
      height: file.metadata.height,
      duration: file.metadata.duration,
      pages: file.metadata.pages,
      tags: file.metadata.tags || [],
      customProperties: file.metadata.customProperties || {},
      virusScanStatus: file.virusScanStatus,
      virusScanDate: file.virusScanDate,
      compressionRatio: file.compressionRatio,
      isCompressed: file.isCompressed,
      thumbnailGenerated: file.thumbnailGenerated,
      previewGenerated: file.previewGenerated,
      ocrText: file.metadata.ocrText,
      exifData: file.metadata.exifData,
    });

    const specificUsers =
      file.permissions?.map((p: any) => ({
        userId: p.userId,
        permissions: p.permissions,
      })) || [];

    const accessControl = new FileAccessControl({
      isPublic: file.isPublic,
      workspaceLevel: file.workspaceLevel,
      projectLevel: file.projectLevel,
      specificUsers,
      inheritFromParent: file.permissions?.[0]?.inheritFromParent || false,
      parentType: file.permissions?.[0]?.parentType,
      parentId: file.permissions?.[0]?.parentId,
    });

    const versions =
      file.versions?.map(
        (v: any) =>
          new FileVersion({
            version: v.version,
            storagePath: v.storagePath,
            size: Number(v.size),
            checksum: v.checksum,
            uploadedBy: v.uploadedBy,
            uploadedAt: v.createdAt,
            changeDescription: v.changeDescription,
            metadata: v.metadata || {},
          })
      ) || [];

    return new FileEntity({
      id: file.id,
      workspaceId: file.workspaceId,
      uploadedBy: file.uploadedBy,
      originalName: file.originalName,
      storagePath: file.storagePath,
      mimeType: file.mimeType,
      size: Number(file.size),
      metadata,
      accessControl,
      versions,
      isDeleted: file.isDeleted,
      deletedAt: file.deletedAt,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    });
  }

  private mapToAttachmentEntity(attachment: any): AttachmentEntity {
    return new AttachmentEntity({
      id: attachment.id,
      fileId: attachment.fileId,
      workspaceId: attachment.workspaceId,
      attachedTo: attachment.attachedTo,
      attachedToId: attachment.attachedToId,
      attachedBy: attachment.attachedBy,
      description: attachment.description,
      position: attachment.position,
      isDeleted: attachment.isDeleted,
      deletedAt: attachment.deletedAt,
      createdAt: attachment.createdAt,
      updatedAt: attachment.updatedAt,
    });
  }
}
