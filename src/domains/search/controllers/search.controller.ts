import { FastifyRequest, FastifyReply } from 'fastify';
import { SearchService } from '../services/search.service';
import { FilterGroup } from '../services/advanced-filtering.service';
import { BaseController } from '../../../shared/utils/base.controller';

interface SearchRequest extends FastifyRequest {
  query: {
    q: string;
    entityTypes?: string;
    filters?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: string;
    offset?: string;
  };
  params: {
    workspaceId: string;
  };
}

interface AdvancedSearchRequest extends FastifyRequest {
  body: {
    query: string;
    filterGroup: FilterGroup;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  };
  params: {
    workspaceId: string;
  };
}

interface CrossEntitySearchRequest extends FastifyRequest {
  query: {
    q: string;
    includeRelated?: string;
  };
  params: {
    workspaceId: string;
  };
}

interface SuggestionsRequest extends FastifyRequest {
  query: {
    q: string;
    limit?: string;
    context?: string;
  };
  params: {
    workspaceId: string;
  };
}

interface CreateSavedSearchRequest extends FastifyRequest {
  body: {
    name: string;
    description?: string;
    query: string;
    filters?: Record<string, any>;
    isShared?: boolean;
    sharedWith?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  params: {
    workspaceId: string;
  };
}

interface UpdateSavedSearchRequest extends FastifyRequest {
  body: {
    name?: string;
    description?: string;
    query?: string;
    filters?: Record<string, any>;
    isShared?: boolean;
    sharedWith?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  params: {
    workspaceId: string;
    id: string;
  };
}

interface SavedSearchRequest extends FastifyRequest {
  params: {
    workspaceId: string;
    id: string;
  };
}

interface ExecuteSavedSearchRequest extends FastifyRequest {
  query: {
    limit?: string;
    offset?: string;
  };
  params: {
    workspaceId: string;
    id: string;
  };
}

interface SearchAnalyticsRequest extends FastifyRequest {
  query: {
    start?: string;
    end?: string;
  };
  params: {
    workspaceId: string;
  };
}

interface FacetsRequest extends FastifyRequest {
  query: {
    q: string;
    entityTypes?: string;
    filters?: string;
  };
  params: {
    workspaceId: string;
  };
}

export class SearchController extends BaseController {
  constructor(private readonly searchService: SearchService) {
    super();
  }

  /**
   * Basic search endpoint
   * GET /api/v1/workspaces/:workspaceId/search
   */
  async search(request: SearchRequest, reply: FastifyReply): Promise<void> {
    try {
      const { workspaceId } = request.params;
      const {
        q: query,
        entityTypes,
        filters,
        sortBy,
        sortOrder,
        limit,
        offset,
      } = request.query;

      if (!query || query.trim() === '') {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'Search query is required',
          },
        });
      }

      const parsedEntityTypes = entityTypes
        ? entityTypes.split(',')
        : undefined;
      const parsedFilters = filters ? JSON.parse(filters) : undefined;
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      const parsedOffset = offset ? parseInt(offset, 10) : undefined;

      const result = await this.searchService.search(query, workspaceId, {
        entityTypes: parsedEntityTypes,
        filters: parsedFilters,
        sortBy,
        sortOrder,
        limit: parsedLimit,
        offset: parsedOffset,
        userId: request.user?.id,
      });

      reply.send({
        success: true,
        data: {
          items: result.items,
          totalCount: result.totalCount,
          facets: result.facets,
          suggestions: result.suggestions,
          executionTime: result.executionTime,
          query: result.query,
          filters: result.filters,
        },
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Advanced search with filtering
   * POST /api/v1/workspaces/:workspaceId/search/advanced
   */
  async advancedSearch(
    request: AdvancedSearchRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId } = request.params;
      const { query, filterGroup, sortBy, sortOrder, limit, offset } =
        request.body;

      if (!query || query.trim() === '') {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'Search query is required',
          },
        });
      }

