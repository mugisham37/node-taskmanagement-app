import { z } from 'zod';

// Common schemas
const workspaceParamsSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID'),
});

const paginationQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : undefined)),
  offset: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : undefined)),
});

const sortingQuerySchema = z.object({
  sortBy: z
    .enum(['relevance', 'created', 'updated', 'title', 'priority', 'dueDate'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Filter criteria schema
const filterCriteriaSchema = z.object({
  field: z.string().min(1, 'Field is required'),
  operator: z.enum([
    'eq',
    'ne',
    'in',
    'nin',
    'gt',
    'gte',
    'lt',
    'lte',
    'contains',
    'startsWith',
    'endsWith',
    'between',
    'exists',
    'regex',
  ]),
  value: z.any(),
  logicalOperator: z.enum(['AND', 'OR']).optional(),
});

const filterGroupSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    criteria: z.array(filterCriteriaSchema),
    logicalOperator: z.enum(['AND', 'OR']),
    groups: z.array(filterGroupSchema).optional(),
  })
);

// Basic search schema
export const searchQuerySchema = {
  params: workspaceParamsSchema,
  querystring: z.object({
    q: z.string().min(1, 'Search query is required'),
    entityTypes: z.string().optional(),
    filters: z.string().optional(),
    ...sortingQuerySchema.shape,
    ...paginationQuerySchema.shape,
  }),
  response: {
    200: z.object({
      success: z.literal(true),
      data: z.object({
        items: z.array(
          z.object({
            id: z.string(),
            entityType: z.string(),
            entityId: z.string(),
            title: z.string(),
            content: z.string(),
            metadata: z.record(z.any()),
            relevanceScore: z.number(),
            highlights: z.record(z.array(z.string())),
            tags: z.array(z.string()),
            createdAt: z.date(),
            updatedAt: z.date(),
          })
        ),
        totalCount: z.number(),
        facets: z.record(z.record(z.number())),
        suggestions: z.array(z.string()),
        executionTime: z.number(),
        query: z.string(),
        filters: z.record(z.any()),
      }),
    }),
    400: z.object({
      success: z.literal(false),
      error: z.object({
        code: z.string(),
        message: z.string(),
      }),
    }),
  },
};

// Advanced search schema
export const advancedSearchSchema = {
  params: workspaceParamsSchema,
  body: z.object({
    query: z.string().min(1, 'Search query is required'),
    filterGroup: filterGroupSchema,
    ...sortingQuerySchema.shape,
    limit: z.number().min(1).max(100).optional(),
    offset: z.number().min(0).optional(),
  }),
  response: {
    200: searchQuerySchema.response[200],
    400: searchQuerySchema.response[400],
  },
};

// Cross-entity search schema
export const crossEntitySearchSchema = {
  params: workspaceParamsSchema,
  querystring: z.object({
    q: z.string().min(1, 'Search query is required'),
    includeRelated: z.string().optional(),
  }),
  response: {
    200: z.object({
      success: z.literal(true),
      data: z.object({
        unified: z.object({
          items: z.array(z.any()),
          totalCount: z.number(),
          facets: z.record(z.record(z.number())),
          suggestions: z.array(z.string()),
          executionTime: z.number(),
          query: z.string(),
          filters: z.record(z.any()),
        }),
        byEntityType: z.record(
          z.object({
            items: z.array(z.any()),
            totalCount: z.number(),
            facets: z.record(z.record(z.number())),
            suggestions: z.array(z.string()),
            executionTime: z.number(),
            query: z.string(),
            filters: z.record(z.any()),
          })
        ),
        relatedEntities: z.record(z.array(z.any())),
        aggregatedFacets: z.record(z.record(z.number())),
        crossReferences: z.array(
          z.object({
            sourceEntity: z.any(),
            targetEntity: z.any(),
            relationship: z.string(),
            strength: z.number(),
          })
        ),
      }),
    }),
    400: searchQuerySchema.response[400],
  },
};

// Suggestions schema
export const suggestionsSchema = {
  params: workspaceParamsSchema,
  querystring: z.object({
    q: z.string().min(1, 'Partial query is required'),
    limit: z
      .string()
      .optional()
      .transform(val => (val ? parseInt(val, 10) : undefined)),
    context: z.string().optional(),
  }),
  response: {
    200: z.object({
      success: z.literal(true),
      data: z.object({
        suggestions: z.array(z.string()),
      }),
    }),
  },
};

// Facets schema
export const facetsSchema = {
  params: workspaceParamsSchema,
  querystring: z.object({
    q: z.string().min(1, 'Search query is required'),
    entityTypes: z.string().optional(),
    filters: z.string().optional(),
  }),
  response: {
    200: z.object({
      success: z.literal(true),
      data: z.object({
        facets: z.record(z.record(z.number())),
      }),
    }),
    400: searchQuerySchema.response[400],
  },
};

// Saved search schemas
export const createSavedSearchSchema = {
  params: workspaceParamsSchema,
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
    description: z.string().max(500, 'Description too long').optional(),
    query: z.string().min(1, 'Query is required'),
    filters: z.record(z.any()).optional(),
    isShared: z.boolean().optional(),
    sharedWith: z.array(z.string().uuid()).optional(),
    ...sortingQuerySchema.shape,
  }),
  response: {
    201: z.object({
      success: z.literal(true),
      data: z.object({
        savedSearch: z.object({
          id: z.string(),
          userId: z.string(),
          workspaceId: z.string(),
          name: z.string(),
          description: z.string().optional(),
          query: z.string(),
          filters: z.record(z.any()),
          isShared: z.boolean(),
          sharedWith: z.array(z.string()),
          isDefault: z.boolean(),
          sortBy: z.string(),
          sortOrder: z.enum(['asc', 'desc']),
          createdAt: z.date(),
          updatedAt: z.date(),
        }),
      }),
    }),
    400: searchQuerySchema.response[400],
    401: z.object({
      success: z.literal(false),
      error: z.object({
        code: z.string(),
        message: z.string(),
      }),
    }),
  },
};

