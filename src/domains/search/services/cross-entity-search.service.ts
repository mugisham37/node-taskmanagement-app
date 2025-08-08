import { SearchQuery } from '../value-objects/search-query.vo';
import {
  SearchResult,
  SearchResultItem,
} from '../value-objects/search-result.vo';
import { SearchIndexRepository } from '../repositories/search-index.repository';
import {
  SearchIndexingService,
  IndexableEntity,
} from './search-indexing.service';

export interface EntitySearchAdapter {
  getEntityType(): string;
  findById(id: string): Promise<IndexableEntity | null>;
  findByIds(ids: string[]): Promise<IndexableEntity[]>;
  findByWorkspace(
    workspaceId: string,
    limit?: number,
    offset?: number
  ): Promise<IndexableEntity[]>;
  getSearchableFields(): string[];
  getPermissionContext(
    entity: IndexableEntity,
    userId: string
  ): Promise<string[]>;
}

export interface CrossEntitySearchResult {
  unified: SearchResult;
  byEntityType: Record<string, SearchResult>;
  relatedEntities: Record<string, SearchResultItem[]>;
  aggregatedFacets: Record<string, Record<string, number>>;
  crossReferences: Array<{
    sourceEntity: SearchResultItem;
    targetEntity: SearchResultItem;
    relationship: string;
    strength: number;
  }>;
}

export interface SearchAnalytics {
  totalSearches: number;
  uniqueUsers: number;
  averageResponseTime: number;
  topQueries: Array<{ query: string; count: number; avgResultCount: number }>;
  entityTypeDistribution: Record<string, number>;
  searchPatterns: Array<{
    pattern: string;
    frequency: number;
    successRate: number;
  }>;
  performanceMetrics: {
    indexSize: number;
    indexingRate: number;
    searchLatency: {
      p50: number;
      p95: number;
      p99: number;
    };
  };
}

export interface CrossEntitySearchService {
  /**
   * Perform unified search across all entity types
   */
  searchUnified(query: SearchQuery): Promise<CrossEntitySearchResult>;

  /**
   * Search with entity relationship awareness
   */
  searchWithRelationships(
    query: SearchQuery,
    includeRelated?: boolean
  ): Promise<CrossEntitySearchResult>;

  /**
   * Register entity search adapter
   */
  registerEntityAdapter(adapter: EntitySearchAdapter): void;

  /**
   * Get registered entity adapters
   */
  getEntityAdapters(): EntitySearchAdapter[];

  /**
   * Bulk index entities across all types
   */
  bulkIndexAllEntities(workspaceId: string): Promise<void>;

  /**
   * Get search analytics for workspace
   */
  getSearchAnalytics(
    workspaceId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<SearchAnalytics>;

  /**
   * Get entity relationship graph
   */
  getEntityRelationshipGraph(
    entityId: string,
    entityType: string,
    depth?: number
  ): Promise<{
    nodes: Array<{
      id: string;
      type: string;
      title: string;
      metadata: Record<string, any>;
    }>;
    edges: Array<{
      source: string;
      target: string;
      relationship: string;
      weight: number;
    }>;
  }>;

  /**
   * Find similar entities based on content
   */
  findSimilarEntities(
    entityId: string,
    entityType: string,
    limit?: number
  ): Promise<SearchResultItem[]>;

  /**
   * Get search suggestions with cross-entity context
   */
  getContextualSuggestions(
    partialQuery: string,
    workspaceId: string,
    context?: {
      currentEntity?: { id: string; type: string };
      recentEntities?: Array<{ id: string; type: string }>;
    }
  ): Promise<
    Array<{
      suggestion: string;
      type: 'query' | 'entity' | 'filter';
      entityType?: string;
      confidence: number;
    }>
  >;

  /**
   * Validate search permissions across entities
   */
  validateCrossEntityPermissions(
    query: SearchQuery,
    userId: string
  ): Promise<{
    allowedEntityTypes: string[];
    restrictedFields: string[];
    permissionContext: Record<string, string[]>;
  }>;

  /**
   * Export search index for backup/migration
   */
  exportSearchIndex(
    workspaceId: string,
    entityTypes?: string[]
  ): Promise<{
    metadata: {
      exportDate: Date;
      workspaceId: string;
      entityTypes: string[];
      totalDocuments: number;
    };
    documents: Array<{ entityType: string; entityId: string; searchData: any }>;
  }>;

  /**
   * Import search index from backup
   */
  importSearchIndex(importData: {
    metadata: {
      exportDate: Date;
      workspaceId: string;
      entityTypes: string[];
      totalDocuments: number;
    };
    documents: Array<{ entityType: string; entityId: string; searchData: any }>;
  }): Promise<void>;
}

export class CrossEntitySearchServiceImpl implements CrossEntitySearchService {
  private readonly entityAdapters = new Map<string, EntitySearchAdapter>();
  private readonly searchAnalytics = new Map<string, any[]>(); // In-memory analytics storage

