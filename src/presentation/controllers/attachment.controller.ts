import { FastifyRequest, FastifyReply } from 'fastify';
import { AttachmentService } from '../application/services/attachment.service';
import { logger } from '../../shared/utils/logger';
import * as z from 'zod';

// Validation schemas
const createAttachmentSchema = z.object({
  fileId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  attachedTo: z.enum(['task', 'comment', 'project']),
  attachedToId: z.string().uuid(),
  description: z.string().optional(),
  position: z.number().int().min(0).optional(),
});

const updateAttachmentSchema = z.object({
  description: z.string().optional(),
  position: z.number().int().min(0).optional(),
});

const searchAttachmentsSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  attachedTo: z.enum(['task', 'comment', 'project']).optional(),
  attachedToId: z.string().uuid().optional(),
  attachedBy: z.string().uuid().optional(),
  fileType: z.string().optional(),
  dateRange: z
    .object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    })
    .optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const reorderAttachmentsSchema = z.object({
  attachmentIds: z.array(z.string().uuid()),
});

const shareAttachmentSchema = z.object({
  shareWith: z.array(
    z.object({
      userId: z.string().uuid().optional(),
      email: z.string().email().optional(),
      permissions: z.array(z.enum(['read', 'write', 'delete'])),
      expiresAt: z.string().datetime().optional(),
    })
  ),
  message: z.string().optional(),
});

const previewOptionsSchema = z.object({
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),
  quality: z.number().int().min(1).max(100).optional(),
});