export const updateSavedSearchSchema = {
  params: z.object({
    workspaceId: z.string().uuid(),
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional(),
    query: z.string().min(1).optional(),
    filters: z.record(z.any()).optional(),
    isShared: z.boolean().optional(),
    sharedWith: z.array(z.string().uuid()).optional(),
    ...sortingQuerySchema.shape,
  }),
  response: {
    200: z.object({
      success: z.literal(true),
      data: z.object({
        savedSearch:
          createSavedSearchSchema.response[201].shape.data.shape.savedSearch,
      }),
    }),
    400: searchQuerySchema.response[400],
    401: createSavedSearchSchema.response[401],
    404: z.object({
      success: z.literal(false),
      error: z.object({
        code: z.string(),
        message: z.string(),
      }),
    }),
  },
};

export const executeSavedSearchSchema = {
  params: z.object({
    workspaceId: z.string().uuid(),
    id: z.string().uuid(),
  }),
  querystring: paginationQuerySchema,
  response: {
    200: searchQuerySchema.response[200],
    401: createSavedSearchSchema.response[401],
    404: updateSavedSearchSchema.response[404],
  },
};

// Search analytics schema
export const searchAnalyticsSchema = {
  params: workspaceParamsSchema,
  querystring: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }),
  response: {
    200: z.object({
      success: z.literal(true),
      data: z.object({
        analytics: z.object({
          totalSearches: z.number(),
          uniqueUsers: z.number(),
          topQueries: z.array(
            z.object({
              query: z.string(),
              count: z.number(),
            })
          ),
          averageResultCount: z.number(),
          averageResponseTime: z.number(),
        }),
      }),
    }),
  },
};

// Validation helper functions
export const validateSearchQuery = (query: string): boolean => {
  return query && query.trim().length > 0;
};

export const validateEntityTypes = (entityTypes: string[]): boolean => {
  const validTypes = ['task', 'project', 'comment', 'file', 'user', 'team'];
  return entityTypes.every(type => validTypes.includes(type));
};

export const validateFilters = (
  filters: Record<string, any>
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Validate common filter fields
  if (
    filters.status &&
    !Array.isArray(filters.status) &&
    typeof filters.status !== 'string'
  ) {
    errors.push('Status filter must be a string or array of strings');
  }

  if (
    filters.priority &&
    !Array.isArray(filters.priority) &&
    typeof filters.priority !== 'string'
  ) {
    errors.push('Priority filter must be a string or array of strings');
  }

  if (
    filters.assignee &&
    !Array.isArray(filters.assignee) &&
    typeof filters.assignee !== 'string'
  ) {
    errors.push('Assignee filter must be a string or array of strings');
  }

  if (filters.tags && !Array.isArray(filters.tags)) {
    errors.push('Tags filter must be an array of strings');
  }

  // Validate date filters
  if (filters.created) {
    if (typeof filters.created === 'object') {
      for (const [operator, value] of Object.entries(filters.created)) {
        if (!['>', '>=', '<', '<='].includes(operator)) {
          errors.push(`Invalid date operator: ${operator}`);
        }
        if (typeof value === 'string' && isNaN(Date.parse(value))) {
          errors.push(`Invalid date value: ${value}`);
        }
      }
    }
  }

  if (filters.updated) {
    if (typeof filters.updated === 'object') {
      for (const [operator, value] of Object.entries(filters.updated)) {
        if (!['>', '>=', '<', '<='].includes(operator)) {
          errors.push(`Invalid date operator: ${operator}`);
        }
        if (typeof value === 'string' && isNaN(Date.parse(value))) {
          errors.push(`Invalid date value: ${value}`);
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateSortOptions = (
  sortBy?: string,
  sortOrder?: string
): boolean => {
  const validSortFields = [
    'relevance',
    'created',
    'updated',
    'title',
    'priority',
    'dueDate',
  ];
  const validSortOrders = ['asc', 'desc'];

  if (sortBy && !validSortFields.includes(sortBy)) {
    return false;
  }

  if (sortOrder && !validSortOrders.includes(sortOrder)) {
    return false;
  }

  return true;
};

export const validatePagination = (
  limit?: number,
  offset?: number
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      errors.push('Limit must be an integer between 1 and 100');
    }
  }

  if (offset !== undefined) {
    if (!Number.isInteger(offset) || offset < 0) {
      errors.push('Offset must be a non-negative integer');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
