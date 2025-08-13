import { RedisClient } from './redis-client';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';
import { logger } from '../monitoring/logging-service';
import { ICacheService } from './cache-service-interface';

export interface CacheOptions {
  ttl?: number;
  namespace?: string;
  tags?: string[];
  useMemoryFallback?: boolean;
}

export interface CacheKeyPattern {
  pattern: string;
  tags?: string[];
}

export interface CacheStats {
  redisConnected: boolean;
  memoryCache: {
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
    size: number;
    maxSize: number;
  };
  redis?: {
    connected: boolean;
    memoryUsage?: string;
    keyCount?: number;
    hitRate?: number;
    totalCommands?: number;
  };
  overall: {
    hitCount: number;
    missCount: number;
    hitRate: number;
  };
}

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

export class CacheService implements ICacheService {
  private readonly defaultTTL = 3600; // 1 hour
  private readonly keyPrefix = 'cache:';
  private readonly tagPrefix = 'tag:';
  private readonly memoryCache: LRUMemoryCache;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(private readonly redisClient: RedisClient) {
    this.memoryCache = new LRUMemoryCache(1000);
    this.startCleanupInterval();
  }

  /**
   * Connect to the cache service
   */
  async connect(): Promise<void> {
    if (!this.redisClient.isConnected()) {
      await this.redisClient.connect();
    }
  }

  /**
   * Disconnect from the cache service
   */
  async disconnect(): Promise<void> {
    if (this.redisClient.isConnected()) {
      await this.redisClient.disconnect();
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Check if cache is connected
   */
  isConnected(): boolean {
    return this.redisClient.isConnected();
  }

  private logError(message: string, context: Record<string, any>, error?: any): void {
    const logContext = {
      ...context,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      }),
    };
    logger.error(message, undefined, logContext);
  }

  private logInfo(message: string, context: Record<string, any>): void {
    logger.info(message, context);
  }

  private logDebug(message: string, context: Record<string, any>): void {
    logger.debug(message, context);
  }

  /**
   * Get value from cache (L1 memory first, then L2 Redis)
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);

    try {
      // Try L1 cache first (memory)
      const memoryValue = await this.memoryCache.get<T>(fullKey);
      if (memoryValue !== null) {
        this.logDebug('Cache hit (L1)', { key: fullKey });
        return memoryValue;
      }

      // Try L2 cache (Redis)
      const client = this.redisClient.getClient();
      const value = await client.get(fullKey);

      if (value === null) {
        this.logDebug('Cache miss', { key: fullKey });
        return null;
      }

      this.logDebug('Cache hit (L2)', { key: fullKey });
      const parsedValue = JSON.parse(value) as T;

      // Populate L1 cache with L2 value
      await this.memoryCache.set(
        fullKey,
        parsedValue,
        Math.min(this.defaultTTL, 300)
      );

      return parsedValue;
    } catch (error) {
      this.logError('Cache get error', { key: fullKey }, error);
      return null;
    }
  }

  /**
   * Set value in both L1 and L2 cache
   */
  async set(
    key: string,
    value: any,
    options?: CacheOptions | number
  ): Promise<void> {
    const fullKey = this.buildKey(key);
    
    // Handle legacy number TTL or new options object
    let ttl: number;
    let cacheOptions: CacheOptions;
    
    if (typeof options === 'number') {
      ttl = options;
      cacheOptions = { ttl };
    } else {
      cacheOptions = options || {};
      ttl = cacheOptions.ttl || this.defaultTTL;
    }
    
    const memoryTTL = Math.min(ttl, 300); // Max 5 minutes in memory

    try {
      const promises: Promise<void>[] = [];

      // Set in L1 cache (memory)
      if (cacheOptions.useMemoryFallback !== false) {
        promises.push(this.memoryCache.set(fullKey, value, memoryTTL));
      }

      // Set in L2 cache (Redis)
      const client = this.redisClient.getClient();
      const serializedValue = JSON.stringify(value);
      promises.push(
        client.setex(fullKey, ttl, serializedValue).then(() => {})
      );

      await Promise.all(promises);

      // Handle tags if provided
      if (cacheOptions.tags && cacheOptions.tags.length > 0) {
        await this.addKeyToTags(key, cacheOptions.tags, ttl);
      }

      this.logDebug('Cache set', { key: fullKey, ttl });
    } catch (error) {
      this.logError('Cache set error', { key: fullKey, ttl }, error);
      // Still try to set in memory cache
      await this.memoryCache.set(fullKey, value, memoryTTL);
    }
  }

