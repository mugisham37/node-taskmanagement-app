import { FastifyInstance } from 'fastify';
import { RateLimitMiddleware } from '../middleware';

export async function searchRoutes(
  fastify: FastifyInstance,
  container: any
): Promise<void> {
  const searchController = container.resolve('SEARCH_CONTROLLER');
  const authMiddleware = container.resolve('AUTH_MIDDLEWARE');
  const rateLimitMiddleware = container.resolve('RATE_LIMIT_MIDDLEWARE');
  // All search routes require authentication
  const readPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
  ];

  const commonPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
  ];

  // Global search
  fastify.get('/global', {
    preHandler: readPreHandlers,
    handler: searchController.globalSearch,
  });

  // Entity-specific search
  fastify.get('/tasks', {
    preHandler: readPreHandlers,
    handler: searchController.searchTasks,
  });

  fastify.get('/projects', {
    preHandler: readPreHandlers,
    handler: searchController.searchProjects,
  });

  fastify.get('/users', {
    preHandler: readPreHandlers,
    handler: searchController.searchUsers,
  });

  fastify.get('/files', {
    preHandler: readPreHandlers,
    handler: searchController.searchFiles,
  });

  fastify.get('/notifications', {
    preHandler: readPreHandlers,
    handler: searchController.searchNotifications,
  });

  // Advanced search
  fastify.post('/advanced', {
    preHandler: readPreHandlers,
    handler: searchController.advancedSearch,
  });

  // Search suggestions and autocomplete
  fastify.get('/suggestions', {
    preHandler: readPreHandlers,
    handler: searchController.getSearchSuggestions,
  });

  fastify.get('/autocomplete', {
    preHandler: readPreHandlers,
    handler: searchController.getAutocomplete,
  });

  // Search history and saved searches
  fastify.get('/history', {
    preHandler: readPreHandlers,
    handler: searchController.getSearchHistory,
  });

  fastify.post('/history', {
    preHandler: commonPreHandlers,
    handler: searchController.saveSearchToHistory,
  });

  fastify.delete('/history/:id', {
    preHandler: commonPreHandlers,
    handler: searchController.deleteSearchFromHistory,
  });

  fastify.post('/saved', {
    preHandler: commonPreHandlers,
    handler: searchController.saveSearch,
  });

  fastify.get('/saved', {
    preHandler: readPreHandlers,
    handler: searchController.getSavedSearches,
  });

  fastify.delete('/saved/:id', {
    preHandler: commonPreHandlers,
    handler: searchController.deleteSavedSearch,
  });

  // Search analytics
  fastify.get('/analytics', {
    preHandler: readPreHandlers,
    handler: searchController.getSearchAnalytics,
  });

  // Search indexing (admin only)
  fastify.post('/reindex', {
    preHandler: [
      authMiddleware.authenticate,
      authMiddleware.requireRole('admin'),
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.STRICT),
    ],
    handler: searchController.reindexSearch,
  });

  fastify.get('/index-status', {
    preHandler: [
      authMiddleware.authenticate,
      authMiddleware.requireRole('admin'),
      rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
    ],
    handler: searchController.getIndexStatus,
  });
}