  constructor(
    private readonly searchIndexRepository: SearchIndexRepository,
    private readonly searchIndexingService: SearchIndexingService
  ) {}

  async searchUnified(query: SearchQuery): Promise<CrossEntitySearchResult> {
    const startTime = Date.now();

    try {
      // Execute unified search
      const unifiedResult = await this.searchIndexRepository.search(query);

      // Group results by entity type
      const byEntityType: Record<string, SearchResult> = {};
      const groupedItems: Record<string, SearchResultItem[]> = {};

      for (const item of unifiedResult.items) {
        if (!groupedItems[item.entityType]) {
          groupedItems[item.entityType] = [];
        }
        groupedItems[item.entityType].push(item);
      }

      // Create entity-specific results
      for (const [entityType, items] of Object.entries(groupedItems)) {
        byEntityType[entityType] = SearchResult.create({
          items,
          totalCount: items.length,
          facets: {},
          suggestions: [],
          executionTime: 0,
          query: query.query,
          filters: query.filters,
        });
      }

      // Find related entities
      const relatedEntities = await this.findRelatedEntities(
        unifiedResult.items,
        query.workspaceId
      );

      // Get aggregated facets
      const aggregatedFacets = await this.getAggregatedFacets(query);

      // Find cross-references
      const crossReferences = await this.findCrossReferences(
        unifiedResult.items
      );

      // Record analytics
      await this.recordSearchAnalytics(
        query,
        unifiedResult,
        Date.now() - startTime
      );

      return {
        unified: unifiedResult,
        byEntityType,
        relatedEntities,
        aggregatedFacets,
        crossReferences,
      };
    } catch (error) {
      console.error('Cross-entity search error:', error);

      const emptyResult = SearchResult.empty(query.query, query.filters);
      return {
        unified: emptyResult,
        byEntityType: {},
        relatedEntities: {},
        aggregatedFacets: {},
        crossReferences: [],
      };
    }
  }

  async searchWithRelationships(
    query: SearchQuery,
    includeRelated = true
  ): Promise<CrossEntitySearchResult> {
    const baseResult = await this.searchUnified(query);

    if (!includeRelated) {
      return baseResult;
    }

    // Enhance with relationship data
    const enhancedRelatedEntities: Record<string, SearchResultItem[]> = {};

    for (const [entityType, items] of Object.entries(baseResult.byEntityType)) {
      const relatedItems: SearchResultItem[] = [];

      for (const item of items.items) {
        const related = await this.findDirectlyRelatedEntities(
          item,
          query.workspaceId
        );
        relatedItems.push(...related);
      }

      if (relatedItems.length > 0) {
        enhancedRelatedEntities[entityType] = relatedItems;
      }
    }

    return {
      ...baseResult,
      relatedEntities: {
        ...baseResult.relatedEntities,
        ...enhancedRelatedEntities,
      },
    };
  }

  registerEntityAdapter(adapter: EntitySearchAdapter): void {
    this.entityAdapters.set(adapter.getEntityType(), adapter);
  }

  getEntityAdapters(): EntitySearchAdapter[] {
    return Array.from(this.entityAdapters.values());
  }

