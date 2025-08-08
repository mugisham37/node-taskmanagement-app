/**
 * Consolidated Cache Manager
 * Multi-level caching strategy with L1 (Memory) and L2 (Redis) cache
 */

import { logger } from '../logging/logger';
import { ICacheClient, getCacheClient } from './redis-client';

export interface IMemoryCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): number;
  getStats(): MemoryCacheStats;
}

export interface MemoryCacheStats {
  size: number;
  maxSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictionCount: number;
}

export interface CacheStats {
  l1: MemoryCacheStats;
  l2: {
    hitCount: number;
    missCount: number;
    hitRate: number;
    totalKeys: number;
    memoryUsage: number;
  };
  overall: {
    hitCount: number;
    missCount: number;
    hitRate: number;
  };
}

export interface CacheConfig {
  l1MaxSize?: number;
  l1DefaultTTL?: number;
  l2DefaultTTL?: number;
  keyPrefix?: string;
  enableL1?: boolean;
  enableL2?: boolean;
}

/**
 * LRU Memory Cache Implementation
 */
class LRUMemoryCache implements IMemoryCache {
  private cache = new Map<string, { value: any; expiry: number }>();
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  constructor(private readonly maxSize: number = 1000) {}

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);

    if (!item) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.missCount++;
      return null;
    }

    // Update access order
    this.accessOrder.set(key, ++this.accessCounter);
    this.hitCount++;

    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const expiry = Date.now() + ttlSeconds * 1000;

    // If at capacity and key doesn't exist, evict LRU item
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, { value, expiry });
    this.accessOrder.set(key, ++this.accessCounter);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.accessOrder.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): MemoryCacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate =
      totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: Math.round(hitRate * 100) / 100,
      evictionCount: this.evictionCount,
    };
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruAccess = Infinity;

    for (const [key, access] of this.accessOrder) {
      if (access < lruAccess) {
        lruAccess = access;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessOrder.delete(lruKey);
      this.evictionCount++;
    }
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.cache) {
      if (now > item.expiry) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }
  }
}

/**
 * Consolidated Cache Manager with Multi-level Caching
 */
export class ConsolidatedCacheManager {
  private readonly l1Cache: IMemoryCache;
  private readonly l2Cache: ICacheClient;
  private readonly config: Required<CacheConfig>;
  private readonly keyPrefix: string;
  private cleanupInterval?: NodeJS.Timeout;

  // Statistics
  private l2HitCount = 0;
  private l2MissCount = 0;

  constructor(
    config: CacheConfig = {},
    l1Cache?: IMemoryCache,
    l2Cache?: ICacheClient
  ) {
    this.config = {
      l1MaxSize: config.l1MaxSize || 1000,
      l1DefaultTTL: config.l1DefaultTTL || 300, // 5 minutes
      l2DefaultTTL: config.l2DefaultTTL || 3600, // 1 hour
      keyPrefix: config.keyPrefix || 'app',
      enableL1: config.enableL1 !== false,
      enableL2: config.enableL2 !== false,
    };

    this.keyPrefix = this.config.keyPrefix;
    this.l1Cache = l1Cache || new LRUMemoryCache(this.config.l1MaxSize);
    this.l2Cache = l2Cache || getCacheClient();

    // Start cleanup interval for L1 cache
    if (this.config.enableL1) {
      this.startCleanupInterval();
    }
  }

