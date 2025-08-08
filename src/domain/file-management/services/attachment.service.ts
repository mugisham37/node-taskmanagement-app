import { AttachmentEntity } from '../../domain/file-management/entities/attachment.entity';
import { FileEntity } from '../../domain/file-management/entities/file.entity';
import { FileRepository } from '../../domain/file-management/repositories/file.repository';
import { FileManagementService } from './file-management.service';
import { logger } from '../../utils/logger';
import * as crypto from 'crypto';

export interface AttachmentCreateRequest {
  fileId: string;
  workspaceId: string;
  attachedTo: 'task' | 'comment' | 'project';
  attachedToId: string;
  attachedBy: string;
  description?: string;
  position?: number;
}

export interface AttachmentUpdateRequest {
  description?: string;
  position?: number;
}

export interface AttachmentSearchRequest {
  workspaceId?: string;
  attachedTo?: string;
  attachedToId?: string;
  attachedBy?: string;
  fileType?: string;
  dateRange?: { from: Date; to: Date };
  limit?: number;
  offset?: number;
}

export interface AttachmentShareRequest {
  attachmentId: string;
  userId: string;
  shareWith: Array<{
    userId?: string;
    email?: string;
    permissions: ('read' | 'write' | 'delete')[];
    expiresAt?: Date;
  }>;
  message?: string;
}