  async bulkIndexAllEntities(workspaceId: string): Promise<void> {
    const allEntities: IndexableEntity[] = [];

    // Collect entities from all registered adapters
    for (const adapter of this.entityAdapters.values()) {
      try {
        const entities = await adapter.findByWorkspace(workspaceId);
        allEntities.push(...entities);
      } catch (error) {
        console.error(
          `Error collecting entities for ${adapter.getEntityType()}:`,
          error
        );
      }
    }

    // Bulk index all entities
    if (allEntities.length > 0) {
      await this.searchIndexingService.bulkIndexEntities(allEntities);
    }
  }

  async getSearchAnalytics(
    workspaceId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<SearchAnalytics> {
    // This would typically query an analytics database
    // For now, return mock data based on in-memory storage

    const analytics = this.searchAnalytics.get(workspaceId) || [];

    let filteredAnalytics = analytics;
    if (timeRange) {
      filteredAnalytics = analytics.filter(
        record =>
          record.timestamp >= timeRange.start &&
          record.timestamp <= timeRange.end
      );
    }

    const totalSearches = filteredAnalytics.length;
    const uniqueUsers = new Set(filteredAnalytics.map(record => record.userId))
      .size;
    const averageResponseTime =
      filteredAnalytics.reduce((sum, record) => sum + record.responseTime, 0) /
        totalSearches || 0;

    // Calculate top queries
    const queryCount = new Map<
      string,
      { count: number; totalResults: number }
    >();
    filteredAnalytics.forEach(record => {
      const existing = queryCount.get(record.query) || {
        count: 0,
        totalResults: 0,
      };
      queryCount.set(record.query, {
        count: existing.count + 1,
        totalResults: existing.totalResults + record.resultCount,
      });
    });

    const topQueries = Array.from(queryCount.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgResultCount: stats.totalResults / stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate entity type distribution
    const entityTypeDistribution: Record<string, number> = {};
    filteredAnalytics.forEach(record => {
      record.entityTypes?.forEach((type: string) => {
        entityTypeDistribution[type] = (entityTypeDistribution[type] || 0) + 1;
      });
    });

    // Calculate performance metrics
    const responseTimes = filteredAnalytics
      .map(record => record.responseTime)
      .sort((a, b) => a - b);
    const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;

    return {
      totalSearches,
      uniqueUsers,
      averageResponseTime,
      topQueries,
      entityTypeDistribution,
      searchPatterns: [], // Would be calculated from query analysis
      performanceMetrics: {
        indexSize: 0, // Would be retrieved from index stats
        indexingRate: 0, // Would be calculated from indexing events
        searchLatency: { p50, p95, p99 },
      },
    };
  }

  async getEntityRelationshipGraph(
    entityId: string,
    entityType: string,
    depth = 2
  ): Promise<{
    nodes: Array<{
      id: string;
      type: string;
      title: string;
      metadata: Record<string, any>;
    }>;
    edges: Array<{
      source: string;
      target: string;
      relationship: string;
      weight: number;
    }>;
  }> {
    const nodes = new Map<string, any>();
    const edges: Array<{
      source: string;
      target: string;
      relationship: string;
      weight: number;
    }> = [];
    const visited = new Set<string>();

    await this.buildRelationshipGraph(
      entityId,
      entityType,
      depth,
      nodes,
      edges,
      visited
    );

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }

  async findSimilarEntities(
    entityId: string,
    entityType: string,
    limit = 10
  ): Promise<SearchResultItem[]> {
    // Get the source entity
    const adapter = this.entityAdapters.get(entityType);
    if (!adapter) {
      return [];
    }

    const sourceEntity = await adapter.findById(entityId);
    if (!sourceEntity) {
      return [];
    }

    // Extract key terms from the source entity
    const searchableContent = sourceEntity.getSearchableContent();
    const keyTerms = this.extractKeyTerms(
      searchableContent.title + ' ' + searchableContent.content
    );

    // Search for similar entities
    const similarityQuery = SearchQuery.create({
      query: keyTerms.join(' '),
      workspaceId: sourceEntity.getWorkspaceId(),
      entityTypes: [entityType],
      limit,
    });

    const result = await this.searchIndexRepository.search(similarityQuery);

    // Filter out the source entity and return results
    return result.items.filter(item => item.entityId !== entityId);
  }

  async getContextualSuggestions(
    partialQuery: string,
    workspaceId: string,
    context?: {
      currentEntity?: { id: string; type: string };
      recentEntities?: Array<{ id: string; type: string }>;
    }
  ): Promise<
    Array<{
      suggestion: string;
      type: 'query' | 'entity' | 'filter';
      entityType?: string;
      confidence: number;
    }>
  > {
    const suggestions: Array<{
      suggestion: string;
      type: 'query' | 'entity' | 'filter';
      entityType?: string;
      confidence: number;
    }> = [];

    // Get basic query suggestions
    const basicSuggestions = await this.searchIndexRepository.getSuggestions(
      partialQuery,
      workspaceId,
      5
    );
    suggestions.push(
      ...basicSuggestions.map(suggestion => ({
        suggestion,
        type: 'query' as const,
        confidence: 0.8,
      }))
    );

    // Add entity-specific suggestions based on context
    if (context?.currentEntity) {
      const entitySuggestions = await this.getEntitySpecificSuggestions(
        partialQuery,
        context.currentEntity,
        workspaceId
      );
      suggestions.push(...entitySuggestions);
    }

    // Add filter suggestions
    const filterSuggestions = this.getFilterSuggestions(partialQuery);
    suggestions.push(...filterSuggestions);

    // Sort by confidence and return top suggestions
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  }

  async validateCrossEntityPermissions(
    query: SearchQuery,
    userId: string
  ): Promise<{
    allowedEntityTypes: string[];
    restrictedFields: string[];
    permissionContext: Record<string, string[]>;
  }> {
    const allowedEntityTypes: string[] = [];
    const restrictedFields: string[] = [];
    const permissionContext: Record<string, string[]> = {};

    // Check permissions for each entity type
    for (const entityType of query.entityTypes) {
      const adapter = this.entityAdapters.get(entityType);
      if (adapter) {
        // This would check user permissions for the entity type
        // For now, assume all entity types are allowed
        allowedEntityTypes.push(entityType);

        // Get searchable fields for this entity type
        const searchableFields = adapter.getSearchableFields();
        permissionContext[entityType] = searchableFields;
      }
    }

    return {
      allowedEntityTypes,
      restrictedFields,
      permissionContext,
    };
  }

  async exportSearchIndex(
    workspaceId: string,
    entityTypes?: string[]
  ): Promise<{
    metadata: {
      exportDate: Date;
      workspaceId: string;
      entityTypes: string[];
      totalDocuments: number;
    };
    documents: Array<{ entityType: string; entityId: string; searchData: any }>;
  }> {
    const exportEntityTypes =
      entityTypes || Array.from(this.entityAdapters.keys());
    const documents: Array<{
      entityType: string;
      entityId: string;
      searchData: any;
    }> = [];

    for (const entityType of exportEntityTypes) {
      const entityDocuments = await this.searchIndexRepository.getByEntityType(
        workspaceId,
        entityType
      );

      for (const doc of entityDocuments) {
        documents.push({
          entityType: doc.entityType,
          entityId: doc.entityId,
          searchData: {
            title: doc.title,
            content: doc.content,
            metadata: doc.metadata,
            tags: doc.tags,
            permissions: doc.permissions,
          },
        });
      }
    }

    return {
      metadata: {
        exportDate: new Date(),
        workspaceId,
        entityTypes: exportEntityTypes,
        totalDocuments: documents.length,
      },
      documents,
    };
  }

  async importSearchIndex(importData: {
    metadata: {
      exportDate: Date;
      workspaceId: string;
      entityTypes: string[];
      totalDocuments: number;
    };
    documents: Array<{ entityType: string; entityId: string; searchData: any }>;
  }): Promise<void> {
    // Clear existing index for the workspace and entity types
    for (const entityType of importData.metadata.entityTypes) {
      const existingDocs = await this.searchIndexRepository.getByEntityType(
        importData.metadata.workspaceId,
        entityType
      );

      const identifiers = existingDocs.map(doc => ({
        entityType: doc.entityType,
        entityId: doc.entityId,
      }));

      if (identifiers.length > 0) {
        await this.searchIndexRepository.bulkRemove(identifiers);
      }
    }

    // Import new documents
    const searchIndexes = importData.documents.map(doc => {
      const searchIndex = {
        entityType: doc.entityType,
        entityId: doc.entityId,
        workspaceId: importData.metadata.workspaceId,
        title: doc.searchData.title,
        content: doc.searchData.content,
        metadata: doc.searchData.metadata,
        tags: doc.searchData.tags,
        permissions: doc.searchData.permissions,
      };

      return searchIndex;
    });

    // Bulk index in batches
    const batchSize = 100;
    for (let i = 0; i < searchIndexes.length; i += batchSize) {
      const batch = searchIndexes.slice(i, i + batchSize);
      // Convert to SearchIndex entities and bulk index
      // This would need proper entity creation
    }
  }

  private async findRelatedEntities(
    items: SearchResultItem[],
    workspaceId: string
  ): Promise<Record<string, SearchResultItem[]>> {
    const relatedEntities: Record<string, SearchResultItem[]> = {};

    // Group items by entity type
    const itemsByType = new Map<string, SearchResultItem[]>();
    items.forEach(item => {
      if (!itemsByType.has(item.entityType)) {
        itemsByType.set(item.entityType, []);
      }
      itemsByType.get(item.entityType)!.push(item);
    });

    // Find related entities for each type
    for (const [entityType, typeItems] of itemsByType) {
      const related: SearchResultItem[] = [];

      for (const item of typeItems.slice(0, 5)) {
        // Limit to prevent too many queries
        const itemRelated = await this.findDirectlyRelatedEntities(
          item,
          workspaceId
        );
        related.push(...itemRelated.slice(0, 3)); // Limit related items per entity
      }

      if (related.length > 0) {
        relatedEntities[entityType] = related;
      }
    }

    return relatedEntities;
  }

  private async findDirectlyRelatedEntities(
    item: SearchResultItem,
    workspaceId: string
  ): Promise<SearchResultItem[]> {
    const related: SearchResultItem[] = [];

    // Find related entities based on metadata relationships
    const metadata = item.metadata;

    // Find related by project (if task)
    if (item.entityType === 'task' && metadata.projectId) {
      const projectQuery = SearchQuery.create({
        query: '',
        workspaceId,
        entityTypes: ['project'],
        filters: { id: metadata.projectId },
        limit: 1,
      });
      const projectResult =
        await this.searchIndexRepository.search(projectQuery);
      related.push(...projectResult.items);
    }

    // Find related by assignee
    if (metadata.assigneeId) {
      const assigneeQuery = SearchQuery.create({
        query: '',
        workspaceId,
        entityTypes: ['task'],
        filters: { assigneeId: metadata.assigneeId },
        limit: 3,
      });
      const assigneeResult =
        await this.searchIndexRepository.search(assigneeQuery);
      related.push(
        ...assigneeResult.items.filter(
          relatedItem => relatedItem.entityId !== item.entityId
        )
      );
    }

    // Find related by tags
    if (item.tags.length > 0) {
      const tagQuery = SearchQuery.create({
        query: '',
        workspaceId,
        entityTypes: ['task', 'project'],
        filters: { tags: item.tags.slice(0, 2) }, // Use first 2 tags
        limit: 2,
      });
      const tagResult = await this.searchIndexRepository.search(tagQuery);
      related.push(
        ...tagResult.items.filter(
          relatedItem => relatedItem.entityId !== item.entityId
        )
      );
    }

    return related;
  }

  private async getAggregatedFacets(
    query: SearchQuery
  ): Promise<Record<string, Record<string, number>>> {
    return await this.searchIndexRepository.getFacets(query);
  }

  private async findCrossReferences(items: SearchResultItem[]): Promise<
    Array<{
      sourceEntity: SearchResultItem;
      targetEntity: SearchResultItem;
      relationship: string;
      strength: number;
    }>
  > {
    const crossReferences: Array<{
      sourceEntity: SearchResultItem;
      targetEntity: SearchResultItem;
      relationship: string;
      strength: number;
    }> = [];

    // Find cross-references between items
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const source = items[i];
        const target = items[j];

        const relationship = this.detectRelationship(source, target);
        if (relationship) {
          crossReferences.push({
            sourceEntity: source,
            targetEntity: target,
            relationship: relationship.type,
            strength: relationship.strength,
          });
        }
      }
    }

    return crossReferences.sort((a, b) => b.strength - a.strength).slice(0, 10);
  }

