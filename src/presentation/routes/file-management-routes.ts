import { FastifyInstance } from 'fastify';
import { FileManagementController } from '../controllers/file-management-controller';
import { AuthMiddleware, RateLimitMiddleware } from '../middleware';

export async function fileManagementRoutes(
  fastify: FastifyInstance,
  container: any
): Promise<void> {
  const fileController = container.resolve('FILE_MANAGEMENT_CONTROLLER');
  const authMiddleware = container.resolve('AUTH_MIDDLEWARE');
  const rateLimitMiddleware = container.resolve('RATE_LIMIT_MIDDLEWARE');
  // All file routes require authentication
  const commonPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
  ];

  const readPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
  ];

  const uploadPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.STRICT),
  ];

  // File upload operations
  fastify.post('/upload', {
    preHandler: uploadPreHandlers,
    handler: fileController.uploadFile,
  });

  fastify.post('/upload/multiple', {
    preHandler: uploadPreHandlers,
    handler: fileController.uploadMultipleFiles,
  });

  fastify.post('/upload/chunk', {
    preHandler: uploadPreHandlers,
    handler: fileController.uploadFileChunk,
  });

  fastify.post('/upload/complete', {
    preHandler: uploadPreHandlers,
    handler: fileController.completeChunkedUpload,
  });

  // File management operations
  fastify.get('/files', {
    preHandler: readPreHandlers,
    handler: fileController.getFiles,
  });

  fastify.get('/files/:id', {
    preHandler: readPreHandlers,
    handler: fileController.getFile,
  });

  fastify.get('/files/:id/download', {
    preHandler: readPreHandlers,
    handler: fileController.downloadFile,
  });

  fastify.get('/files/:id/preview', {
    preHandler: readPreHandlers,
    handler: fileController.previewFile,
  });

  fastify.put('/files/:id', {
    preHandler: commonPreHandlers,
    handler: fileController.updateFile,
  });

  fastify.delete('/files/:id', {
    preHandler: commonPreHandlers,
    handler: fileController.deleteFile,
  });

  // File sharing and permissions
  fastify.post('/files/:id/share', {
    preHandler: commonPreHandlers,
    handler: fileController.shareFile,
  });

  fastify.delete('/files/:id/share/:shareId', {
    preHandler: commonPreHandlers,
    handler: fileController.revokeFileShare,
  });

  fastify.get('/files/:id/permissions', {
    preHandler: readPreHandlers,
    handler: fileController.getFilePermissions,
  });

  fastify.put('/files/:id/permissions', {
    preHandler: commonPreHandlers,
    handler: fileController.updateFilePermissions,
  });

  // File versioning
  fastify.get('/files/:id/versions', {
    preHandler: readPreHandlers,
    handler: fileController.getFileVersions,
  });

  fastify.post('/files/:id/versions', {
    preHandler: uploadPreHandlers,
    handler: fileController.createFileVersion,
  });

  fastify.get('/files/:id/versions/:versionId', {
    preHandler: readPreHandlers,
    handler: fileController.getFileVersion,
  });

  fastify.post('/files/:id/versions/:versionId/restore', {
    preHandler: commonPreHandlers,
    handler: fileController.restoreFileVersion,
  });

  // File organization
  fastify.post('/folders', {
    preHandler: commonPreHandlers,
    handler: fileController.createFolder,
  });

  fastify.get('/folders', {
    preHandler: readPreHandlers,
    handler: fileController.getFolders,
  });

  fastify.get('/folders/:id', {
    preHandler: readPreHandlers,
    handler: fileController.getFolder,
  });

  fastify.put('/folders/:id', {
    preHandler: commonPreHandlers,
    handler: fileController.updateFolder,
  });

  fastify.delete('/folders/:id', {
    preHandler: commonPreHandlers,
    handler: fileController.deleteFolder,
  });

  fastify.post('/files/:id/move', {
    preHandler: commonPreHandlers,
    handler: fileController.moveFile,
  });

  fastify.post('/files/:id/copy', {
    preHandler: commonPreHandlers,
    handler: fileController.copyFile,
  });

  // File search and filtering
  fastify.get('/search', {
    preHandler: readPreHandlers,
    handler: fileController.searchFiles,
  });

  fastify.get('/recent', {
    preHandler: readPreHandlers,
    handler: fileController.getRecentFiles,
  });

  fastify.get('/shared', {
    preHandler: readPreHandlers,
    handler: fileController.getSharedFiles,
  });

  // File statistics
  fastify.get('/stats', {
    preHandler: readPreHandlers,
    handler: fileController.getFileStats,
  });

  fastify.get('/storage-usage', {
    preHandler: readPreHandlers,
    handler: fileController.getStorageUsage,
  });

  // Bulk operations
  fastify.post('/bulk/delete', {
    preHandler: commonPreHandlers,
    handler: fileController.bulkDeleteFiles,
  });

  fastify.post('/bulk/move', {
    preHandler: commonPreHandlers,
    handler: fileController.bulkMoveFiles,
  });

  fastify.post('/bulk/share', {
    preHandler: commonPreHandlers,
    handler: fileController.bulkShareFiles,
  });

  // File cleanup and maintenance
  fastify.post('/cleanup/orphaned', {
    preHandler: [
      authMiddleware.authenticate,
      authMiddleware.requireRole('admin'),
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.STRICT),
    ],
    handler: fileController.cleanupOrphanedFiles,
  });

  fastify.post('/cleanup/temporary', {
    preHandler: [
      authMiddleware.authenticate,
      authMiddleware.requireRole('admin'),
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.STRICT),
    ],
    handler: fileController.cleanupTemporaryFiles,
  });
}