  /**
   * Delete value from both L1 and L2 cache
   */
  async del(key: string): Promise<void> {
    const fullKey = this.buildKey(key);

    try {
      const promises: Promise<void>[] = [];

      promises.push(this.memoryCache.delete(fullKey));

      const client = this.redisClient.getClient();
      promises.push(client.del(fullKey).then(() => {}));

      await Promise.all(promises);
      this.logDebug('Cache delete', { key: fullKey });
    } catch (error) {
      this.logError('Cache delete error', { key: fullKey }, error);
    }
  }

  /**
   * Delete value from both L1 and L2 cache (alias for del)
   */
  async delete(key: string): Promise<void> {
    return this.del(key);
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      const result = await client.exists(fullKey);
      return result === 1;
    } catch (error) {
      throw new InfrastructureError(
        `Failed to check cache existence for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      await client.expire(fullKey, ttl);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to set TTL for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get TTL for key
   */
  async getTTL(key: string): Promise<number> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      return await client.ttl(fullKey);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to get TTL for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const client = this.redisClient.getClient();
      const fullPattern = this.buildKey(pattern);
      const keys = await client.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      await client.del(...keys);
      return keys.length;
    } catch (error) {
      throw new InfrastructureError(
        `Failed to invalidate cache pattern ${pattern}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      const client = this.redisClient.getClient();
      let totalDeleted = 0;

      for (const tag of tags) {
        const tagKey = this.buildTagKey(tag);
        const keys = await client.smembers(tagKey);

        if (keys.length > 0) {
          // Delete all keys associated with this tag
          const fullKeys = keys.map(key => this.buildKey(key));
          await client.del(...fullKeys);
          totalDeleted += keys.length;
        }

        // Delete the tag set itself
        await client.del(tagKey);
      }

      return totalDeleted;
    } catch (error) {
      throw new InfrastructureError(
        `Failed to invalidate cache by tags ${tags.join(', ')}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get or set pattern - if key doesn't exist, execute callback and cache result
   */
  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cachedValue = await this.get<T>(key);

    if (cachedValue !== null) {
      return cachedValue;
    }

    const value = await callback();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Increment counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      return await client.incrby(fullKey, amount);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to increment key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Decrement counter
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      return await client.decrby(fullKey, amount);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to decrement key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add item to set
   */
  async addToSet(key: string, ...values: string[]): Promise<number> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      return await client.sadd(fullKey, ...values);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to add to set ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Remove item from set
   */
  async removeFromSet(key: string, ...values: string[]): Promise<number> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      return await client.srem(fullKey, ...values);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to remove from set ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all members of set
   */
  async getSetMembers(key: string): Promise<string[]> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      return await client.smembers(fullKey);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to get set members for ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      await this.redisClient.flushAll();
    } catch (error) {
      throw new InfrastructureError(
        `Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const memoryStats = this.memoryCache.getStats();

      const stats: CacheStats = {
        redisConnected: this.redisClient.isConnected(),
        memoryCache: {
          keys: memoryStats.size,
          hits: memoryStats.hitCount,
          misses: memoryStats.missCount,
          hitRate: memoryStats.hitRate,
          evictions: memoryStats.evictionCount,
          size: memoryStats.size,
          maxSize: memoryStats.maxSize,
        },
        overall: {
          hitCount: memoryStats.hitCount,
          missCount: memoryStats.missCount,
          hitRate: memoryStats.hitRate,
        },
      };

      if (this.redisClient.isConnected()) {
        try {
          const client = this.redisClient.getClient();
          const info = await client.info('memory');
          const keyspace = await client.info('keyspace');

          // Parse memory usage
          const memoryMatch = info.match(/used_memory_human:(.+)/);
          const memoryUsage = memoryMatch?.[1]?.trim() || 'Unknown';

          // Parse total keys
          const keysMatch = keyspace.match(/keys=(\d+)/);
          const totalKeys = keysMatch?.[1] ? parseInt(keysMatch[1], 10) : 0;

          stats.redis = {
            connected: true,
            memoryUsage,
            keyCount: totalKeys,
            hitRate: 0, // Would need Redis stats module for this
            totalCommands: 0,
          };
        } catch (error) {
          this.logError('Error getting Redis stats', {}, error);
        }
      }

      return stats;
    } catch (error) {
      this.logError('Error getting cache stats', {}, error);
      return {
        redisConnected: false,
        memoryCache: {
          keys: 0,
          hits: 0,
          misses: 0,
          hitRate: 0,
          evictions: 0,
          size: 0,
          maxSize: 0,
        },
        overall: { hitCount: 0, missCount: 0, hitRate: 0 },
      };
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
        this.invalidatePattern(pattern)
      );
      const results = await Promise.all(deletePromises);
      const totalDeleted = results.reduce((sum, count) => sum + count, 0);

      this.logInfo('Cache invalidated for entity', {
        entityType,
        entityId,
        totalDeleted,
      });
    } catch (error) {
      this.logError('Cache invalidation error for entity', {
        entityType,
        entityId,
      }, error);
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
        this.invalidatePattern(pattern)
      );
      const results = await Promise.all(deletePromises);
      const totalDeleted = results.reduce((sum, count) => sum + count, 0);

      this.logInfo('Cache invalidated for user', { userId, totalDeleted });
    } catch (error) {
      this.logError('Cache invalidation error for user', { userId }, error);
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
        this.invalidatePattern(pattern)
      );
      const results = await Promise.all(deletePromises);
      const totalDeleted = results.reduce((sum, count) => sum + count, 0);

