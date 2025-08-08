import { SearchQuery } from '../value-objects/search-query.vo';
import { SearchResult } from '../value-objects/search-result.vo';
import { SearchIndexRepository } from '../repositories/search-index.repository';
import { SavedSearchRepository } from '../repositories/saved-search.repository';
import { SavedSearch } from '../entities/saved-search.entity';

export interface SearchQueryService {
  /**
   * Execute a search query
   */
  executeSearch(query: SearchQuery): Promise<SearchResult>;

  /**
   * Get search suggestions
   */
  getSuggestions(
    partialQuery: string,
    workspaceId: string,
    limit?: number
  ): Promise<string[]>;

  /**
   * Parse and validate search query string
   */
  parseQuery(
    queryString: string,
    workspaceId: string,
    options?: {
      defaultEntityTypes?: string[];
      defaultFilters?: Record<string, any>;
      userPermissions?: string[];
    }
  ): SearchQuery;

  /**
   * Build query from saved search
   */
  buildQueryFromSavedSearch(
    savedSearchId: string,
    userId: string
  ): Promise<SearchQuery>;

  /**
   * Get search facets for a query
   */
  getFacets(
    query: SearchQuery
  ): Promise<Record<string, Record<string, number>>>;

  /**
   * Validate search permissions
   */
  validateSearchPermissions(
    query: SearchQuery,
    userId: string
  ): Promise<boolean>;

  /**
   * Get search analytics
   */
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
}

export class SearchQueryServiceImpl implements SearchQueryService {
  constructor(
    private readonly searchIndexRepository: SearchIndexRepository,
    private readonly savedSearchRepository: SavedSearchRepository
  ) {}