  /**
   * Get value from cache (L1 first, then L2)
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);

    try {
      // Try L1 cache first
      if (this.config.enableL1) {
        const l1Value = await this.l1Cache.get<T>(fullKey);
        if (l1Value !== null) {
          logger.debug('Cache hit (L1)', { key: fullKey });
          return l1Value;
        }
      }

      // Try L2 cache
      if (this.config.enableL2) {
        const l2Value = await this.l2Cache.get<T>(fullKey);
        if (l2Value !== null) {
          this.l2HitCount++;
          logger.debug('Cache hit (L2)', { key: fullKey });

          // Populate L1 cache with L2 value
          if (this.config.enableL1) {
            await this.l1Cache.set(fullKey, l2Value, this.config.l1DefaultTTL);
          }

          return l2Value;
        }
        this.l2MissCount++;
      }

      logger.debug('Cache miss', { key: fullKey });
      return null;
    } catch (error) {
      logger.error('Cache get error', { key: fullKey, error });
      return null;
    }
  }

  /**
   * Set value in both L1 and L2 cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.buildKey(key);
    const l1TTL = Math.min(
      ttl || this.config.l1DefaultTTL,
      this.config.l1DefaultTTL
    );
    const l2TTL = ttl || this.config.l2DefaultTTL;

    try {
      const promises: Promise<void>[] = [];

      // Set in L1 cache
      if (this.config.enableL1) {
        promises.push(this.l1Cache.set(fullKey, value, l1TTL));
      }

      // Set in L2 cache
      if (this.config.enableL2) {
        promises.push(this.l2Cache.set(fullKey, value, l2TTL));
      }

      await Promise.all(promises);
      logger.debug('Cache set', { key: fullKey, l1TTL, l2TTL });
    } catch (error) {
      logger.error('Cache set error', { key: fullKey, ttl, error });
      // Don't throw to avoid breaking application
    }
  }

  /**
   * Delete from both L1 and L2 cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);

    try {
      const promises: Promise<void>[] = [];

      if (this.config.enableL1) {
        promises.push(this.l1Cache.delete(fullKey));
      }

      if (this.config.enableL2) {
        promises.push(this.l2Cache.delete(fullKey));
      }

      await Promise.all(promises);
      logger.debug('Cache delete', { key: fullKey });
    } catch (error) {
      logger.error('Cache delete error', { key: fullKey, error });
    }
  }

  /**
   * Delete pattern from L2 cache (L1 doesn't support patterns)
   */
  async deletePattern(pattern: string): Promise<number> {
    const fullPattern = this.buildKey(pattern);

    try {
      if (!this.config.enableL2) {
        return 0;
      }

      const deleted = await this.l2Cache.deletePattern(fullPattern);
      logger.debug('Cache delete pattern', { pattern: fullPattern, deleted });
      return deleted;
    } catch (error) {
      logger.error('Cache delete pattern error', {
        pattern: fullPattern,
        error,
      });
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);

    try {
      // Check L1 first
      if (this.config.enableL1) {
        const l1Value = await this.l1Cache.get(fullKey);
        if (l1Value !== null) {
          return true;
        }
      }

      // Check L2
      if (this.config.enableL2) {
        return await this.l2Cache.exists(fullKey);
      }

      return false;
    } catch (error) {
      logger.error('Cache exists error', { key: fullKey, error });
      return false;
    }
  }

