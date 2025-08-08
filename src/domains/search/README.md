# Search and Filtering System

This document provides a comprehensive overview of the Search and Filtering System implementation for the unified enterprise platform.

## Overview

The Search and Filtering System provides comprehensive search functionality across all entities in the platform, including tasks, projects, comments, and files. It supports full-text search, advanced filtering, saved searches, cross-entity relationships, and real-time search analytics.

## Architecture

### Domain Layer

#### Entities

- **SearchIndex**: Represents a searchable document in the search index
- **SavedSearch**: User-defined saved searches with filters and preferences

#### Value Objects

- **SearchQuery**: Encapsulates search parameters, filters, and pagination
- **SearchResult**: Contains search results with metadata and facets
- **SearchResultItem**: Individual search result item with relevance scoring

#### Services

- **SearchIndexingService**: Manages indexing of entities for search
- **SearchQueryService**: Executes search queries and manages suggestions
- **AdvancedFilteringService**: Handles complex filtering and saved search presets
- **CrossEntitySearchService**: Provides unified search across entity types

#### Repositories

- **SearchIndexRepository**: Manages search index storage and retrieval
- **SavedSearchRepository**: Manages saved search persistence

### Infrastructure Layer

#### PostgreSQL Implementation

- **PostgreSQLSearchIndexRepository**: Full-text search using PostgreSQL
- **PostgreSQLSavedSearchRepository**: Saved search persistence
- **Entity Adapters**: Convert domain entities to searchable format

#### Entity Adapters

- **TaskSearchAdapter**: Makes tasks searchable
- **ProjectSearchAdapter**: Makes projects searchable
- **CommentSearchAdapter**: Makes comments searchable

## Features

### 1. Full-Text Search

- PostgreSQL-based full-text search with tsvector
- Relevance scoring and ranking
- Highlighting of search terms in results
- Support for partial matching and fuzzy search

### 2. Advanced Filtering

- Complex filter criteria with logical operators (AND, OR)
- Support for multiple filter types:
  - Equality (eq, ne)
  - Range (gt, gte, lt, lte)
  - Array operations (in, nin)
  - Text operations (contains, startsWith, endsWith)
  - Date range filtering
  - Tag-based filtering
  - Existence checks

### 3. Saved Searches

- User-defined saved searches with custom names
- Shared saved searches across team members
- Default saved search per user/workspace
- Usage tracking and analytics
- System-defined search presets

### 4. Cross-Entity Search

- Unified search across tasks, projects, comments, and files
- Entity relationship detection and cross-references
- Related entity suggestions
- Entity-specific result grouping

### 5. Search Analytics

- Query performance tracking
- Popular search terms analysis
- User search behavior patterns
- Search result effectiveness metrics

### 6. Permission-Based Search

- Workspace-level access control
- Project-level permissions
- User-specific result filtering
- Role-based search restrictions

## API Endpoints

### Basic Search

```
GET /api/v1/workspaces/:workspaceId/search
Query Parameters:
- q: Search query (required)
- entityTypes: Comma-separated entity types
- filters: JSON-encoded filter object
- sortBy: Sort field (relevance, created, updated, title, priority, dueDate)
- sortOrder: Sort direction (asc, desc)
- limit: Results per page (1-100)
- offset: Pagination offset
```

### Advanced Search

```
POST /api/v1/workspaces/:workspaceId/search/advanced
Body:
{
  "query": "search terms",
  "filterGroup": {
    "criteria": [
      {
        "field": "status",
        "operator": "in",
        "value": ["todo", "in_progress"]
      }
    ],
    "logicalOperator": "AND"
  },
  "sortBy": "relevance",
  "sortOrder": "desc",
  "limit": 20,
  "offset": 0
}
```

### Cross-Entity Search

```
GET /api/v1/workspaces/:workspaceId/search/cross-entity
Query Parameters:
- q: Search query (required)
- includeRelated: Include related entities (true/false)
```

### Search Suggestions

```
GET /api/v1/workspaces/:workspaceId/search/suggestions
Query Parameters:
- q: Partial query (required)
- limit: Number of suggestions
- context: JSON-encoded context object
```

### Saved Searches

```
POST /api/v1/workspaces/:workspaceId/saved-searches
GET /api/v1/workspaces/:workspaceId/saved-searches
PUT /api/v1/workspaces/:workspaceId/saved-searches/:id
DELETE /api/v1/workspaces/:workspaceId/saved-searches/:id
GET /api/v1/workspaces/:workspaceId/saved-searches/:id/execute
POST /api/v1/workspaces/:workspaceId/saved-searches/:id/set-default
```

### Search Analytics

```
GET /api/v1/workspaces/:workspaceId/search/analytics
Query Parameters:
- start: Start date (ISO 8601)
- end: End date (ISO 8601)
```

## Database Schema

### Search Index Table

