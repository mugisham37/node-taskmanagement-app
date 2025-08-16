/**
 * API Features utilities for handling filtering, sorting, pagination
 * Platform-agnostic query building utilities
 */

export interface QueryParams {
  page?: string;
  limit?: string;
  sort?: string;
  fields?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  tags?: string;
  [key: string]: any;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Safe condition builders to handle null/undefined values
 */
export const safeAnd = <T>(
  ...conditions: (T | null | undefined)[]
): T[] => {
  return conditions.filter(
    (c): c is T => c !== null && c !== undefined
  );
};

export const safeOr = <T>(
  ...conditions: (T | null | undefined)[]
): T[] => {
  return conditions.filter(
    (c): c is T => c !== null && c !== undefined
  );
};

/**
 * Query helpers for common patterns
 */
export const queryHelpers = {
  /**
   * Build pagination metadata
   */
  buildPaginationMeta: (total: number, page: number, limit: number) => ({
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
    hasNext: page < Math.ceil(total / limit),
    hasPrev: page > 1,
  }),

  /**
   * Parse pagination parameters
   */
  parsePaginationParams: (queryString: QueryParams) => {
    const page = Math.max(1, parseInt(queryString.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(queryString.limit || '10', 10)));
    const offset = (page - 1) * limit;
    
    return { page, limit, offset };
  },

  /**
   * Parse sort parameters
   */
  parseSortParams: (sortString?: string) => {
    if (!sortString) return [];
    
    return sortString.split(',').map(field => {
      const isDescending = field.startsWith('-');
      const fieldName = isDescending ? field.substring(1) : field;
      return { field: fieldName, direction: isDescending ? 'desc' : 'asc' as const };
    });
  },

  /**
   * Parse date range parameters
   */
  parseDateRange: (fromDate?: string, toDate?: string) => {
    const result: { from?: Date; to?: Date } = {};
    
    try {
      if (fromDate) result.from = new Date(fromDate);
      if (toDate) result.to = new Date(toDate);
    } catch (error) {
      // Invalid dates are ignored
    }
    
    return result;
  },

  /**
   * Parse tags parameter
   */
  parseTags: (tagsString?: string): string[] => {
    if (!tagsString) return [];
    return tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  },

  /**
   * Build search terms
   */
  buildSearchTerms: (searchString?: string): string[] => {
    if (!searchString) return [];
    return searchString.split(' ').map(term => term.trim()).filter(term => term.length > 0);
  }
};

/**
 * Generic API Features class for platform-agnostic query building
 */
export class APIFeatures<T = any> {
  private queryString: QueryParams;
  private filters: Record<string, any> = {};
  private sortFields: Array<{ field: string; direction: 'asc' | 'desc' }> = [];
  private paginationParams: { page: number; limit: number; offset: number };
  private searchFields: string[] = [];
  private searchTerm?: string;

  constructor(queryString: QueryParams) {
    this.queryString = queryString;
    this.paginationParams = queryHelpers.parsePaginationParams(queryString);
  }

  /**
   * Filter the query based on query parameters
   */
  filter(): APIFeatures<T> {
    const queryObj = { ...this.queryString };
    const excludedFields = [
      'page',
      'limit',
      'sort',
      'fields',
      'search',
      'fromDate',
      'toDate',
      'tags',
    ];
    excludedFields.forEach(field => delete queryObj[field]);

    // Handle special case for 'all' value
    Object.keys(queryObj).forEach(key => {
      if (queryObj[key] === 'all') {
        delete queryObj[key];
      }
    });

    // Store filters for later use
    this.filters = { ...queryObj };

    // Handle date range filtering
    const dateRange = queryHelpers.parseDateRange(
      this.queryString.fromDate,
      this.queryString.toDate
    );
    if (dateRange.from || dateRange.to) {
      this.filters.dateRange = dateRange;
    }

    // Handle tags filtering
    const tags = queryHelpers.parseTags(this.queryString.tags);
    if (tags.length > 0) {
      this.filters.tags = tags;
    }

    return this;
  }

  /**
   * Sort the query results
   */
  sort(): APIFeatures<T> {
    if (this.queryString.sort) {
      this.sortFields = queryHelpers.parseSortParams(this.queryString.sort);
    } else {
      // Default sort by createdAt descending
      this.sortFields = [{ field: 'createdAt', direction: 'desc' }];
    }

    return this;
  }

  /**
   * Set up search functionality
   */
  search(fields: string[]): APIFeatures<T> {
    this.searchFields = fields;
    this.searchTerm = this.queryString.search;
    return this;
  }

  /**
   * Get the processed query parameters
   */
  getQueryParams(): {
    filters: Record<string, any>;
    sort: Array<{ field: string; direction: 'asc' | 'desc' }>;
    pagination: { page: number; limit: number; offset: number };
    search: { fields: string[]; term?: string };
  } {
    return {
      filters: this.filters,
      sort: this.sortFields,
      pagination: this.paginationParams,
      search: { fields: this.searchFields, term: this.searchTerm }
    };
  }

  /**
   * Build pagination result
   */
  buildPaginationResult(data: T[], total: number): PaginationResult<T> {
    const { page, limit } = this.paginationParams;
    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };
  }
}

/**
 * Helper function to create APIFeatures instance
 */
export const createAPIFeatures = <T = any>(
  queryString: QueryParams
): APIFeatures<T> => {
  return new APIFeatures<T>(queryString);
};

export default {
  APIFeatures,
  createAPIFeatures,
  queryHelpers,
  safeAnd,
  safeOr
};