import { ICacheClient, getCacheClient } from './redis-client';
import { logger } from '../logging/logger';

export interface ICacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T>;
  invalidateForEntity(entityType: string, entityId: string): Promise<void>;
  invalidateForUser(userId: string): Promise<void>;
  invalidateForWorkspace(workspaceId: string): Promise<void>;
  warmCache<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<void>;
  getStats(): Promise<CacheStats>;
}

export interface CacheStats {
  hitCount: number;
  missCount: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
}

export interface CacheInvalidationRule {
  pattern: string;
  events: string[];
}

export interface CacheStrategy {
  shouldCache(operation: string, context: CacheContext): boolean;
  generateKey(operation: string, params: any[]): string;
  getTTL(operation: string): number;
  getInvalidationRules(operation: string): CacheInvalidationRule[];
}

export interface CacheContext {
  userId?: string;
  workspaceId?: string;
  entityType?: string;
  entityId?: string;
  operation?: string;
}

export class CacheManager implements ICacheManager {
  private readonly client: ICacheClient;
  private readonly keyPrefix: string;
  private readonly defaultTTL: number;
  private hitCount = 0;
  private missCount = 0;

  constructor(
    client?: ICacheClient,
    keyPrefix: string = 'app',
    defaultTTL: number = 3600 // 1 hour
  ) {
    this.client = client || getCacheClient();
    this.keyPrefix = keyPrefix;
    this.defaultTTL = defaultTTL;
  }

  private buildKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key);
      const value = await this.client.get<T>(fullKey);

      if (value !== null) {
        this.hitCount++;
        logger.debug('Cache hit', { key: fullKey });
      } else {
        this.missCount++;
        logger.debug('Cache miss', { key: fullKey });
      }

      return value;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      this.missCount++;
      return null;
    }
  }

  public async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const fullKey = this.buildKey(key);
      const cacheTTL = ttl || this.defaultTTL;

      await this.client.set(fullKey, value, cacheTTL);
      logger.debug('Cache set', { key: fullKey, ttl: cacheTTL });
    } catch (error) {
      logger.error('Cache set error', { key, ttl, error });
      // Don't throw error to avoid breaking the application
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      const fullKey = this.buildKey(key);
      await this.client.delete(fullKey);
      logger.debug('Cache delete', { key: fullKey });
    } catch (error) {
      logger.error('Cache delete error', { key, error });
    }
  }

  public async deletePattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.buildKey(pattern);
      const deleted = await this.client.deletePattern(fullPattern);
      logger.debug('Cache delete pattern', { pattern: fullPattern, deleted });
      return deleted;
    } catch (error) {
      logger.error('Cache delete pattern error', { pattern, error });
      return 0;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key);
      return await this.client.exists(fullKey);
    } catch (error) {
      logger.error('Cache exists error', { key, error });
      return false;
    }
  }

  public async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Cache miss - execute factory function
      logger.debug('Cache miss, executing factory', { key });
      const value = await factory();

      // Store in cache for future requests
      await this.set(key, value, ttl);

      return value;
    } catch (error) {
      logger.error('Cache getOrSet error', { key, error });
      // If cache fails, still execute factory function
      return await factory();
    }
  }

  public async invalidateForEntity(
    entityType: string,
    entityId: string
  ): Promise<void> {
    try {
      const patterns = [
        `${entityType}:${entityId}:*`,
        `${entityType}:*:${entityId}`,
        `*:${entityType}:${entityId}:*`,
        `list:${entityType}:*`,
        `search:${entityType}:*`,
        `analytics:${entityType}:*`,
      ];

      const deletePromises = patterns.map(pattern =>
        this.deletePattern(pattern)
      );
      const results = await Promise.all(deletePromises);
      const totalDeleted = results.reduce((sum, count) => sum + count, 0);

      logger.info('Cache invalidated for entity', {
        entityType,
        entityId,
        totalDeleted,
      });
    } catch (error) {
      logger.error('Cache invalidation error for entity', {
        entityType,
        entityId,
        error,
      });
    }
  }

  public async invalidateForUser(userId: string): Promise<void> {
    try {
      const patterns = [
        `user:${userId}:*`,
        `*:user:${userId}:*`,
        `tasks:assignee:${userId}:*`,
        `tasks:creator:${userId}:*`,
        `projects:owner:${userId}:*`,
        `projects:member:${userId}:*`,
        `workspaces:member:${userId}:*`,
        `notifications:${userId}:*`,
        `dashboard:${userId}:*`,
      ];

      const deletePromises = patterns.map(pattern =>
        this.deletePattern(pattern)
      );
      const results = await Promise.all(deletePromises);
      const totalDeleted = results.reduce((sum, count) => sum + count, 0);

      logger.info('Cache invalidated for user', { userId, totalDeleted });
    } catch (error) {
      logger.error('Cache invalidation error for user', { userId, error });
    }
  }

  public async invalidateForWorkspace(workspaceId: string): Promise<void> {
    try {
      const patterns = [
        `workspace:${workspaceId}:*`,
        `*:workspace:${workspaceId}:*`,
        `tasks:workspace:${workspaceId}:*`,
        `projects:workspace:${workspaceId}:*`,
        `teams:workspace:${workspaceId}:*`,
        `members:workspace:${workspaceId}:*`,
        `analytics:workspace:${workspaceId}:*`,
        `dashboard:workspace:${workspaceId}:*`,
      ];

      const deletePromises = patterns.map(pattern =>
        this.deletePattern(pattern)
      );
      const results = await Promise.all(deletePromises);
      const totalDeleted = results.reduce((sum, count) => sum + count, 0);

      logger.info('Cache invalidated for workspace', {
        workspaceId,
        totalDeleted,
      });
    } catch (error) {
      logger.error('Cache invalidation error for workspace', {
        workspaceId,
        error,
      });
    }
  }

  public async warmCache<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<void> {
    try {
      logger.debug('Warming cache', { key });
      const value = await factory();
      await this.set(key, value, ttl);
      logger.debug('Cache warmed successfully', { key });
    } catch (error) {
      logger.error('Cache warming error', { key, error });
    }
  }

  public async getStats(): Promise<CacheStats> {
    try {
      const totalRequests = this.hitCount + this.missCount;
      const hitRate =
        totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

      // Get Redis info if available
      let totalKeys = 0;
      let memoryUsage = 0;

      try {
        const client = this.client as any;
        if (client.getClient && typeof client.getClient === 'function') {
          const redisClient = client.getClient();
          const info = await redisClient.info('keyspace');
          const memInfo = await redisClient.info('memory');

          // Parse keyspace info
          const keyspaceMatch = info.match(/db\d+:keys=(\d+)/);
          if (keyspaceMatch) {
            totalKeys = parseInt(keyspaceMatch[1]);
          }

          // Parse memory info
          const memoryMatch = memInfo.match(/used_memory:(\d+)/);
          if (memoryMatch) {
            memoryUsage = parseInt(memoryMatch[1]);
          }
        }
      } catch (error) {
        logger.debug('Could not get Redis stats', { error });
      }

      return {
        hitCount: this.hitCount,
        missCount: this.missCount,
        hitRate: Math.round(hitRate * 100) / 100,
        totalKeys,
        memoryUsage,
      };
    } catch (error) {
      logger.error('Error getting cache stats', { error });
      return {
        hitCount: this.hitCount,
        missCount: this.missCount,
        hitRate: 0,
        totalKeys: 0,
        memoryUsage: 0,
      };
    }
  }

  public resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
  }
}

