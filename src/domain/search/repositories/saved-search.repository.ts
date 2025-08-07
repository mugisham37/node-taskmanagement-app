import { SavedSearch } from '../entities/saved-search.entity';

export interface SavedSearchRepository {
  /**
   * Create a new saved search
   */
  create(savedSearch: SavedSearch): Promise<SavedSearch>;

  /**
   * Update an existing saved search
   */
  update(savedSearch: SavedSearch): Promise<SavedSearch>;

  /**
   * Delete a saved search
   */
  delete(id: string): Promise<void>;

  /**
   * Find a saved search by ID
   */
  findById(id: string): Promise<SavedSearch | null>;

  /**
   * Find saved searches by user ID
   */
  findByUserId(userId: string, workspaceId: string): Promise<SavedSearch[]>;

  /**
   * Find shared saved searches in a workspace
   */
  findSharedInWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<SavedSearch[]>;

  /**
   * Find default saved search for a user
   */
  findDefaultByUser(
    userId: string,
    workspaceId: string
  ): Promise<SavedSearch | null>;

  /**
   * Set a saved search as default (unsets others)
   */
  setAsDefault(id: string, userId: string, workspaceId: string): Promise<void>;

  /**
   * Find saved searches by name pattern
   */
  findByNamePattern(
    pattern: string,
    workspaceId: string,
    userId: string
  ): Promise<SavedSearch[]>;

  /**
   * Check if user has access to a saved search
   */
  hasAccess(id: string, userId: string): Promise<boolean>;

  /**
   * Get saved search usage statistics
   */
  getUsageStats(id: string): Promise<{
    usageCount: number;
    lastUsed: Date | null;
    sharedWithCount: number;
  }>;

  /**
   * Record usage of a saved search
   */
  recordUsage(id: string, userId: string): Promise<void>;

  /**
   * Find most used saved searches in workspace
   */
  findMostUsed(workspaceId: string, limit?: number): Promise<SavedSearch[]>;

  /**
   * Find recently used saved searches by user
   */
  findRecentlyUsed(
    userId: string,
    workspaceId: string,
    limit?: number
  ): Promise<SavedSearch[]>;

  /**
   * Bulk delete saved searches
   */
  bulkDelete(ids: string[]): Promise<void>;

  /**
   * Find saved searches that match a query pattern
   */
  findByQueryPattern(
    pattern: string,
    workspaceId: string
  ): Promise<SavedSearch[]>;
}