export class AttachmentService {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly fileManagementService: FileManagementService
  ) {}

  async createAttachment(
    request: AttachmentCreateRequest
  ): Promise<AttachmentEntity> {
    try {
      // Verify file exists and user has access
      const file = await this.fileRepository.findById(request.fileId);
      if (!file) {
        throw new Error('File not found');
      }

      if (file.workspaceId !== request.workspaceId) {
        throw new Error('File does not belong to the specified workspace');
      }

      // Check if user has permission to attach files to the target entity
      await this.validateAttachmentPermission(
        request.attachedBy,
        request.attachedTo,
        request.attachedToId,
        'create'
      );

      // Get next position if not specified
      let position = request.position;
      if (position === undefined) {
        const existingAttachments = await this.fileRepository.findAttachments({
          attachedTo: request.attachedTo,
          attachedToId: request.attachedToId,
          isDeleted: false,
        });
        position = existingAttachments.length;
      }

      // Create attachment entity
      const attachment = new AttachmentEntity({
        id: crypto.randomUUID(),
        fileId: request.fileId,
        workspaceId: request.workspaceId,
        attachedTo: request.attachedTo,
        attachedToId: request.attachedToId,
        attachedBy: request.attachedBy,
        description: request.description,
        position,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Save attachment
      const savedAttachment =
        await this.fileRepository.saveAttachment(attachment);

      logger.info('Attachment created successfully', {
        attachmentId: savedAttachment.id,
        fileId: request.fileId,
        attachedTo: request.attachedTo,
        attachedToId: request.attachedToId,
        attachedBy: request.attachedBy,
      });

      return savedAttachment;
    } catch (error) {
      logger.error('Failed to create attachment', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async updateAttachment(
    attachmentId: string,
    userId: string,
    request: AttachmentUpdateRequest
  ): Promise<AttachmentEntity> {
    try {
      // Get attachment
      const attachment =
        await this.fileRepository.findAttachmentById(attachmentId);
      if (!attachment) {
        throw new Error('Attachment not found');
      }

      // Check permissions
      await this.validateAttachmentPermission(
        userId,
        attachment.attachedTo,
        attachment.attachedToId,
        'update'
      );

      // Update attachment
      if (request.description !== undefined) {
        attachment.updateDescription(request.description);
      }

      if (request.position !== undefined) {
        attachment.updatePosition(request.position);
      }

      // Save updated attachment
      const updatedAttachment =
        await this.fileRepository.saveAttachment(attachment);

      logger.info('Attachment updated successfully', {
        attachmentId,
        userId,
        changes: request,
      });

      return updatedAttachment;
    } catch (error) {
      logger.error('Failed to update attachment', {
        attachmentId,
        userId,
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async deleteAttachment(
    attachmentId: string,
    userId: string,
    permanent: boolean = false
  ): Promise<void> {
    try {
      // Get attachment
      const attachment =
        await this.fileRepository.findAttachmentById(attachmentId);
      if (!attachment) {
        throw new Error('Attachment not found');
      }

      // Check permissions
      await this.validateAttachmentPermission(
        userId,
        attachment.attachedTo,
        attachment.attachedToId,
        'delete'
      );

      if (permanent) {
        // Permanently delete attachment
        await this.fileRepository.deleteAttachment(attachmentId);
      } else {
        // Soft delete attachment
        await this.fileRepository.softDeleteAttachment(attachmentId);
      }

      logger.info('Attachment deleted successfully', {
        attachmentId,
        userId,
        permanent,
      });
    } catch (error) {
      logger.error('Failed to delete attachment', {
        attachmentId,
        userId,
        permanent,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async restoreAttachment(attachmentId: string, userId: string): Promise<void> {
    try {
      // Get attachment
      const attachment =
        await this.fileRepository.findAttachmentById(attachmentId);
      if (!attachment) {
        throw new Error('Attachment not found');
      }

      // Check permissions
      await this.validateAttachmentPermission(
        userId,
        attachment.attachedTo,
        attachment.attachedToId,
        'update'
      );

      // Restore attachment
      await this.fileRepository.restoreAttachment(attachmentId);

      logger.info('Attachment restored successfully', {
        attachmentId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to restore attachment', {
        attachmentId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getAttachmentsByEntity(
    entityType: string,
    entityId: string,
    userId: string
  ): Promise<Array<{ attachment: AttachmentEntity; file: FileEntity }>> {
    try {
      // Check permissions
      await this.validateAttachmentPermission(
        userId,
        entityType,
        entityId,
        'read'
      );

      // Get attachments
      const attachments = await this.fileRepository.findAttachments({
        attachedTo: entityType,
        attachedToId: entityId,
        isDeleted: false,
      });

      // Get associated files
      const fileIds = attachments.map(a => a.fileId);
      const files = await this.fileRepository.findFilesByIds(fileIds);

      // Combine attachments with files
      const result = attachments
        .map(attachment => {
          const file = files.find(f => f.id === attachment.fileId);
          return file ? { attachment, file } : null;
        })
        .filter(Boolean) as Array<{
        attachment: AttachmentEntity;
        file: FileEntity;
      }>;

      // Sort by position
      result.sort((a, b) => a.attachment.position - b.attachment.position);

      return result;
    } catch (error) {
      logger.error('Failed to get attachments by entity', {
        entityType,
        entityId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async searchAttachments(
    request: AttachmentSearchRequest,
    userId: string
  ): Promise<{
    attachments: Array<{ attachment: AttachmentEntity; file: FileEntity }>;
    total: number;
  }> {
    try {
      // Get attachments based on search criteria
      const attachments = await this.fileRepository.findAttachments({
        workspaceId: request.workspaceId,
        attachedTo: request.attachedTo,
        attachedToId: request.attachedToId,
        attachedBy: request.attachedBy,
        isDeleted: false,
      });

      // Filter attachments based on user permissions
      const accessibleAttachments = [];
      for (const attachment of attachments) {
        try {
          await this.validateAttachmentPermission(
            userId,
            attachment.attachedTo,
            attachment.attachedToId,
            'read'
          );
          accessibleAttachments.push(attachment);
        } catch {
          // User doesn't have access to this attachment
        }
      }

      // Get associated files
      const fileIds = accessibleAttachments.map(a => a.fileId);
      const files = await this.fileRepository.findFilesByIds(fileIds);

      // Apply file-based filters
      let filteredResults = accessibleAttachments
        .map(attachment => {
          const file = files.find(f => f.id === attachment.fileId);
          return file ? { attachment, file } : null;
        })
        .filter(Boolean) as Array<{
        attachment: AttachmentEntity;
        file: FileEntity;
      }>;

      // Apply file type filter
      if (request.fileType) {
        filteredResults = filteredResults.filter(result =>
          result.file.mimeType.startsWith(request.fileType!)
        );
      }

      // Apply date range filter
      if (request.dateRange) {
        filteredResults = filteredResults.filter(result => {
          const createdAt = result.attachment.createdAt;
          return (
            createdAt >= request.dateRange!.from &&
            createdAt <= request.dateRange!.to
          );
        });
      }

      const total = filteredResults.length;

      // Apply pagination
      const limit = request.limit || 20;
      const offset = request.offset || 0;
      const paginatedResults = filteredResults.slice(offset, offset + limit);

      return {
        attachments: paginatedResults,
        total,
      };
    } catch (error) {
      logger.error('Failed to search attachments', {
        request,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async reorderAttachments(
    entityType: string,
    entityId: string,
    userId: string,
    attachmentIds: string[]
  ): Promise<void> {
    try {
      // Check permissions
      await this.validateAttachmentPermission(
        userId,
        entityType,
        entityId,
        'update'
      );

      // Get existing attachments
      const attachments = await this.fileRepository.findAttachments({
        attachedTo: entityType,
        attachedToId: entityId,
        isDeleted: false,
      });

      // Update positions
      for (let i = 0; i < attachmentIds.length; i++) {
        const attachment = attachments.find(a => a.id === attachmentIds[i]);
        if (attachment) {
          attachment.updatePosition(i);
          await this.fileRepository.saveAttachment(attachment);
        }
      }

      logger.info('Attachments reordered successfully', {
        entityType,
        entityId,
        userId,
        newOrder: attachmentIds,
      });
    } catch (error) {
      logger.error('Failed to reorder attachments', {
        entityType,
        entityId,
        userId,
        attachmentIds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async shareAttachment(request: AttachmentShareRequest): Promise<void> {
    try {
      // Get attachment
      const attachment = await this.fileRepository.findAttachmentById(
        request.attachmentId
      );
      if (!attachment) {
        throw new Error('Attachment not found');
      }

      // Check permissions
      await this.validateAttachmentPermission(
        request.userId,
        attachment.attachedTo,
        attachment.attachedToId,
        'share'
      );

      // Get associated file
      const file = await this.fileRepository.findById(attachment.fileId);
      if (!file) {
        throw new Error('Associated file not found');
      }

      // Update file access control to include shared users
      const currentAccessControl = file.accessControl;
      const newSpecificUsers = [...currentAccessControl.specificUsers];

      for (const shareTarget of request.shareWith) {
        if (shareTarget.userId) {
          // Add or update user permissions
          const existingUserIndex = newSpecificUsers.findIndex(
            u => u.userId === shareTarget.userId
          );

          if (existingUserIndex >= 0) {
            // Update existing permissions
            newSpecificUsers[existingUserIndex].permissions = [
              ...new Set([
                ...newSpecificUsers[existingUserIndex].permissions,
                ...shareTarget.permissions,
              ]),
            ];
          } else {
            // Add new user
            newSpecificUsers.push({
              userId: shareTarget.userId,
              permissions: shareTarget.permissions,
            });
          }
        }
      }

      // Update file access control
      const updatedAccessControl = file.accessControl;
      updatedAccessControl.specificUsers = newSpecificUsers;
      file.updateAccessControl(updatedAccessControl);

      // Save updated file
      await this.fileRepository.save(file);

      // TODO: Send notification to shared users
      // This would integrate with the notification service

      logger.info('Attachment shared successfully', {
        attachmentId: request.attachmentId,
        userId: request.userId,
        sharedWith: request.shareWith.length,
      });
    } catch (error) {
      logger.error('Failed to share attachment', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async generateAttachmentPreview(
    attachmentId: string,
    userId: string,
    options?: {
      width?: number;
      height?: number;
      quality?: number;
    }
  ): Promise<{
    previewUrl: string;
    thumbnailUrl?: string;
    metadata: Record<string, any>;
  }> {
    try {
      // Get attachment
      const attachment =
        await this.fileRepository.findAttachmentById(attachmentId);
      if (!attachment) {
        throw new Error('Attachment not found');
      }

      // Check permissions
      await this.validateAttachmentPermission(
        userId,
        attachment.attachedTo,
        attachment.attachedToId,
        'read'
      );

      // Get associated file
      const file = await this.fileRepository.findById(attachment.fileId);
      if (!file) {
        throw new Error('Associated file not found');
      }

      // Generate preview based on file type
      let previewUrl = '';
      let thumbnailUrl = '';
      const metadata: Record<string, any> = {
        fileType: file.mimeType,
        size: file.size,
        originalName: file.originalName,
      };

      if (file.isImage()) {
        // For images, generate thumbnail and preview
        previewUrl = file.generatePreviewPath();
        thumbnailUrl = file.generateThumbnailPath();
        metadata.dimensions = await this.getImageDimensions(file.storagePath);
      } else if (file.isDocument()) {
        // For documents, generate PDF preview
        previewUrl = await this.generateDocumentPreview(file.storagePath);
        metadata.pageCount = await this.getDocumentPageCount(file.storagePath);
      } else if (file.isVideo()) {
        // For videos, generate thumbnail from first frame
        thumbnailUrl = await this.generateVideoThumbnail(file.storagePath);
        metadata.duration = await this.getVideoDuration(file.storagePath);
      }

      return {
        previewUrl,
        thumbnailUrl,
        metadata,
      };
    } catch (error) {
      logger.error('Failed to generate attachment preview', {
        attachmentId,
        userId,
        options,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getAttachmentVersions(
    attachmentId: string,
    userId: string
  ): Promise<
    Array<{
      version: number;
      uploadedAt: Date;
      uploadedBy: string;
      size: number;
      changeDescription?: string;
    }>
  > {
    try {
      // Get attachment
      const attachment =
        await this.fileRepository.findAttachmentById(attachmentId);
      if (!attachment) {
        throw new Error('Attachment not found');
      }

      // Check permissions
      await this.validateAttachmentPermission(
        userId,
        attachment.attachedTo,
        attachment.attachedToId,
        'read'
      );

      // Get associated file
      const file = await this.fileRepository.findById(attachment.fileId);
      if (!file) {
        throw new Error('Associated file not found');
      }

      // Return file versions
      return file.versions.map(version => ({
        version: version.version,
        uploadedAt: version.uploadedAt,
        uploadedBy: version.uploadedBy,
        size: version.size,
        changeDescription: version.changeDescription,
      }));
    } catch (error) {
      logger.error('Failed to get attachment versions', {
        attachmentId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async validateAttachmentPermission(
    userId: string,
    entityType: string,
    entityId: string,
    action: string
  ): Promise<void> {
    // This would integrate with the authorization service
    // For now, implement basic validation

    // TODO: Implement proper permission checking based on:
    // - Workspace membership
    // - Project membership
    // - Task assignment
    // - Comment ownership
    // - Role-based permissions

    logger.debug('Validating attachment permission', {
      userId,
      entityType,
      entityId,
      action,
    });

    // Placeholder - in real implementation, this would check actual permissions
    if (!userId || !entityType || !entityId) {
      throw new Error('Access denied');
    }
  }

  private async getImageDimensions(
    storagePath: string
  ): Promise<{ width: number; height: number }> {
    // Placeholder - would use image processing library
    return { width: 0, height: 0 };
  }

  private async generateDocumentPreview(storagePath: string): Promise<string> {
    // Placeholder - would generate PDF preview
    return '';
  }

  private async getDocumentPageCount(storagePath: string): Promise<number> {
    // Placeholder - would count PDF pages
    return 1;
  }

  private async generateVideoThumbnail(storagePath: string): Promise<string> {
    // Placeholder - would generate video thumbnail
    return '';
  }

  private async getVideoDuration(storagePath: string): Promise<number> {
    // Placeholder - would get video duration
    return 0;
  }
}