// Cache key builders
export class CacheKeyBuilder {
  public static task(taskId: string): string {
    return `task:${taskId}`;
  }

  public static tasksByProject(projectId: string): string {
    return `tasks:project:${projectId}`;
  }

  public static tasksByAssignee(assigneeId: string): string {
    return `tasks:assignee:${assigneeId}`;
  }

  public static tasksByWorkspace(workspaceId: string, status?: string): string {
    return status
      ? `tasks:workspace:${workspaceId}:status:${status}`
      : `tasks:workspace:${workspaceId}`;
  }

  public static project(projectId: string): string {
    return `project:${projectId}`;
  }

  public static projectsByWorkspace(workspaceId: string): string {
    return `projects:workspace:${workspaceId}`;
  }

  public static workspace(workspaceId: string): string {
    return `workspace:${workspaceId}`;
  }

  public static user(userId: string): string {
    return `user:${userId}`;
  }

  public static userWorkspaces(userId: string): string {
    return `workspaces:user:${userId}`;
  }

  public static analytics(
    entityType: string,
    entityId: string,
    metric: string
  ): string {
    return `analytics:${entityType}:${entityId}:${metric}`;
  }

  public static search(
    entityType: string,
    query: string,
    filters?: Record<string, any>
  ): string {
    const filterHash = filters ? this.hashObject(filters) : '';
    return `search:${entityType}:${this.hashString(query)}${filterHash ? `:${filterHash}` : ''}`;
  }

  public static dashboard(userId: string, workspaceId?: string): string {
    return workspaceId
      ? `dashboard:${userId}:workspace:${workspaceId}`
      : `dashboard:${userId}`;
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private static hashObject(obj: Record<string, any>): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return this.hashString(str);
  }
}

// Singleton instance
let cacheManager: CacheManager | null = null;

export function createCacheManager(
  client?: ICacheClient,
  keyPrefix?: string,
  defaultTTL?: number
): ICacheManager {
  if (!cacheManager) {
    cacheManager = new CacheManager(client, keyPrefix, defaultTTL);
  }
  return cacheManager;
}

export function getCacheManager(): ICacheManager {
  if (!cacheManager) {
    cacheManager = new CacheManager();
  }
  return cacheManager;
}
