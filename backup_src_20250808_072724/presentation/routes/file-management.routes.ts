import { FastifyInstance } from 'fastify';
import { FileManagementController } from '../controllers/file-management.controller';
import { AttachmentController } from '../controllers/attachment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

export async function fileManagementRoutes(fastify: FastifyInstance) {
  const fileController = new FileManagementController(
    fastify.diContainer.resolve('fileManagementService')
  );

  const attachmentController = new AttachmentController(
    fastify.diContainer.resolve('attachmentService')
  );

  // Apply authentication middleware to all routes
  fastify.addHook('preHandler', authMiddleware);

  // File upload and management routes
  fastify.post(
    '/files/upload',
    {
      schema: {
        description: 'Upload a file',
        tags: ['Files'],
        consumes: ['multipart/form-data'],
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  file: { type: 'object' },
                  attachment: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    fileController.uploadFile.bind(fileController)
  );

  fastify.get(
    '/files/:fileId/download',
    {
      schema: {
        description: 'Download a file',
        tags: ['Files'],
        params: {
          type: 'object',
          properties: {
            fileId: { type: 'string', format: 'uuid' },
          },
          required: ['fileId'],
        },
        querystring: {
          type: 'object',
          properties: {
            version: { type: 'integer', minimum: 1 },
            thumbnail: { type: 'boolean' },
            preview: { type: 'boolean' },
          },
        },
      },
    },
    fileController.downloadFile.bind(fileController)
  );

  fastify.post(
    '/files/:fileId/versions',
    {
      schema: {
        description: 'Upload a new version of a file',
        tags: ['Files'],
        params: {
          type: 'object',
          properties: {
            fileId: { type: 'string', format: 'uuid' },
          },
          required: ['fileId'],
        },
        consumes: ['multipart/form-data'],
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  file: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    fileController.uploadFileVersion.bind(fileController)
  );

  fastify.delete(
    '/files/:fileId',
    {
      schema: {
        description: 'Delete a file',
        tags: ['Files'],
        params: {
          type: 'object',
          properties: {
            fileId: { type: 'string', format: 'uuid' },
          },
          required: ['fileId'],
        },
        querystring: {
          type: 'object',
          properties: {
            permanent: { type: 'boolean', default: false },
          },
        },
        response: {
          204: {
            type: 'null',
          },
        },
      },
    },
    fileController.deleteFile.bind(fileController)
  );

  fastify.post(
    '/files/:fileId/restore',
    {
      schema: {
        description: 'Restore a deleted file',
        tags: ['Files'],
        params: {
          type: 'object',
          properties: {
            fileId: { type: 'string', format: 'uuid' },
          },
          required: ['fileId'],
        },
        response: {
          204: {
            type: 'null',
          },
        },
      },
    },
    fileController.restoreFile.bind(fileController)
  );

  fastify.get(
    '/files/search',
    {
      schema: {
        description: 'Search files',
        tags: ['Files'],
        querystring: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', format: 'uuid' },
            mimeType: { type: 'string' },
            sizeRange: {
              type: 'object',
              properties: {
                min: { type: 'integer', minimum: 0 },
                max: { type: 'integer', minimum: 1 },
              },
            },
            dateRange: {
              type: 'object',
              properties: {
                from: { type: 'string', format: 'date-time' },
                to: { type: 'string', format: 'date-time' },
              },
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
            fullTextSearch: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  files: { type: 'array', items: { type: 'object' } },
                  total: { type: 'integer' },
                  limit: { type: 'integer' },
                  offset: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    fileController.searchFiles.bind(fileController)
  );

  fastify.get(
    '/files/by-attachment/:entityType/:entityId',
    {
      schema: {
        description: 'Get files attached to an entity',
        tags: ['Files'],
        params: {
          type: 'object',
          properties: {
            entityType: {
              type: 'string',
              enum: ['task', 'comment', 'project'],
            },
            entityId: { type: 'string', format: 'uuid' },
          },
          required: ['entityType', 'entityId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    file: { type: 'object' },
                    attachment: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    fileController.getFilesByAttachment.bind(fileController)
  );

  fastify.get(
    '/workspaces/:workspaceId/storage-usage',
    {
      schema: {
        description: 'Get storage usage for a workspace',
        tags: ['Files'],
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', format: 'uuid' },
          },
          required: ['workspaceId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  totalFiles: { type: 'integer' },
                  totalSize: { type: 'integer' },
                  sizeByMimeType: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    fileController.getStorageUsage.bind(fileController)
  );

  // Attachment management routes
  fastify.post(
    '/attachments',
    {
      schema: {
        description: 'Create an attachment',
        tags: ['Attachments'],
        body: {
          type: 'object',
          properties: {
            fileId: { type: 'string', format: 'uuid' },
            workspaceId: { type: 'string', format: 'uuid' },
            attachedTo: {
              type: 'string',
              enum: ['task', 'comment', 'project'],
            },
            attachedToId: { type: 'string', format: 'uuid' },
            description: { type: 'string' },
            position: { type: 'integer', minimum: 0 },
          },
          required: ['fileId', 'workspaceId', 'attachedTo', 'attachedToId'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    attachmentController.createAttachment.bind(attachmentController)
  );

  fastify.patch(
    '/attachments/:attachmentId',
    {
      schema: {
        description: 'Update an attachment',
        tags: ['Attachments'],
        params: {
          type: 'object',
          properties: {
            attachmentId: { type: 'string', format: 'uuid' },
          },
          required: ['attachmentId'],
        },
        body: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            position: { type: 'integer', minimum: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    attachmentController.updateAttachment.bind(attachmentController)
  );

  fastify.delete(
    '/attachments/:attachmentId',
    {
      schema: {
        description: 'Delete an attachment',
        tags: ['Attachments'],
        params: {
          type: 'object',
          properties: {
            attachmentId: { type: 'string', format: 'uuid' },
          },
          required: ['attachmentId'],
        },
        querystring: {
          type: 'object',
          properties: {
            permanent: { type: 'boolean', default: false },
          },
        },
        response: {
          204: {
            type: 'null',
          },
        },
      },
    },
    attachmentController.deleteAttachment.bind(attachmentController)
  );

  fastify.post(
    '/attachments/:attachmentId/restore',
    {
      schema: {
        description: 'Restore a deleted attachment',
        tags: ['Attachments'],
        params: {
          type: 'object',
          properties: {
            attachmentId: { type: 'string', format: 'uuid' },
          },
          required: ['attachmentId'],
        },
        response: {
          204: {
            type: 'null',
          },
        },
      },
    },
    attachmentController.restoreAttachment.bind(attachmentController)
  );

  fastify.get(
    '/attachments/by-entity/:entityType/:entityId',
    {
      schema: {
        description: 'Get attachments for an entity',
        tags: ['Attachments'],
        params: {
          type: 'object',
          properties: {
            entityType: {
              type: 'string',
              enum: ['task', 'comment', 'project'],
            },
            entityId: { type: 'string', format: 'uuid' },
          },
          required: ['entityType', 'entityId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    attachment: { type: 'object' },
                    file: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    attachmentController.getAttachmentsByEntity.bind(attachmentController)
  );

  fastify.get(
    '/attachments/search',
    {
      schema: {
        description: 'Search attachments',
        tags: ['Attachments'],
        querystring: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', format: 'uuid' },
            attachedTo: {
              type: 'string',
              enum: ['task', 'comment', 'project'],
            },
            attachedToId: { type: 'string', format: 'uuid' },
            attachedBy: { type: 'string', format: 'uuid' },
            fileType: { type: 'string' },
            dateRange: {
              type: 'object',
              properties: {
                from: { type: 'string', format: 'date-time' },
                to: { type: 'string', format: 'date-time' },
              },
            },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  attachments: { type: 'array', items: { type: 'object' } },
                  total: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    attachmentController.searchAttachments.bind(attachmentController)
  );

  fastify.post(
    '/attachments/reorder/:entityType/:entityId',
    {
      schema: {
        description: 'Reorder attachments for an entity',
        tags: ['Attachments'],
        params: {
          type: 'object',
          properties: {
            entityType: {
              type: 'string',
              enum: ['task', 'comment', 'project'],
            },
            entityId: { type: 'string', format: 'uuid' },
          },
          required: ['entityType', 'entityId'],
        },
        body: {
          type: 'object',
          properties: {
            attachmentIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
            },
          },
          required: ['attachmentIds'],
        },
        response: {
          204: {
            type: 'null',
          },
        },
      },
    },
    attachmentController.reorderAttachments.bind(attachmentController)
  );

  fastify.post(
    '/attachments/:attachmentId/share',
    {
      schema: {
        description: 'Share an attachment',
        tags: ['Attachments'],
        params: {
          type: 'object',
          properties: {
            attachmentId: { type: 'string', format: 'uuid' },
          },
          required: ['attachmentId'],
        },
        body: {
          type: 'object',
          properties: {
            shareWith: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'string', format: 'uuid' },
                  email: { type: 'string', format: 'email' },
                  permissions: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: ['read', 'write', 'delete'],
                    },
                  },
                  expiresAt: { type: 'string', format: 'date-time' },
                },
                required: ['permissions'],
              },
            },
            message: { type: 'string' },
          },
          required: ['shareWith'],
        },
        response: {
          204: {
            type: 'null',
          },
        },
      },
    },
    attachmentController.shareAttachment.bind(attachmentController)
  );

  fastify.get(
    '/attachments/:attachmentId/preview',
    {
      schema: {
        description: 'Generate attachment preview',
        tags: ['Attachments'],
        params: {
          type: 'object',
          properties: {
            attachmentId: { type: 'string', format: 'uuid' },
          },
          required: ['attachmentId'],
        },
        querystring: {
          type: 'object',
          properties: {
            width: { type: 'integer', minimum: 1 },
            height: { type: 'integer', minimum: 1 },
            quality: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  previewUrl: { type: 'string' },
                  thumbnailUrl: { type: 'string' },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    attachmentController.generatePreview.bind(attachmentController)
  );

  fastify.get(
    '/attachments/:attachmentId/versions',
    {
      schema: {
        description: 'Get attachment versions',
        tags: ['Attachments'],
        params: {
          type: 'object',
          properties: {
            attachmentId: { type: 'string', format: 'uuid' },
          },
          required: ['attachmentId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    version: { type: 'integer' },
                    uploadedAt: { type: 'string', format: 'date-time' },
                    uploadedBy: { type: 'string', format: 'uuid' },
                    size: { type: 'integer' },
                    changeDescription: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    attachmentController.getVersions.bind(attachmentController)
  );
}