  async executeSearch(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // Execute the search
      const result = await this.searchIndexRepository.search(query);

      // Record search analytics (would be implemented with analytics service)
      await this.recordSearchAnalytics(query, result, Date.now() - startTime);

      return result;
    } catch (error) {
      // Return empty result on error
      return SearchResult.empty(query.query, query.filters);
    }
  }

  async getSuggestions(
    partialQuery: string,
    workspaceId: string,
    limit = 10
  ): Promise<string[]> {
    return await this.searchIndexRepository.getSuggestions(
      partialQuery,
      workspaceId,
      limit
    );
  }

  parseQuery(
    queryString: string,
    workspaceId: string,
    options: {
      defaultEntityTypes?: string[];
      defaultFilters?: Record<string, any>;
      userPermissions?: string[];
    } = {}
  ): SearchQuery {
    // Parse advanced search syntax
    const parsedQuery = this.parseAdvancedSyntax(queryString);

    return SearchQuery.create({
      query: parsedQuery.query,
      workspaceId,
      entityTypes: parsedQuery.entityTypes ||
        options.defaultEntityTypes || ['task', 'project', 'comment', 'file'],
      filters: { ...options.defaultFilters, ...parsedQuery.filters },
      sortBy: parsedQuery.sortBy || 'relevance',
      sortOrder: parsedQuery.sortOrder || 'desc',
      permissions: options.userPermissions || [],
    });
  }

  async buildQueryFromSavedSearch(
    savedSearchId: string,
    userId: string
  ): Promise<SearchQuery> {
    const savedSearch =
      await this.savedSearchRepository.findById(savedSearchId);

    if (!savedSearch) {
      throw new Error('Saved search not found');
    }

    // Check access permissions
    const hasAccess = await this.savedSearchRepository.hasAccess(
      savedSearchId,
      userId
    );
    if (!hasAccess) {
      throw new Error('Access denied to saved search');
    }

    // Record usage
    await this.savedSearchRepository.recordUsage(savedSearchId, userId);

    return SearchQuery.create({
      query: savedSearch.query,
      workspaceId: savedSearch.workspaceId,
      filters: savedSearch.filters,
      sortBy: savedSearch.sortBy,
      sortOrder: savedSearch.sortOrder,
    });
  }

  async getFacets(
    query: SearchQuery
  ): Promise<Record<string, Record<string, number>>> {
    return await this.searchIndexRepository.getFacets(query);
  }

  async validateSearchPermissions(
    query: SearchQuery,
    userId: string
  ): Promise<boolean> {
    // Implementation would check user permissions against workspace and entity types
    // This is a simplified version
    return true;
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
    // This would be implemented with an analytics service
    // Placeholder implementation
    return {
      totalSearches: 0,
      uniqueUsers: 0,
      topQueries: [],
      averageResultCount: 0,
      averageResponseTime: 0,
    };
  }

  private parseAdvancedSyntax(queryString: string): {
    query: string;
    entityTypes?: string[];
    filters: Record<string, any>;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } {
    const filters: Record<string, any> = {};
    let cleanQuery = queryString;
    let entityTypes: string[] | undefined;
    let sortBy: string | undefined;
    let sortOrder: 'asc' | 'desc' | undefined;

    // Parse entity type filters: type:task
    const typeMatch = queryString.match(/type:(\w+)/g);
    if (typeMatch) {
      entityTypes = typeMatch.map(match => match.split(':')[1]);
      cleanQuery = cleanQuery.replace(/type:\w+/g, '').trim();
    }

    // Parse status filters: status:completed
    const statusMatch = queryString.match(/status:(\w+)/g);
    if (statusMatch) {
      filters.status = statusMatch.map(match => match.split(':')[1]);
      cleanQuery = cleanQuery.replace(/status:\w+/g, '').trim();
    }

    // Parse assignee filters: assignee:@username
    const assigneeMatch = queryString.match(/assignee:@(\w+)/g);
    if (assigneeMatch) {
      filters.assignee = assigneeMatch.map(match => match.split(':@')[1]);
      cleanQuery = cleanQuery.replace(/assignee:@\w+/g, '').trim();
    }

    // Parse priority filters: priority:high
    const priorityMatch = queryString.match(/priority:(\w+)/g);
    if (priorityMatch) {
      filters.priority = priorityMatch.map(match => match.split(':')[1]);
      cleanQuery = cleanQuery.replace(/priority:\w+/g, '').trim();
    }

    // Parse date filters: created:>2023-01-01
    const dateMatch = queryString.match(/created:([><=]+)(\d{4}-\d{2}-\d{2})/g);
    if (dateMatch) {
      dateMatch.forEach(match => {
        const [, operator, date] =
          match.match(/created:([><=]+)(\d{4}-\d{2}-\d{2})/) || [];
        if (operator && date) {
          if (!filters.created) filters.created = {};
          filters.created[operator] = date;
        }
      });
      cleanQuery = cleanQuery
        .replace(/created:[><=]+\d{4}-\d{2}-\d{2}/g, '')
        .trim();
    }

    // Parse tag filters: tag:urgent
    const tagMatch = queryString.match(/tag:(\w+)/g);
    if (tagMatch) {
      filters.tags = tagMatch.map(match => match.split(':')[1]);
      cleanQuery = cleanQuery.replace(/tag:\w+/g, '').trim();
    }

    // Parse sort: sort:created-desc
    const sortMatch = queryString.match(/sort:(\w+)(?:-(\w+))?/);
    if (sortMatch) {
      sortBy = sortMatch[1];
      sortOrder = (sortMatch[2] as 'asc' | 'desc') || 'desc';
      cleanQuery = cleanQuery.replace(/sort:\w+(?:-\w+)?/g, '').trim();
    }

    // Clean up extra spaces
    cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim();

    return {
      query: cleanQuery,
      entityTypes,
      filters,
      sortBy,
      sortOrder,
    };
  }

  private async recordSearchAnalytics(
    query: SearchQuery,
    result: SearchResult,
    responseTime: number
  ): Promise<void> {
    // This would record search analytics for later analysis
    // Implementation would depend on analytics service
  }
}