  private detectRelationship(
    source: SearchResultItem,
    target: SearchResultItem
  ): { type: string; strength: number } | null {
    let strength = 0;
    let relationshipType = '';

    // Check for direct relationships
    if (source.entityType === 'task' && target.entityType === 'project') {
      if (source.metadata.projectId === target.entityId) {
        return { type: 'belongs_to', strength: 1.0 };
      }
    }

    if (target.entityType === 'task' && source.entityType === 'project') {
      if (target.metadata.projectId === source.entityId) {
        return { type: 'contains', strength: 1.0 };
      }
    }

    // Check for shared assignee
    if (
      source.metadata.assigneeId &&
      target.metadata.assigneeId &&
      source.metadata.assigneeId === target.metadata.assigneeId
    ) {
      strength += 0.6;
      relationshipType = 'shared_assignee';
    }

    // Check for shared tags
    const sharedTags = source.tags.filter(tag => target.tags.includes(tag));
    if (sharedTags.length > 0) {
      strength += Math.min(sharedTags.length * 0.2, 0.4);
      relationshipType = relationshipType || 'shared_tags';
    }

    // Check for content similarity
    const contentSimilarity = this.calculateContentSimilarity(
      source.content,
      target.content
    );
    if (contentSimilarity > 0.3) {
      strength += contentSimilarity * 0.3;
      relationshipType = relationshipType || 'similar_content';
    }

    return strength > 0.3 ? { type: relationshipType, strength } : null;
  }

