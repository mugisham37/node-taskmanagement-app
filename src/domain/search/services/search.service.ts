import { SearchQuery } from '../domain/search/value-objects/search-query.vo';
import { SearchResult } from '../domain/search/value-objects/search-result.vo';
import { SavedSearch } from '../domain/search/entities/saved-search.entity';
import { SearchQueryService } from '../domain/search/services/search-query.service';
import {
  AdvancedFilteringService,
  FilterGroup,
} from '../domain/search/services/advanced-filtering.service';
import {
  CrossEntitySearchService,
  CrossEntitySearchResult,
} from '../domain/search/services/cross-entity-search.service';
import { SearchIndexingService } from '../domain/search/services/search-indexing.service';
import { SavedSearchRepository } from '../domain/search/repositories/saved-search.repository';
import { BaseService } from './base.service';

export interface SearchServiceInterface {
  // Basic search operations
  search(
    query: string,
    workspaceId: string,
    options?: {
      entityTypes?: string[];
      filters?: Record<string, any>;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
      userId?: string;
    }
  ): Promise<SearchResult>;

  // Advanced search with filtering
  advancedSearch(
    query: string,
    workspaceId: string,
    filterGroup: FilterGroup,
    options?: {
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
      userId?: string;
    }
  ): Promise<SearchResult>;

  // Cross-entity search
  searchAcrossEntities(
    query: string,
    workspaceId: string,
    options?: {
      includeRelated?: boolean;
      userId?: string;
    }
  ): Promise<CrossEntitySearchResult>;

  // Search suggestions
  getSuggestions(
    partialQuery: string,
    workspaceId: string,
    options?: {
      limit?: number;
      context?: {
        currentEntity?: { id: string; type: string };
        recentEntities?: Array<{ id: string; type: string }>;
      };
    }
  ): Promise<string[]>;

