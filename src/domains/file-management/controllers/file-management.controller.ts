import { FastifyRequest, FastifyReply } from 'fastify';
import { FileManagementService } from '../services/file-management.service';
import { logger } from '../../../shared/utils/logger';
import { FileManagementValidator } from '../validators/file-management.validator';
import * as z from 'zod';

export class FileManagementController {
  constructor(private readonly fileManagementService: FileManagementService) {}

  async uploadFile(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Handle multipart form data
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'NO_FILE_PROVIDED',
            message: 'No file provided in the request',
          },
        });
      }

      // Get file buffer
      const buffer = await data.toBuffer();

      // Parse and validate form fields
      const fields = data.fields;
      const requestData = {
        workspaceId: fields.workspaceId?.value,
        attachTo: fields.attachTo?.value
          ? JSON.parse(fields.attachTo.value as string)
          : undefined,
        description: fields.description?.value,
        generateThumbnail: fields.generateThumbnail?.value === 'true',
        generatePreview: fields.generatePreview?.value === 'true',
        runVirusScan: fields.runVirusScan?.value === 'true',
        compress: fields.compress?.value === 'true',
        maxSize: fields.maxSize?.value
          ? parseInt(fields.maxSize.value as string)
          : undefined,
        allowedMimeTypes: fields.allowedMimeTypes?.value
          ? JSON.parse(fields.allowedMimeTypes.value as string)
          : undefined,
        customMetadata: fields.customMetadata?.value
          ? JSON.parse(fields.customMetadata.value as string)
          : undefined,
        accessControl: fields.accessControl?.value
          ? JSON.parse(fields.accessControl.value as string)
          : undefined,
      };

      // Validate request data
      const validatedData =
        FileManagementValidator.validateUploadFile(requestData);

      // Get user ID from request context (assuming it's set by auth middleware)
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

      // Upload file
      const result = await this.fileManagementService.uploadFile({
        buffer,
        filename: data.filename,
        userId,
        ...validatedData,
      });

      logger.info('File uploaded successfully via API', {
        fileId: result.file.id,
        filename: data.filename,
        size: buffer.length,
        userId,
        workspaceId: validatedData.workspaceId,
      });

      return reply.status(201).send({
        success: true,
        data: {
          file: result.file.toPlainObject(),
          attachment: result.attachment?.toPlainObject(),
        },
      });
    } catch (error) {
      logger.error('File upload failed via API', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
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
          code: 'UPLOAD_FAILED',
          message:
            error instanceof Error ? error.message : 'File upload failed',
        },
      });
    }
  }

  async downloadFile(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Validate request parameters
      const params = FileManagementValidator.validateDownloadFile({
        fileId: (request.params as any).fileId,
        ...(request.query as any),
      });

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

      // Download file
      const result = await this.fileManagementService.downloadFile({
        ...params,
        userId,
      });

      // Set response headers
      reply.header('Content-Type', result.mimeType);
      reply.header('Content-Length', result.size);
      reply.header(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`
      );

      if (result.lastModified) {
        reply.header('Last-Modified', result.lastModified.toUTCString());
      }

      if (result.etag) {
        reply.header('ETag', result.etag);
      }

      if (result.contentRange) {
        reply.header('Content-Range', result.contentRange);
        reply.status(206); // Partial Content
      }

      // Stream the file
      return reply.send(result.stream);
    } catch (error) {
      logger.error('File download failed via API', {
        fileId: (request.params as any).fileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: error.errors,
          },
        });
      }

      if (error.message === 'File not found') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found',
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
          code: 'DOWNLOAD_FAILED',
          message: 'File download failed',
        },
      });
    }
  }

  async uploadFileVersion(request: FastifyRequest, reply: FastifyReply) {
    try {
      const fileId = (request.params as any).fileId;

      // Handle multipart form data
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'NO_FILE_PROVIDED',
            message: 'No file provided in the request',
          },
        });
      }

      // Get file buffer
      const buffer = await data.toBuffer();

      // Parse and validate form fields
      const fields = data.fields;
      const requestData = FileManagementValidator.validateUploadVersion({
        changeDescription: fields.changeDescription?.value,
      });

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

      // Upload new version
      const updatedFile = await this.fileManagementService.uploadFileVersion(
        fileId,
        buffer,
        data.filename,
        userId,
        requestData.changeDescription
      );

      logger.info('File version uploaded successfully via API', {
        fileId,
        filename: data.filename,
        size: buffer.length,
        userId,
      });

      return reply.status(201).send({
        success: true,
        data: {
          file: updatedFile.toPlainObject(),
        },
      });
    } catch (error) {
      logger.error('File version upload failed via API', {
        fileId: (request.params as any).fileId,
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

      if (error.message === 'File not found') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found',
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
          code: 'VERSION_UPLOAD_FAILED',
          message: 'File version upload failed',
        },
      });
    }
  }

  async deleteFile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const fileId = (request.params as any).fileId;
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

      // Delete file
      await this.fileManagementService.deleteFile(fileId, userId, permanent);

      logger.info('File deleted successfully via API', {
        fileId,
        userId,
        permanent,
      });

      return reply.status(204).send();
    } catch (error) {
      logger.error('File deletion failed via API', {
        fileId: (request.params as any).fileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error.message === 'File not found') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found',
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
          code: 'DELETE_FAILED',
          message: 'File deletion failed',
        },
      });
    }
  }

  async restoreFile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const fileId = (request.params as any).fileId;

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

      // Restore file
      await this.fileManagementService.restoreFile(fileId, userId);

      logger.info('File restored successfully via API', {
        fileId,
        userId,
      });

      return reply.status(204).send();
    } catch (error) {
      logger.error('File restoration failed via API', {
        fileId: (request.params as any).fileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error.message === 'File not found') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found',
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
          code: 'RESTORE_FAILED',
          message: 'File restoration failed',
        },
      });
    }
  }

  async searchFiles(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Validate query parameters
      const query = FileManagementValidator.validateSearchFiles(request.query);

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
        userId,
        dateRange: query.dateRange
          ? {
              from: new Date(query.dateRange.from),
              to: new Date(query.dateRange.to),
            }
          : undefined,
      };

      // Search files
      const result =
        await this.fileManagementService.searchFiles(searchRequest);

      return reply.send({
        success: true,
        data: {
          files: result.files.map(file => file.toPlainObject()),
          total: result.total,
          limit: query.limit,
          offset: query.offset,
        },
      });
    } catch (error) {
      logger.error('File search failed via API', {
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
          code: 'SEARCH_FAILED',
          message: 'File search failed',
        },
      });
    }
  }

  async getFilesByAttachment(request: FastifyRequest, reply: FastifyReply) {
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

      // Get files by attachment
      const result = await this.fileManagementService.getFilesByAttachment(
        entityType,
        entityId,
        userId
      );

      return reply.send({
        success: true,
        data: result.map(item => ({
          file: item.file.toPlainObject(),
          attachment: item.attachment.toPlainObject(),
        })),
      });
    } catch (error) {
      logger.error('Get files by attachment failed via API', {
        entityType: (request.params as any).entityType,
        entityId: (request.params as any).entityId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return reply.status(500).send({
        success: false,
        error: {
          code: 'GET_FILES_FAILED',
          message: 'Failed to get files by attachment',
        },
      });
    }
  }

  async getStorageUsage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const workspaceId = (request.params as any).workspaceId;

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

      // Get storage usage
      const usage =
        await this.fileManagementService.getStorageUsage(workspaceId);

      return reply.send({
        success: true,
        data: usage,
      });
    } catch (error) {
      logger.error('Get storage usage failed via API', {
        workspaceId: (request.params as any).workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return reply.status(500).send({
        success: false,
        error: {
          code: 'GET_USAGE_FAILED',
          message: 'Failed to get storage usage',
        },
      });
    }
  }
}