      this.logInfo('Cache invalidated for workspace', {
        workspaceId,
        totalDeleted,
      });
    } catch (error) {
      this.logError('Cache invalidation error for workspace', {
        workspaceId,
      }, error);
    }
  }

  /**
   * Health check for cache system
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency?: number;
  }> {
    let l1Healthy = true;
    let l2Healthy = true;
    const startTime = Date.now();

    try {
      // Test memory cache
      const testKey = `health-check-${Date.now()}`;
      await this.memoryCache.set(testKey, 'test', 1);
      const value = await this.memoryCache.get(testKey);
      l1Healthy = value === 'test';
      await this.memoryCache.delete(testKey);
    } catch (error) {
      this.logError('L1 cache health check failed', {}, error);
      l1Healthy = false;
    }

    try {
      // Test Redis cache
      if (this.redisClient.isConnected()) {
        const client = this.redisClient.getClient();
        const result = await client.ping();
        l2Healthy = result === 'PONG';
      }
    } catch (error) {
      this.logError('L2 cache health check failed', {}, error);
      l2Healthy = false;
    }

    const latency = Date.now() - startTime;
    const isHealthy = l1Healthy && l2Healthy;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      latency,
    };
  }

  /**
   * Warm cache with data
   */
  async warmCache<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      this.logDebug('Warming cache', { key });
      const value = await factory();
      await this.set(key, value, options);
      this.logDebug('Cache warmed successfully', { key });
    } catch (error) {
      this.logError('Cache warming error', { key }, error);
    }
  }

  private startCleanupInterval(): void {
    // Clean up expired memory cache entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        try {
          this.memoryCache.cleanup();
        } catch (error) {
          this.logError('Memory cache cleanup error', {}, error);
        }
      },
      5 * 60 * 1000
    );
  }

  /**
   * Shutdown cache service
   */
  async shutdown(): Promise<void> {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      await this.memoryCache.clear();
      this.logInfo('Cache service shutdown complete', {});
    } catch (error) {
      this.logError('Error during cache service shutdown', {}, error);
    }
  }

  private buildKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private buildTagKey(tag: string): string {
    return `${this.tagPrefix}${tag}`;
  }

  private async addKeyToTags(
    key: string,
    tags: string[],
    ttl: number
  ): Promise<void> {
    const client = this.redisClient.getClient();

    for (const tag of tags) {
      const tagKey = this.buildTagKey(tag);
      await client.sadd(tagKey, key);
      await client.expire(tagKey, ttl + 300); // Tag expires 5 minutes after the key
    }
  }
}

export class RedisCacheService {
  constructor(private redisClient: any) {}

  async get<T>(key: string): Promise<T | null> {
    const result = await this.redisClient.get(key);
    return result ? JSON.parse(result) : null;
  }

  async set(key: string, value: any, options?: CacheOptions): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (options?.ttl) {
      await this.redisClient.setex(key, options.ttl, serializedValue);
    } else {
      await this.redisClient.set(key, serializedValue);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async clear(): Promise<void> {
    await this.redisClient.flushdb();
  }

  async has(key: string): Promise<boolean> {
    const result = await this.redisClient.exists(key);
    return result === 1;
  }

  async keys(pattern = '*'): Promise<string[]> {
    return await this.redisClient.keys(pattern);
  }

  async ttl(key: string): Promise<number> {
    return await this.redisClient.ttl(key);
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.redisClient.expire(key, ttl);
  }
}