export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  async createAttachment(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Validate request body
      const validatedData = createAttachmentSchema.parse(request.body);

      // Get user ID from request context
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      // Create attachment
      const attachment = await this.attachmentService.createAttachment({
        ...validatedData,
        attachedBy: userId,
      });

      logger.info('Attachment created successfully via API', {
        attachmentId: attachment.id,
        fileId: validatedData.fileId,
        attachedTo: validatedData.attachedTo,
        attachedToId: validatedData.attachedToId,
        userId,
      });

      return reply.status(201).send({
        success: true,
        data: attachment.toPlainObject(),
      });
    } catch (error) {
      logger.error('Attachment creation failed via API', {
        body: request.body,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'ATTACHMENT_CREATION_FAILED',
          message:
            error instanceof Error
              ? error.message
              : 'Attachment creation failed',
        },
      });
    }
  }

  async updateAttachment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const attachmentId = (request.params as any).attachmentId;

      // Validate request body
      const validatedData = updateAttachmentSchema.parse(request.body);

      // Get user ID from request context
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      // Update attachment
      const attachment = await this.attachmentService.updateAttachment(
        attachmentId,
        userId,
        validatedData
      );

      logger.info('Attachment updated successfully via API', {
        attachmentId,
        userId,
        changes: validatedData,
      });

      return reply.send({
        success: true,
        data: attachment.toPlainObject(),
      });
    } catch (error) {
      logger.error('Attachment update failed via API', {
        attachmentId: (request.params as any).attachmentId,
        body: request.body,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        });
      }

      if (error.message === 'Attachment not found') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'ATTACHMENT_NOT_FOUND',
            message: 'Attachment not found',
          },
        });
      }

      if (error.message === 'Access denied') {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied',
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'ATTACHMENT_UPDATE_FAILED',
          message: 'Attachment update failed',
        },
      });
    }
  }

  async deleteAttachment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const attachmentId = (request.params as any).attachmentId;
      const permanent = (request.query as any).permanent === 'true';

      // Get user ID from request context
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      // Delete attachment
      await this.attachmentService.deleteAttachment(
        attachmentId,
        userId,
        permanent
      );

      logger.info('Attachment deleted successfully via API', {
        attachmentId,
        userId,
        permanent,
      });

      return reply.status(204).send();
    } catch (error) {
      logger.error('Attachment deletion failed via API', {
        attachmentId: (request.params as any).attachmentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error.message === 'Attachment not found') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'ATTACHMENT_NOT_FOUND',
            message: 'Attachment not found',
          },
        });
      }

      if (error.message === 'Access denied') {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied',
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'ATTACHMENT_DELETE_FAILED',
          message: 'Attachment deletion failed',
        },
      });
    }
  }

  async restoreAttachment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const attachmentId = (request.params as any).attachmentId;

      // Get user ID from request context
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      // Restore attachment
      await this.attachmentService.restoreAttachment(attachmentId, userId);

      logger.info('Attachment restored successfully via API', {
        attachmentId,
        userId,
      });

      return reply.status(204).send();
    } catch (error) {
      logger.error('Attachment restoration failed via API', {
        attachmentId: (request.params as any).attachmentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error.message === 'Attachment not found') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'ATTACHMENT_NOT_FOUND',
            message: 'Attachment not found',
          },
        });
      }

      if (error.message === 'Access denied') {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied',
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'ATTACHMENT_RESTORE_FAILED',
          message: 'Attachment restoration failed',
        },
      });
    }
  }

  async getAttachmentsByEntity(request: FastifyRequest, reply: FastifyReply) {
    try {
      const entityType = (request.params as any).entityType;
      const entityId = (request.params as any).entityId;

      // Get user ID from request context
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      // Get attachments
      const attachments = await this.attachmentService.getAttachmentsByEntity(
        entityType,
        entityId,
        userId
      );

      return reply.send({
        success: true,
        data: attachments.map(item => ({
          attachment: item.attachment.toPlainObject(),
          file: item.file.toPlainObject(),
        })),
      });
    } catch (error) {
      logger.error('Get attachments by entity failed via API', {
        entityType: (request.params as any).entityType,
        entityId: (request.params as any).entityId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error.message === 'Access denied') {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied',
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'GET_ATTACHMENTS_FAILED',
          message: 'Failed to get attachments',
        },
      });
    }
  }

  async searchAttachments(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Validate query parameters
      const query = searchAttachmentsSchema.parse(request.query);

      // Get user ID from request context
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      // Convert date strings to Date objects
      const searchRequest = {
        ...query,
        dateRange: query.dateRange
          ? {
              from: new Date(query.dateRange.from),
              to: new Date(query.dateRange.to),
            }
          : undefined,
      };

      // Search attachments
      const result = await this.attachmentService.searchAttachments(
        searchRequest,
        userId
      );

      return reply.send({
        success: true,
        data: {
          attachments: result.attachments.map(item => ({
            attachment: item.attachment.toPlainObject(),
            file: item.file.toPlainObject(),
          })),
          total: result.total,
        },
      });
    } catch (error) {
      logger.error('Attachment search failed via API', {
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors,
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'ATTACHMENT_SEARCH_FAILED',
          message: 'Attachment search failed',
        },
      });
    }
  }

  async reorderAttachments(request: FastifyRequest, reply: FastifyReply) {
    try {
      const entityType = (request.params as any).entityType;
      const entityId = (request.params as any).entityId;

      // Validate request body
      const validatedData = reorderAttachmentsSchema.parse(request.body);

      // Get user ID from request context
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      // Reorder attachments
      await this.attachmentService.reorderAttachments(
        entityType,
        entityId,
        userId,
        validatedData.attachmentIds
      );

      logger.info('Attachments reordered successfully via API', {
        entityType,
        entityId,
        userId,
        newOrder: validatedData.attachmentIds,
      });

      return reply.status(204).send();
    } catch (error) {
      logger.error('Attachment reordering failed via API', {
        entityType: (request.params as any).entityType,
        entityId: (request.params as any).entityId,
        body: request.body,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        });
      }

      if (error.message === 'Access denied') {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied',
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'ATTACHMENT_REORDER_FAILED',
          message: 'Attachment reordering failed',
        },
      });
    }
  }

  async shareAttachment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const attachmentId = (request.params as any).attachmentId;

      // Validate request body
      const validatedData = shareAttachmentSchema.parse(request.body);

      // Get user ID from request context
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      // Share attachment
      await this.attachmentService.shareAttachment({
        attachmentId,
        userId,
        shareWith: validatedData.shareWith.map(target => ({
          ...target,
          expiresAt: target.expiresAt ? new Date(target.expiresAt) : undefined,
        })),
        message: validatedData.message,
      });

      logger.info('Attachment shared successfully via API', {
        attachmentId,
        userId,
        sharedWith: validatedData.shareWith.length,
      });

      return reply.status(204).send();
    } catch (error) {
      logger.error('Attachment sharing failed via API', {
        attachmentId: (request.params as any).attachmentId,
        body: request.body,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        });
      }

      if (error.message === 'Attachment not found') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'ATTACHMENT_NOT_FOUND',
            message: 'Attachment not found',
          },
        });
      }

      if (error.message === 'Access denied') {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied',
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'ATTACHMENT_SHARE_FAILED',
          message: 'Attachment sharing failed',
        },
      });
    }
  }

  async generatePreview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const attachmentId = (request.params as any).attachmentId;

      // Validate query parameters
      const options = previewOptionsSchema.parse(request.query);

      // Get user ID from request context
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      // Generate preview
      const result = await this.attachmentService.generateAttachmentPreview(
        attachmentId,
        userId,
        options
      );

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Attachment preview generation failed via API', {
        attachmentId: (request.params as any).attachmentId,
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors,
          },
        });
      }

      if (error.message === 'Attachment not found') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'ATTACHMENT_NOT_FOUND',
            message: 'Attachment not found',
          },
        });
      }

      if (error.message === 'Access denied') {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied',
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'PREVIEW_GENERATION_FAILED',
          message: 'Preview generation failed',
        },
      });
    }
  }

  async getVersions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const attachmentId = (request.params as any).attachmentId;

      // Get user ID from request context
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      // Get attachment versions
      const versions = await this.attachmentService.getAttachmentVersions(
        attachmentId,
        userId
      );

      return reply.send({
        success: true,
        data: versions,
      });
    } catch (error) {
      logger.error('Get attachment versions failed via API', {
        attachmentId: (request.params as any).attachmentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error.message === 'Attachment not found') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'ATTACHMENT_NOT_FOUND',
            message: 'Attachment not found',
          },
        });
      }

      if (error.message === 'Access denied') {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied',
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'GET_VERSIONS_FAILED',
          message: 'Failed to get attachment versions',
        },
      });
    }
  }
}
