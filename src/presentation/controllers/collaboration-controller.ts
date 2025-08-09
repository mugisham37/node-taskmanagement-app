import { FastifyRequest, FastifyReply } from 'fastify';
import { CollaborationService } from '../../infrastructure/external-services/collaboration-service';
import { RealtimeEventService } from '../../infrastructure/external-services/realtime-event-service';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { AppError } from '../../shared/errors/app-error';
import { ValidationError } from '../../shared/errors/validation-error';
import { NotFoundError } from '../../shared/errors/not-found-error';

export class CollaborationController {
  constructor(
    private readonly collaborationService: CollaborationService,
    private readonly realtimeEventService: RealtimeEventService,
    private readonly logger: LoggingService
  ) {}

  // Document operations
  async createDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { documentId, type, entityId, initialContent } = request.body as {
        documentId: string;
        type: 'task' | 'project' | 'comment';
        entityId: string;
        initialContent: any;
      };

      const userId = (request as any).user?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!documentId || !type || !entityId) {
        throw new ValidationError('Document ID, type, and entity ID are required');
      }

      const document = await this.collaborationService.createDocument(
        documentId,
        type,
        entityId,
        initialContent,
        userId
      );

      this.logger.info('Document created via API', {
        documentId,
        type,
        entityId,
        userId,
      });

      reply.code(201).send({
        success: true,
        document: {
          id: document.id,
          type: document.type,
          entityId: document.entityId,
          version: document.version,
          lastModified: document.lastModified,
          collaborators: Array.from(document.collaborators),
        },
      });
    } catch (error) {
      this.logger.error('Failed to create document', error as Error);
      
      if (error instanceof ValidationError) {
        reply.code(400).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async getDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { documentId } = request.params as { documentId: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const document = await this.collaborationService.getDocument(documentId);
      
      if (!document) {
        throw new NotFoundError('Document not found');
      }

      // Check if user is a collaborator
      if (!document.collaborators.has(userId)) {
        reply.code(403).send({ error: 'Access denied' });
        return;
      }

      reply.send({
        success: true,
        document: {
          id: document.id,
          type: document.type,
          entityId: document.entityId,
          content: document.content,
          version: document.version,
          lastModified: document.lastModified,
          lastModifiedBy: document.lastModifiedBy,
          collaborators: Array.from(document.collaborators),
        },
      });
    } catch (error) {
      this.logger.error('Failed to get document', error as Error);
      
      if (error instanceof NotFoundError) {
        reply.code(404).send({ error: error.message });
      } else if (error instanceof ValidationError) {
        reply.code(400).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async applyOperation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { documentId } = request.params as { documentId: string };
      const { type, position, content, length, version } = request.body as {
        type: 'insert' | 'delete' | 'replace' | 'format';
        position: number;
        content?: string;
        length?: number;
        version: number;
      };

      const userId = (request as any).user?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!type || position === undefined || version === undefined) {
        throw new ValidationError('Operation type, position, and version are required');
      }

      const result = await this.collaborationService.applyOperation(
        documentId,
        { type, position, content, length, version, userId },
        userId
      );

      if (!result.success) {
        if (result.conflict) {
          reply.code(409).send({
            error: 'Operation conflict',
            conflict: true,
            message: 'Document has been modified by another user',
          });
        } else {
          reply.code(400).send({ error: 'Failed to apply operation' });
        }
        return;
      }

      reply.send({
        success: true,
        document: {
          id: result.document!.id,
          version: result.document!.version,
          lastModified: result.document!.lastModified,
        },
      });
    } catch (error) {
      this.logger.error('Failed to apply operation', error as Error);
      
      if (error instanceof ValidationError) {
        reply.code(400).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async addCollaborator(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { documentId } = request.params as { documentId: string };
      const { collaboratorId } = request.body as { collaboratorId: string };

      const userId = (request as any).user?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!collaboratorId) {
        throw new ValidationError('Collaborator ID is required');
      }

      const success = await this.collaborationService.addCollaborator(documentId, collaboratorId);
      
      if (!success) {
        throw new NotFoundError('Document not found');
      }

      this.logger.info('Collaborator added to document', {
        documentId,
        collaboratorId,
        addedBy: userId,
      });

      reply.send({
        success: true,
        message: 'Collaborator added successfully',
      });
    } catch (error) {
      this.logger.error('Failed to add collaborator', error as Error);
      
      if (error instanceof NotFoundError) {
        reply.code(404).send({ error: error.message });
      } else if (error instanceof ValidationError) {
        reply.code(400).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  // Comments
  async addComment(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { documentId } = request.params as { documentId: string };
      const { content, position, parentId } = request.body as {
        content: string;
        position?: number;
        parentId?: string;
      };

      const userId = (request as any).user?.id;
      const userEmail = (request as any).user?.email;

      if (!userId || !userEmail) {
        throw new ValidationError('User authentication required');
      }

      if (!content || content.trim().length === 0) {
        throw new ValidationError('Comment content is required');
      }

      const comment = await this.collaborationService.addComment(
        documentId,
        userId,
        userEmail,
        content.trim(),
        position,
        parentId
      );

      this.logger.info('Comment added to document', {
        documentId,
        commentId: comment.id,
        userId,
        hasParent: !!parentId,
      });

      reply.code(201).send({
        success: true,
        comment,
      });
    } catch (error) {
      this.logger.error('Failed to add comment', error as Error);
      
      if (error instanceof ValidationError) {
        reply.code(400).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async updateComment(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { documentId, commentId } = request.params as { documentId: string; commentId: string };
      const { content } = request.body as { content: string };

      const userId = (request as any).user?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!content || content.trim().length === 0) {
        throw new ValidationError('Comment content is required');
      }

      const comment = await this.collaborationService.updateComment(
        commentId,
        documentId,
        userId,
        content.trim()
      );

      if (!comment) {
        throw new NotFoundError('Comment not found or access denied');
      }

      this.logger.info('Comment updated', {
        documentId,
        commentId,
        userId,
      });

      reply.send({
        success: true,
        comment,
      });
    } catch (error) {
      this.logger.error('Failed to update comment', error as Error);
      
      if (error instanceof NotFoundError) {
        reply.code(404).send({ error: error.message });
      } else if (error instanceof ValidationError) {
        reply.code(400).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async deleteComment(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { documentId, commentId } = request.params as { documentId: string; commentId: string };

      const userId = (request as any).user?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const success = await this.collaborationService.deleteComment(commentId, documentId, userId);

      if (!success) {
        throw new NotFoundError('Comment not found or access denied');
      }

      this.logger.info('Comment deleted', {
        documentId,
        commentId,
        userId,
      });

      reply.send({
        success: true,
        message: 'Comment deleted successfully',
      });
    } catch (error) {
      this.logger.error('Failed to delete comment', error as Error);
      
      if (error instanceof NotFoundError) {
        reply.code(404).send({ error: error.message });
      } else if (error instanceof ValidationError) {
        reply.code(400).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async getComments(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { documentId } = request.params as { documentId: string };

      const userId = (request as any).user?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const comments = this.collaborationService.getComments(documentId);

      reply.send({
        success: true,
        comments,
        count: comments.length,
      });
    } catch (error) {
      this.logger.error('Failed to get comments', error as Error);
      
      if (error instanceof ValidationError) {
        reply.code(400).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  // Document locking
  async acquireLock(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { documentId } = request.params as { documentId: string };

      const userId = (request as any).user?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const success = await this.collaborationService.acquireLock(documentId, userId);

      if (!success) {
        reply.code(409).send({
          error: 'Document is locked by another user',
          locked: true,
        });
        return;
      }

      reply.send({
        success: true,
        message: 'Document lock acquired',
        lockedBy: userId,
      });
    } catch (error) {
      this.logger.error('Failed to acquire document lock', error as Error);
      
      if (error instanceof ValidationError) {
        reply.code(400).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async releaseLock(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { documentId } = request.params as { documentId: string };

      const userId = (request as any).user?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const success = await this.collaborationService.releaseLock(documentId, userId);

      if (!success) {
        reply.code(400).send({
          error: 'Lock not found or access denied',
        });
        return;
      }

      reply.send({
        success: true,
        message: 'Document lock released',
      });
    } catch (error) {
      this.logger.error('Failed to release document lock', error as Error);
      
      if (error instanceof ValidationError) {
        reply.code(400).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async getLockStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { documentId } = request.params as { documentId: string };

      const lockStatus = this.collaborationService.isDocumentLocked(documentId);

      reply.send({
        success: true,
        ...lockStatus,
      });
    } catch (error) {
      this.logger.error('Failed to get lock status', error as Error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  // Typing indicators
  async getTypingIndicators(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { documentId } = request.params as { documentId: string };

      const indicators = this.collaborationService.getTypingIndicators(documentId);

      reply.send({
        success: true,
        indicators,
        count: indicators.length,
      });
    } catch (error) {
      this.logger.error('Failed to get typing indicators', error as E