  /**
   * Get or set pattern with cache-aside strategy
   */
  async getOrSet<T>(
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

  /**
   * Invalidate cache for entity
   */
  async invalidateForEntity(
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

  /**
   * Invalidate cache for user
   */
  async invalidateForUser(userId: string): Promise<void> {
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

  /**
   * Invalidate cache for workspace
   */
  async invalidateForWorkspace(workspaceId: string): Promise<void> {
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

  /**
   * Warm cache with data
   */
  async warmCache<T>(
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

  /**
   * Get comprehensive cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const l1Stats = this.config.enableL1
        ? this.l1Cache.getStats()
        : {
            size: 0,
            maxSize: 0,
            hitCount: 0,
            missCount: 0,
            hitRate: 0,
            evictionCount: 0,
          };

      // L2 stats
      const l2TotalRequests = this.l2HitCount + this.l2MissCount;
      const l2HitRate =
        l2TotalRequests > 0 ? (this.l2HitCount / l2TotalRequests) * 100 : 0;

      let l2TotalKeys = 0;
      let l2MemoryUsage = 0;

      if (this.config.enableL2) {
        try {
          const client = this.l2Cache as any;
          if (client.getClient && typeof client.getClient === 'function') {
            const redisClient = client.getClient();
            const info = await redisClient.info('keyspace');
            const memInfo = await redisClient.info('memory');

            // Parse keyspace info
            const keyspaceMatch = info.match(/db\d+:keys=(\d+)/);
            if (keyspaceMatch) {
              l2TotalKeys = parseInt(keyspaceMatch[1]);
            }

            // Parse memory info
            const memoryMatch = memInfo.match(/used_memory:(\d+)/);
            if (memoryMatch) {
              l2MemoryUsage = parseInt(memoryMatch[1]);
            }
          }
        } catch (error) {
          logger.debug('Could not get L2 cache stats', { error });
        }
      }

      // Overall stats
      const overallHitCount = l1Stats.hitCount + this.l2HitCount;
      const overallMissCount = l1Stats.missCount + this.l2MissCount;
      const overallTotalRequests = overallHitCount + overallMissCount;
      const overallHitRate =
        overallTotalRequests > 0
          ? (overallHitCount / overallTotalRequests) * 100
          : 0;

      return {
        l1: l1Stats,
        l2: {
          hitCount: this.l2HitCount,
          missCount: this.l2MissCount,
          hitRate: Math.round(l2HitRate * 100) / 100,
          totalKeys: l2TotalKeys,
          memoryUsage: l2MemoryUsage,
        },
        overall: {
          hitCount: overallHitCount,
          missCount: overallMissCount,
          hitRate: Math.round(overallHitRate * 100) / 100,
        },
      };
    } catch (error) {
      logger.error('Error getting cache stats', { error });
      return {
        l1: {
          size: 0,
          maxSize: 0,
          hitCount: 0,
          missCount: 0,
          hitRate: 0,
          evictionCount: 0,
        },
        l2: {
          hitCount: 0,
          missCount: 0,
          hitRate: 0,
          totalKeys: 0,
          memoryUsage: 0,
        },
        overall: { hitCount: 0, missCount: 0, hitRate: 0 },
      };
    }
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      if (this.config.enableL1) {
        promises.push(this.l1Cache.clear());
      }

      if (this.config.enableL2) {
        promises.push(this.l2Cache.flushAll());
      }

      await Promise.all(promises);
      logger.info('All caches cleared');
    } catch (error) {
      logger.error('Error clearing caches', { error });
    }
  }

  /**
   * Health check for cache system
   */
  async healthCheck(): Promise<{
    l1Healthy: boolean;
    l2Healthy: boolean;
    overall: boolean;
  }> {
    let l1Healthy = true;
    let l2Healthy = true;

    try {
      // Test L1 cache
      if (this.config.enableL1) {
        const testKey = `health-check-${Date.now()}`;
        await this.l1Cache.set(testKey, 'test', 1);
        const value = await this.l1Cache.get(testKey);
        l1Healthy = value === 'test';
        await this.l1Cache.delete(testKey);
      }
    } catch (error) {
      logger.error('L1 cache health check failed', { error });
      l1Healthy = false;
    }

    try {
      // Test L2 cache
      if (this.config.enableL2) {
        const result = await this.l2Cache.ping();
        l2Healthy = result === 'PONG';
      }
    } catch (error) {
      logger.error('L2 cache health check failed', { error });
      l2Healthy = false;
    }

    return {
      l1Healthy,
      l2Healthy,
      overall: l1Healthy && l2Healthy,
    };
  }

  /**
   * Shutdown cache manager
   */
  async shutdown(): Promise<void> {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      if (this.config.enableL2) {
        await this.l2Cache.disconnect();
      }

      logger.info('Cache manager shutdown complete');
    } catch (error) {
      logger.error('Error during cache manager shutdown', { error });
    }
  }

  private buildKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  private startCleanupInterval(): void {
    // Clean up expired L1 cache entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        try {
          if (this.l1Cache instanceof LRUMemoryCache) {
            (this.l1Cache as any).cleanup();
          }
        } catch (error) {
          logger.error('L1 cache cleanup error', { error });
        }
      },
      5 * 60 * 1000
    );
  }
}

// Singleton instance
let consolidatedCacheManager: ConsolidatedCacheManager | null = null;

export function createConsolidatedCacheManager(
  config?: CacheConfig,
  l1Cache?: IMemoryCache,
  l2Cache?: ICacheClient
): ConsolidatedCacheManager {
  if (!consolidatedCacheManager) {
    consolidatedCacheManager = new ConsolidatedCacheManager(
      config,
      l1Cache,
      l2Cache
    );
  }
  return consolidatedCacheManager;
}

export function getConsolidatedCacheManager(): ConsolidatedCacheManager {
  if (!consolidatedCacheManager) {
    consolidatedCacheManager = new ConsolidatedCacheManager();
  }
  return consolidatedCacheManager;
}