  private calculateContentSimilarity(
    content1: string,
    content2: string
  ): number {
    // Simple word-based similarity calculation
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private async buildRelationshipGraph(
    entityId: string,
    entityType: string,
    depth: number,
    nodes: Map<string, any>,
    edges: Array<{
      source: string;
      target: string;
      relationship: string;
      weight: number;
    }>,
    visited: Set<string>
  ): Promise<void> {
    const nodeKey = `${entityType}:${entityId}`;

    if (visited.has(nodeKey) || depth <= 0) {
      return;
    }

    visited.add(nodeKey);

    // Get the entity
    const adapter = this.entityAdapters.get(entityType);
    if (!adapter) return;

    const entity = await adapter.findById(entityId);
    if (!entity) return;

    const searchableContent = entity.getSearchableContent();

    // Add node
    nodes.set(nodeKey, {
      id: nodeKey,
      type: entityType,
      title: searchableContent.title,
      metadata: searchableContent.metadata,
    });

    // Find related entities and build edges
    const relatedQuery = SearchQuery.create({
      query: '',
      workspaceId: entity.getWorkspaceId(),
      entityTypes: Array.from(this.entityAdapters.keys()),
      limit: 20,
    });

    // Add filters based on entity metadata to find related entities
    if (searchableContent.metadata.projectId) {
      relatedQuery.withFilters({
        projectId: searchableContent.metadata.projectId,
      });
    }

    const relatedResult = await this.searchIndexRepository.search(relatedQuery);

    for (const relatedItem of relatedResult.items.slice(0, 5)) {
      const relatedNodeKey = `${relatedItem.entityType}:${relatedItem.entityId}`;

      if (relatedNodeKey !== nodeKey) {
        // Add edge
        edges.push({
          source: nodeKey,
          target: relatedNodeKey,
          relationship: 'related',
          weight: relatedItem.relevanceScore,
        });

        // Recursively build graph
        await this.buildRelationshipGraph(
          relatedItem.entityId,
          relatedItem.entityType,
          depth - 1,
          nodes,
          edges,
          visited
        );
      }
    }
  }

  private extractKeyTerms(text: string): string[] {
    // Simple key term extraction
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Remove common stop words
    const stopWords = new Set([
      'this',
      'that',
      'with',
      'have',
      'will',
      'from',
      'they',
      'been',
      'were',
      'said',
    ]);
    const filteredWords = words.filter(word => !stopWords.has(word));

    // Return most frequent terms
    const wordCount = new Map<string, number>();
    filteredWords.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    return Array.from(wordCount.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private async getEntitySpecificSuggestions(
    partialQuery: string,
    currentEntity: { id: string; type: string },
    workspaceId: string
  ): Promise<
    Array<{
      suggestion: string;
      type: 'query' | 'entity' | 'filter';
      entityType?: string;
      confidence: number;
    }>
  > {
    const suggestions: Array<{
      suggestion: string;
      type: 'query' | 'entity' | 'filter';
      entityType?: string;
      confidence: number;
    }> = [];

    // Get the current entity to provide context
    const adapter = this.entityAdapters.get(currentEntity.type);
    if (adapter) {
      const entity = await adapter.findById(currentEntity.id);
      if (entity) {
        const searchableContent = entity.getSearchableContent();

        // Suggest related terms from current entity
        const relatedTerms = this.extractKeyTerms(searchableContent.content);
        relatedTerms
          .filter(term => term.includes(partialQuery.toLowerCase()))
          .forEach(term => {
            suggestions.push({
              suggestion: term,
              type: 'query',
              entityType: currentEntity.type,
              confidence: 0.9,
            });
          });

        // Suggest entity-specific filters
        if (currentEntity.type === 'task') {
          suggestions.push({
            suggestion: `assignee:${searchableContent.metadata.assigneeId}`,
            type: 'filter',
            entityType: 'task',
            confidence: 0.7,
          });
        }
      }
    }

    return suggestions;
  }

  private getFilterSuggestions(partialQuery: string): Array<{
    suggestion: string;
    type: 'query' | 'entity' | 'filter';
    entityType?: string;
    confidence: number;
  }> {
    const suggestions: Array<{
      suggestion: string;
      type: 'query' | 'entity' | 'filter';
      entityType?: string;
      confidence: number;
    }> = [];

    const filterPatterns = [
      { pattern: 'status:', description: 'Filter by status' },
      { pattern: 'priority:', description: 'Filter by priority' },
      { pattern: 'assignee:', description: 'Filter by assignee' },
      { pattern: 'tag:', description: 'Filter by tag' },
      { pattern: 'type:', description: 'Filter by entity type' },
      { pattern: 'created:', description: 'Filter by creation date' },
      { pattern: 'updated:', description: 'Filter by update date' },
    ];

    filterPatterns.forEach(({ pattern }) => {
      if (pattern.startsWith(partialQuery.toLowerCase())) {
        suggestions.push({
          suggestion: pattern,
          type: 'filter',
          confidence: 0.6,
        });
      }
    });

    return suggestions;
  }

  private async recordSearchAnalytics(
    query: SearchQuery,
    result: SearchResult,
    responseTime: number
  ): Promise<void> {
    const analyticsRecord = {
      timestamp: new Date(),
      query: query.query,
      workspaceId: query.workspaceId,
      entityTypes: query.entityTypes,
      resultCount: result.totalCount,
      responseTime,
      userId: 'unknown', // Would be passed from context
    };

    // Store in memory (in production, this would go to a database)
    if (!this.searchAnalytics.has(query.workspaceId)) {
      this.searchAnalytics.set(query.workspaceId, []);
    }

    this.searchAnalytics.get(query.workspaceId)!.push(analyticsRecord);

    // Keep only last 1000 records per workspace
    const records = this.searchAnalytics.get(query.workspaceId)!;
    if (records.length > 1000) {
      records.splice(0, records.length - 1000);
    }
  }
}