```sql
CREATE TABLE search_index (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    search_vector TEXT,
    tags TEXT[] DEFAULT '{}',
    permissions TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Saved Search Table

```sql
CREATE TABLE saved_search (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    query TEXT NOT NULL,
    filters JSONB DEFAULT '{}',
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with UUID[] DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    sort_by VARCHAR(50) DEFAULT 'relevance',
    sort_order VARCHAR(4) DEFAULT 'desc',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Usage Examples

### Basic Search

```typescript
const searchService = container.resolve<SearchService>('searchService');

const results = await searchService.search('urgent bug fix', workspaceId, {
  entityTypes: ['task', 'project'],
  filters: {
    status: ['todo', 'in_progress'],
    priority: 'high',
  },
  sortBy: 'dueDate',
  sortOrder: 'asc',
  limit: 20,
});
```

### Advanced Filtering

```typescript
const filterGroup: FilterGroup = {
  criteria: [
    {
      field: 'assignee',
      operator: 'eq',
      value: userId,
    },
    {
      field: 'dueDate',
      operator: 'lt',
      value: new Date().toISOString(),
    },
  ],
  logicalOperator: 'AND',
};

const results = await searchService.advancedSearch(
  'overdue tasks',
  workspaceId,
  filterGroup
);
```

### Creating Saved Search

```typescript
const savedSearch = await searchService.createSavedSearch(userId, workspaceId, {
  name: 'My Overdue Tasks',
  description: 'Tasks assigned to me that are overdue',
  query: 'overdue',
  filters: {
    assignee: userId,
    dueDate: { '<': new Date().toISOString() },
  },
  sortBy: 'dueDate',
  sortOrder: 'asc',
});
```

### Cross-Entity Search

```typescript
const results = await searchService.searchAcrossEntities(
  'project alpha',
  workspaceId,
  {
    includeRelated: true,
  }
);

// Results include:
// - unified: Combined search results
// - byEntityType: Results grouped by entity type
// - relatedEntities: Related entities for each result
// - crossReferences: Relationships between entities
```

## Performance Considerations

### Indexing Strategy

- Automatic indexing on entity create/update/delete
- Bulk indexing for initial setup and migrations
- Background index optimization
- Configurable indexing batch sizes

### Caching

- Search result caching with intelligent invalidation
- Suggestion caching for common queries
- Facet caching for filter options
- Permission context caching

### Query Optimization

- PostgreSQL full-text search indexes
- Composite indexes for common filter combinations
- Partial indexes for active/recent content
- Query plan analysis and optimization

## Security

### Access Control

- Workspace-level isolation
- Project-level permissions
- User-specific result filtering
- Role-based access restrictions

### Data Protection

- Search query sanitization
- SQL injection prevention
- Permission validation on all queries
- Audit logging for search activities

## Monitoring and Analytics

### Search Metrics

- Query performance tracking
- Result relevance scoring
- User engagement metrics
- Search success rates

### System Health

- Index size and growth monitoring
- Query latency tracking
- Error rate monitoring
- Resource utilization metrics

## Configuration

### Environment Variables

```
SEARCH_INDEX_BATCH_SIZE=100
SEARCH_CACHE_TTL=300
SEARCH_MAX_RESULTS=1000
SEARCH_SUGGESTION_LIMIT=10
SEARCH_ANALYTICS_RETENTION_DAYS=90
```

### Feature Flags

- Advanced filtering enabled
- Cross-entity search enabled
- Search analytics enabled
- Real-time indexing enabled

## Testing

### Unit Tests

- Domain entity tests
- Service layer tests
- Repository implementation tests
- Validation logic tests

### Integration Tests

- End-to-end search workflows
- Cross-entity relationship tests
- Permission validation tests
- Performance benchmarks

### Load Testing

- Concurrent search query handling
- Large dataset search performance
- Index update performance under load
- Memory usage optimization

## Future Enhancements

### Planned Features

- Elasticsearch integration option
- Machine learning-based relevance scoring
- Natural language query processing
- Voice search capabilities
- Advanced analytics dashboard

### Scalability Improvements

- Distributed search architecture
- Horizontal scaling support
- Multi-region search replication
- Advanced caching strategies

## Troubleshooting

### Common Issues

1. **Slow search performance**: Check index health and query optimization
2. **Missing results**: Verify indexing status and permissions
3. **Incorrect relevance**: Review scoring algorithm and content quality
4. **Memory usage**: Monitor index size and implement cleanup procedures

### Debug Tools

- Search query analyzer
- Index health checker
- Permission validator
- Performance profiler

## Contributing

When contributing to the search system:

1. Follow the domain-driven design patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Consider performance implications
5. Validate security and permissions
6. Add monitoring and logging

## Support

For issues related to the search system:

- Check the troubleshooting guide
- Review system logs and metrics
- Validate configuration settings
- Test with minimal datasets
- Contact the development team for complex issues
