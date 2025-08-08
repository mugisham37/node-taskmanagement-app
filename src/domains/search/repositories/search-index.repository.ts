import { SearchIndex } from '../entities/search-index.entity';
import { SearchQuery } from '../value-objects/search-query.vo';
import { SearchResult } from '../value-objects/search-result.vo';

export interface SearchIndexRepository {
  /**
   * Index a document for search
   */
  index(searchIndex: SearchIndex): Promise<void>;

  /**
   * Update an existing search index
   */
  update(searchIndex: SearchIndex): Promise<void>;

  /**
   * Remove a document from the search index
   */
  remove(entityType: string, entityId: string): Promise<void>;

  /**
   * Remove all documents for a workspace
   */
  removeByWorkspace(workspaceId: string): Promise<void>;

  /**
   * Perform a search query
   */
  search(query: SearchQuery): Promise<SearchResult>;

  /**
   * Get search suggestions based on partial query
   */
  getSuggestions(
    partialQuery: string,
    workspaceId: string,
    limit?: number
  ): Promise<string[]>;

  /**
   * Get facets for a search query
   */
  getFacets(
    query: SearchQuery
  ): Promise<Record<string, Record<string, number>>>;

  /**
   * Bulk index multiple documents
   */
  bulkIndex(searchIndexes: SearchIndex[]): Promise<void>;

  /**
   * Bulk remove multiple documents
   */
  bulkRemove(
    identifiers: Array<{ entityType: string; entityId: string }>
  ): Promise<void>;

  /**
   * Rebuild the entire search index for a workspace
   */
  rebuildIndex(workspaceId: string): Promise<void>;

  /**
   * Get index statistics
   */
  getIndexStats(workspaceId: string): Promise<{
    totalDocuments: number;
    indexSize: number;
    lastUpdated: Date;
  }>;

  /**
   * Optimize the search index
   */
  optimizeIndex(workspaceId: string): Promise<void>;

  /**
   * Check if a document exists in the index
   */
  exists(entityType: string, entityId: string): Promise<boolean>;

  /**
   * Get a document from the index
   */
  getById(entityType: string, entityId: string): Promise<SearchIndex | null>;

  /**
   * Get all documents for an entity type in a workspace
   */
  getByEntityType(
    workspaceId: string,
    entityType: string,
    limit?: number,
    offset?: number
  ): Promise<SearchIndex[]>;
}