      if (!filterGroup || !filterGroup.criteria) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_FILTER_GROUP',
            message: 'Filter group with criteria is required',
          },
        });
      }

      const result = await this.searchService.advancedSearch(
        query,
        workspaceId,
        filterGroup,
        {
          sortBy,
          sortOrder,
          limit,
          offset,
          userId: request.user?.id,
        }
      );

      reply.send({
        success: true,
        data: {
          items: result.items,
          totalCount: result.totalCount,
          facets: result.facets,
          suggestions: result.suggestions,
          executionTime: result.executionTime,
          query: result.query,
          filters: result.filters,
        },
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Cross-entity search
   * GET /api/v1/workspaces/:workspaceId/search/cross-entity
   */
  async crossEntitySearch(
    request: CrossEntitySearchRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId } = request.params;
      const { q: query, includeRelated } = request.query;

      if (!query || query.trim() === '') {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'Search query is required',
          },
        });
      }

      const result = await this.searchService.searchAcrossEntities(
        query,
        workspaceId,
        {
          includeRelated: includeRelated === 'true',
          userId: request.user?.id,
        }
      );

      reply.send({
        success: true,
        data: {
          unified: result.unified,
          byEntityType: result.byEntityType,
          relatedEntities: result.relatedEntities,
          aggregatedFacets: result.aggregatedFacets,
          crossReferences: result.crossReferences,
        },
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Get search suggestions
   * GET /api/v1/workspaces/:workspaceId/search/suggestions
   */
  async getSuggestions(
    request: SuggestionsRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId } = request.params;
      const { q: partialQuery, limit, context } = request.query;

      if (!partialQuery || partialQuery.trim() === '') {
        return reply.send({
          success: true,
          data: { suggestions: [] },
        });
      }

      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      const parsedContext = context ? JSON.parse(context) : undefined;

      const suggestions = await this.searchService.getSuggestions(
        partialQuery,
        workspaceId,
        {
          limit: parsedLimit,
          context: parsedContext,
        }
      );

      reply.send({
        success: true,
        data: { suggestions },
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Create saved search
   * POST /api/v1/workspaces/:workspaceId/saved-searches
   */
  async createSavedSearch(
    request: CreateSavedSearchRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const {
        name,
        description,
        query,
        filters,
        isShared,
        sharedWith,
        sortBy,
        sortOrder,
      } = request.body;

      if (!name || name.trim() === '') {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_NAME',
            message: 'Saved search name is required',
          },
        });
      }

      if (!query || query.trim() === '') {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'Search query is required',
          },
        });
      }

      const savedSearch = await this.searchService.createSavedSearch(
        userId,
        workspaceId,
        {
          name,
          description,
          query,
          filters,
          isShared,
          sharedWith,
          sortBy,
          sortOrder,
        }
      );

      reply.code(201).send({
        success: true,
        data: { savedSearch },
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Update saved search
   * PUT /api/v1/workspaces/:workspaceId/saved-searches/:id
   */
  async updateSavedSearch(
    request: UpdateSavedSearchRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const savedSearch = await this.searchService.updateSavedSearch(
        id,
        userId,
        request.body
      );

      reply.send({
        success: true,
        data: { savedSearch },
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Delete saved search
   * DELETE /api/v1/workspaces/:workspaceId/saved-searches/:id
   */
  async deleteSavedSearch(
    request: SavedSearchRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      await this.searchService.deleteSavedSearch(id, userId);

      reply.code(204).send();
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Get user's saved searches
   * GET /api/v1/workspaces/:workspaceId/saved-searches
   */
  async getSavedSearches(
    request: SavedSearchRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const savedSearches = await this.searchService.getSavedSearches(
        userId,
        workspaceId
      );

      reply.send({
        success: true,
        data: { savedSearches },
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Get shared saved searches
   * GET /api/v1/workspaces/:workspaceId/saved-searches/shared
   */
  async getSharedSavedSearches(
    request: SavedSearchRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const sharedSavedSearches =
        await this.searchService.getSharedSavedSearches(workspaceId, userId);

      reply.send({
        success: true,
        data: { savedSearches: sharedSavedSearches },
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Execute saved search
   * GET /api/v1/workspaces/:workspaceId/saved-searches/:id/execute
   */
  async executeSavedSearch(
    request: ExecuteSavedSearchRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const { limit, offset } = request.query;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      const parsedOffset = offset ? parseInt(offset, 10) : undefined;

      const result = await this.searchService.executeFromSavedSearch(
        id,
        userId,
        {
          limit: parsedLimit,
          offset: parsedOffset,
        }
      );

      reply.send({
        success: true,
        data: {
          items: result.items,
          totalCount: result.totalCount,
          facets: result.facets,
          suggestions: result.suggestions,
          executionTime: result.executionTime,
          query: result.query,
          filters: result.filters,
        },
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Set default saved search
   * POST /api/v1/workspaces/:workspaceId/saved-searches/:id/set-default
   */
  async setDefaultSavedSearch(
    request: SavedSearchRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId, id } = request.params;
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      await this.searchService.setDefaultSavedSearch(id, userId, workspaceId);

      reply.send({
        success: true,
        message: 'Default saved search updated successfully',
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Get search analytics
   * GET /api/v1/workspaces/:workspaceId/search/analytics
   */
  async getSearchAnalytics(
    request: SearchAnalyticsRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId } = request.params;
      const { start, end } = request.query;

      const timeRange =
        start && end
          ? {
              start: new Date(start),
              end: new Date(end),
            }
          : undefined;

      const analytics = await this.searchService.getSearchAnalytics(
        workspaceId,
        timeRange
      );

      reply.send({
        success: true,
        data: { analytics },
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Rebuild search index
   * POST /api/v1/workspaces/:workspaceId/search/rebuild-index
   */
  async rebuildSearchIndex(
    request: SavedSearchRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId } = request.params;

      // This operation should be restricted to admins
      if (!request.user?.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Admin access required',
          },
        });
      }

      await this.searchService.rebuildSearchIndex(workspaceId);

      reply.send({
        success: true,
        message: 'Search index rebuild initiated successfully',
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Get index statistics
   * GET /api/v1/workspaces/:workspaceId/search/index-stats
   */
  async getIndexStats(
    request: SavedSearchRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId } = request.params;

      const stats = await this.searchService.getIndexStats(workspaceId);

      reply.send({
        success: true,
        data: { stats },
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * Get search facets
   * GET /api/v1/workspaces/:workspaceId/search/facets
   */
  async getSearchFacets(
    request: FacetsRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { workspaceId } = request.params;
      const { q: query, entityTypes, filters } = request.query;

      if (!query || query.trim() === '') {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'Search query is required',
          },
        });
      }

      const parsedEntityTypes = entityTypes
        ? entityTypes.split(',')
        : undefined;
      const parsedFilters = filters ? JSON.parse(filters) : undefined;

      const facets = await this.searchService.getSearchFacets(
        query,
        workspaceId,
        {
          entityTypes: parsedEntityTypes,
          filters: parsedFilters,
        }
      );

      reply.send({
        success: true,
        data: { facets },
      });
    } catch (error) {
      this.handleError(reply, error);
    }
  }
}
