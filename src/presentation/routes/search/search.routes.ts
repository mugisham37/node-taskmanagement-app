import { FastifyInstance } from 'fastify';
import { SearchController } from '../controllers/search.controller';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import {
  searchQuerySchema,
  advancedSearchSchema,
  crossEntitySearchSchema,
  suggestionsSchema,
  createSavedSearchSchema,
  updateSavedSearchSchema,
  executeSavedSearchSchema,
  searchAnalyticsSchema,
  facetsSchema,
} from '../validators/search.validator';

export async function searchRoutes(fastify: FastifyInstance) {
  const searchController = new SearchController(
    fastify.diContainer.resolve('searchService')
  );

  // Apply authentication middleware to all routes
  fastify.addHook('preHandler', authMiddleware);

  // Basic search
  fastify.get(
    '/workspaces/:workspaceId/search',
    {
      schema: searchQuerySchema,
      preHandler: [authMiddleware],
    },
    searchController.search.bind(searchController)
  );

  // Advanced search with filtering
  fastify.post(
    '/workspaces/:workspaceId/search/advanced',
    {
      schema: advancedSearchSchema,
      preHandler: [authMiddleware],
    },
    searchController.advancedSearch.bind(searchController)
  );

  // Cross-entity search
  fastify.get(
    '/workspaces/:workspaceId/search/cross-entity',
    {
      schema: crossEntitySearchSchema,
      preHandler: [authMiddleware],
    },
    searchController.crossEntitySearch.bind(searchController)
  );

  // Search suggestions
  fastify.get(
    '/workspaces/:workspaceId/search/suggestions',
    {
      schema: suggestionsSchema,
      preHandler: [authMiddleware],
    },
    searchController.getSuggestions.bind(searchController)
  );

  // Search facets
  fastify.get(
    '/workspaces/:workspaceId/search/facets',
    {
      schema: facetsSchema,
      preHandler: [authMiddleware],
    },
    searchController.getSearchFacets.bind(searchController)
  );

  // Search analytics
  fastify.get(
    '/workspaces/:workspaceId/search/analytics',
    {
      schema: searchAnalyticsSchema,
      preHandler: [authMiddleware],
    },
    searchController.getSearchAnalytics.bind(searchController)
  );

  // Rebuild search index (admin only)
  fastify.post(
    '/workspaces/:workspaceId/search/rebuild-index',
    {
      preHandler: [authMiddleware],
    },
    searchController.rebuildSearchIndex.bind(searchController)
  );

  // Get index statistics
  fastify.get(
    '/workspaces/:workspaceId/search/index-stats',
    {
      preHandler: [authMiddleware],
    },
    searchController.getIndexStats.bind(searchController)
  );

  // Saved searches routes

  // Create saved search
  fastify.post(
    '/workspaces/:workspaceId/saved-searches',
    {
      schema: createSavedSearchSchema,
      preHandler: [authMiddleware],
    },
    searchController.createSavedSearch.bind(searchController)
  );

  // Get user's saved searches
  fastify.get(
    '/workspaces/:workspaceId/saved-searches',
    {
      preHandler: [authMiddleware],
    },
    searchController.getSavedSearches.bind(searchController)
  );

  // Get shared saved searches
  fastify.get(
    '/workspaces/:workspaceId/saved-searches/shared',
    {
      preHandler: [authMiddleware],
    },
    searchController.getSharedSavedSearches.bind(searchController)
  );

  // Update saved search
  fastify.put(
    '/workspaces/:workspaceId/saved-searches/:id',
    {
      schema: updateSavedSearchSchema,
      preHandler: [authMiddleware],
    },
    searchController.updateSavedSearch.bind(searchController)
  );

  // Delete saved search
  fastify.delete(
    '/workspaces/:workspaceId/saved-searches/:id',
    {
      preHandler: [authMiddleware],
    },
    searchController.deleteSavedSearch.bind(searchController)
  );

  // Execute saved search
  fastify.get(
    '/workspaces/:workspaceId/saved-searches/:id/execute',
    {
      schema: executeSavedSearchSchema,
      preHandler: [authMiddleware],
    },
    searchController.executeSavedSearch.bind(searchController)
  );

  // Set default saved search
  fastify.post(
    '/workspaces/:workspaceId/saved-searches/:id/set-default',
    {
      preHandler: [authMiddleware],
    },
    searchController.setDefaultSavedSearch.bind(searchController)
  );
}