  // Saved searches
  createSavedSearch(
    userId: string,
    workspaceId: string,
    data: {
      name: string;
      description?: string;
      query: string;
      filters?: Record<string, any>;
      isShared?: boolean;
      sharedWith?: string[];
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<SavedSearch>;

  updateSavedSearch(
    id: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      query?: string;
      filters?: Record<string, any>;
      isShared?: boolean;
      sharedWith?: string[];
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<SavedSearch>;

  deleteSavedSearch(id: string, userId: string): Promise<void>;

  getSavedSearches(userId: string, workspaceId: string): Promise<SavedSearch[]>;

  getSharedSavedSearches(
    workspaceId: string,
    userId: string
  ): Promise<SavedSearch[]>;

  executeFromSavedSearch(
    savedSearchId: string,
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<SearchResult>;

  setDefaultSavedSearch(
    id: string,
    userId: string,
    workspaceId: string
  ): Promise<void>;

  // Search analytics
  getSearchAnalytics(
    workspaceId: string,
    timeRange?: {
      start: Date;
      end: Date;
    }
  ): Promise<{
    totalSearches: number;
    uniqueUsers: number;
    topQueries: Array<{ query: string; count: number }>;
    averageResultCount: number;
    averageResponseTime: number;
  }>;

  // Index management
  rebuildSearchIndex(workspaceId: string): Promise<void>;

  getIndexStats(workspaceId: string): Promise<{
    totalDocuments: number;
    indexSize: number;
    lastUpdated: Date;
  }>;

  // Search facets
  getSearchFacets(
    query: string,
    workspaceId: string,
    options?: {
      entityTypes?: string[];
      filters?: Record<string, any>;
    }
  ): Promise<Record<string, Record<string, number>>>;
}

export class SearchService
  extends BaseService
  implements SearchServiceInterface
{
  constructor(
    private readonly searchQueryService: SearchQueryService,
    private readonly advancedFilteringService: AdvancedFilteringService,
    private readonly crossEntitySearchService: CrossEntitySearchService,
    private readonly searchIndexingService: SearchIndexingService,
    private readonly savedSearchRepository: SavedSearchRepository
  ) {
    super();
  }

  async search(
    query: string,
    workspaceId: string,
    options: {
      entityTypes?: string[];
      filters?: Record<string, any>;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
      userId?: string;
    } = {}
  ): Promise<SearchResult> {
    try {
      const searchQuery = SearchQuery.create({
        query,
        workspaceId,
        entityTypes: options.entityTypes || [
          'task',
          'project',
          'comment',
          'file',
        ],
        filters: options.filters || {},
        sortBy: options.sortBy || 'relevance',
        sortOrder: options.sortOrder || 'desc',
        limit: options.limit || 20,
        offset: options.offset || 0,
      });

      // Validate permissions if userId provided
      if (options.userId) {
        const hasPermission =
          await this.searchQueryService.validateSearchPermissions(
            searchQuery,
            options.userId
          );
        if (!hasPermission) {
          throw new Error('Insufficient permissions for search');
        }
      }

      return await this.searchQueryService.executeSearch(searchQuery);
    } catch (error) {
      this.logger.error('Search error:', error);
      throw error;
    }
  }

  async advancedSearch(
    query: string,
    workspaceId: string,
    filterGroup: FilterGroup,
    options: {
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
      userId?: string;
    } = {}
  ): Promise<SearchResult> {
    try {
      // Validate filter criteria
      const validation =
        await this.advancedFilteringService.validateFilterCriteria(
          filterGroup.criteria
        );
      if (!validation.isValid) {
        throw new Error(
          `Invalid filter criteria: ${validation.errors.join(', ')}`
        );
      }

      const baseQuery = SearchQuery.create({
        query,
        workspaceId,
        sortBy: options.sortBy || 'relevance',
        sortOrder: options.sortOrder || 'desc',
        limit: options.limit || 20,
        offset: options.offset || 0,
      });

      const searchQuery = this.advancedFilteringService.applyAdvancedFilters(
        baseQuery,
        filterGroup
      );

      // Validate permissions if userId provided
      if (options.userId) {
        const hasPermission =
          await this.searchQueryService.validateSearchPermissions(
            searchQuery,
            options.userId
          );
        if (!hasPermission) {
          throw new Error('Insufficient permissions for search');
        }
      }

      return await this.searchQueryService.executeSearch(searchQuery);
    } catch (error) {
      this.logger.error('Advanced search error:', error);
      throw error;
    }
  }

  async searchAcrossEntities(
    query: string,
    workspaceId: string,
    options: {
      includeRelated?: boolean;
      userId?: string;
    } = {}
  ): Promise<CrossEntitySearchResult> {
    try {
      const searchQuery = SearchQuery.create({
        query,
        workspaceId,
        entityTypes: ['task', 'project', 'comment', 'file'],
      });

      // Validate permissions if userId provided
      if (options.userId) {
        const permissionValidation =
          await this.crossEntitySearchService.validateCrossEntityPermissions(
            searchQuery,
            options.userId
          );

        // Update query with allowed entity types
        const allowedQuery = searchQuery.withEntityTypes(
          permissionValidation.allowedEntityTypes
        );

        return await this.crossEntitySearchService.searchWithRelationships(
          allowedQuery,
          options.includeRelated
        );
      }

      return await this.crossEntitySearchService.searchWithRelationships(
        searchQuery,
        options.includeRelated
      );
    } catch (error) {
      this.logger.error('Cross-entity search error:', error);
      throw error;
    }
  }

  async getSuggestions(
    partialQuery: string,
    workspaceId: string,
    options: {
      limit?: number;
      context?: {
        currentEntity?: { id: string; type: string };
        recentEntities?: Array<{ id: string; type: string }>;
      };
    } = {}
  ): Promise<string[]> {
    try {
      if (options.context) {
        const contextualSuggestions =
          await this.crossEntitySearchService.getContextualSuggestions(
            partialQuery,
            workspaceId,
            options.context
          );

        return contextualSuggestions
          .filter(suggestion => suggestion.type === 'query')
          .map(suggestion => suggestion.suggestion)
          .slice(0, options.limit || 10);
      }

      return await this.searchQueryService.getSuggestions(
        partialQuery,
        workspaceId,
        options.limit
      );
    } catch (error) {
      this.logger.error('Get suggestions error:', error);
      return [];
    }
  }

  async createSavedSearch(
    userId: string,
    workspaceId: string,
    data: {
      name: string;
      description?: string;
      query: string;
      filters?: Record<string, any>;
      isShared?: boolean;
      sharedWith?: string[];
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<SavedSearch> {
    try {
      const savedSearch = SavedSearch.create({
        userId,
        workspaceId,
        name: data.name,
        description: data.description,
        query: data.query,
        filters: data.filters || {},
        isShared: data.isShared || false,
        sharedWith: data.sharedWith || [],
        isDefault: false,
        sortBy: data.sortBy || 'relevance',
        sortOrder: data.sortOrder || 'desc',
      });

      return await this.savedSearchRepository.create(savedSearch);
    } catch (error) {
      this.logger.error('Create saved search error:', error);
      throw error;
    }
  }

  async updateSavedSearch(
    id: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      query?: string;
      filters?: Record<string, any>;
      isShared?: boolean;
      sharedWith?: string[];
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<SavedSearch> {
    try {
      const existingSavedSearch = await this.savedSearchRepository.findById(id);
      if (!existingSavedSearch) {
        throw new Error('Saved search not found');
      }

      // Check ownership
      if (existingSavedSearch.userId !== userId) {
        throw new Error(
          'Access denied: You can only update your own saved searches'
        );
      }

      // Update fields
      if (data.name !== undefined) {
        existingSavedSearch.updateQuery(
          data.query || existingSavedSearch.query,
          data.filters || existingSavedSearch.filters
        );
      }
      if (data.query !== undefined || data.filters !== undefined) {
        existingSavedSearch.updateQuery(
          data.query || existingSavedSearch.query,
          data.filters || existingSavedSearch.filters
        );
      }
      if (data.isShared !== undefined || data.sharedWith !== undefined) {
        existingSavedSearch.updateSharing(
          data.isShared || existingSavedSearch.isShared,
          data.sharedWith || existingSavedSearch.sharedWith
        );
      }
      if (data.sortBy !== undefined || data.sortOrder !== undefined) {
        existingSavedSearch.updateSorting(
          data.sortBy || existingSavedSearch.sortBy,
          data.sortOrder || existingSavedSearch.sortOrder
        );
      }

      return await this.savedSearchRepository.update(existingSavedSearch);
    } catch (error) {
      this.logger.error('Update saved search error:', error);
      throw error;
    }
  }

  async deleteSavedSearch(id: string, userId: string): Promise<void> {
    try {
      const existingSavedSearch = await this.savedSearchRepository.findById(id);
      if (!existingSavedSearch) {
        throw new Error('Saved search not found');
      }

      // Check ownership
      if (existingSavedSearch.userId !== userId) {
        throw new Error(
          'Access denied: You can only delete your own saved searches'
        );
      }

      await this.savedSearchRepository.delete(id);
    } catch (error) {
      this.logger.error('Delete saved search error:', error);
      throw error;
    }
  }

  async getSavedSearches(
    userId: string,
    workspaceId: string
  ): Promise<SavedSearch[]> {
    try {
      return await this.savedSearchRepository.findByUserId(userId, workspaceId);
    } catch (error) {
      this.logger.error('Get saved searches error:', error);
      throw error;
    }
  }

  async getSharedSavedSearches(
    workspaceId: string,
    userId: string
  ): Promise<SavedSearch[]> {
    try {
      return await this.savedSearchRepository.findSharedInWorkspace(
        workspaceId,
        userId
      );
    } catch (error) {
      this.logger.error('Get shared saved searches error:', error);
      throw error;
    }
  }

  async executeFromSavedSearch(
    savedSearchId: string,
    userId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<SearchResult> {
    try {
      const searchQuery =
        await this.searchQueryService.buildQueryFromSavedSearch(
          savedSearchId,
          userId
        );

      // Apply pagination options
      const paginatedQuery = searchQuery.withPagination(
        options.limit || 20,
        options.offset || 0
      );

      return await this.searchQueryService.executeSearch(paginatedQuery);
    } catch (error) {
      this.logger.error('Execute from saved search error:', error);
      throw error;
    }
  }

  async setDefaultSavedSearch(
    id: string,
    userId: string,
    workspaceId: string
  ): Promise<void> {
    try {
      const savedSearch = await this.savedSearchRepository.findById(id);
      if (!savedSearch) {
        throw new Error('Saved search not found');
      }

      // Check access
      const hasAccess = await this.savedSearchRepository.hasAccess(id, userId);
      if (!hasAccess) {
        throw new Error('Access denied to saved search');
      }

      await this.savedSearchRepository.setAsDefault(id, userId, workspaceId);
    } catch (error) {
      this.logger.error('Set default saved search error:', error);
      throw error;
    }
  }

  async getSearchAnalytics(
    workspaceId: string,
    timeRange?: {
      start: Date;
      end: Date;
    }
  ): Promise<{
    totalSearches: number;
    uniqueUsers: number;
    topQueries: Array<{ query: string; count: number }>;
    averageResultCount: number;
    averageResponseTime: number;
  }> {
    try {
      const analytics = await this.crossEntitySearchService.getSearchAnalytics(
        workspaceId,
        timeRange
      );

      return {
        totalSearches: analytics.totalSearches,
        uniqueUsers: analytics.uniqueUsers,
        topQueries: analytics.topQueries.map(query => ({
          query: query.query,
          count: query.count,
        })),
        averageResultCount:
          analytics.topQueries.reduce(
            (sum, query) => sum + query.avgResultCount,
            0
          ) / analytics.topQueries.length || 0,
        averageResponseTime: analytics.averageResponseTime,
      };
    } catch (error) {
      this.logger.error('Get search analytics error:', error);
      throw error;
    }
  }

  async rebuildSearchIndex(workspaceId: string): Promise<void> {
    try {
      await this.searchIndexingService.rebuildWorkspaceIndex(workspaceId);
    } catch (error) {
      this.logger.error('Rebuild search index error:', error);
      throw error;
    }
  }

  async getIndexStats(workspaceId: string): Promise<{
    totalDocuments: number;
    indexSize: number;
    lastUpdated: Date;
  }> {
    try {
      return await this.searchIndexingService.getIndexingStats(workspaceId);
    } catch (error) {
      this.logger.error('Get index stats error:', error);
      throw error;
    }
  }

  async getSearchFacets(
    query: string,
    workspaceId: string,
    options: {
      entityTypes?: string[];
      filters?: Record<string, any>;
    } = {}
  ): Promise<Record<string, Record<string, number>>> {
    try {
      const searchQuery = SearchQuery.create({
        query,
        workspaceId,
        entityTypes: options.entityTypes || [
          'task',
          'project',
          'comment',
          'file',
        ],
        filters: options.filters || {},
      });

      return await this.searchQueryService.getFacets(searchQuery);
    } catch (error) {
      this.logger.error('Get search facets error:', error);
      throw error;
    }
  }
}
