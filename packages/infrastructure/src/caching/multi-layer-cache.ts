import { CacheOptions, CacheService } from './interfaces';

export interface CacheStats {
  memoryHits: number;
  memoryMisses: number;
  redisHits: number;
  redisMisses: number;
  totalRequests: number;
}

export interface MultiLayerCacheConfig {
  maxMemoryItems?: number;
  memoryTTL?: number;
  enableMemoryLayer?: boolean;
  enableRedisLayer?: boolean;
}

export class MultiLayerCache implements CacheService {
  private memoryCache: Map<string, { value: any; expires: number }> = new Map();
  private stats: CacheStats = {
    memoryHits: 0,
    memoryMisses: 0,
    redisHits: 0,
    redisMisses: 0,
    totalRequests: 0,
  };

  constructor(
    private readonly redisCache: CacheService,
    private readonly config: MultiLayerCacheConfig = {}
  ) {
    // Clean up expired memory cache entries periodically
    setInterval(() => this.cleanupMemoryCache(), 60000); // Every minute
  }

  async get<T>(key: string): Promise<T | null> {
    this.stats.totalRequests++;

    // Level 1: Memory cache
    if (this.config.enableMemoryLayer !== false) {
      const memoryResult = this.getFromMemory<T>(key);
      if (memoryResult !== null) {
        this.stats.memoryHits++;
        return memoryResult;
      }
      this.stats.memoryMisses++;
    }

    // Level 2: Redis cache
    if (this.config.enableRedisLayer !== false) {
      try {
        const redisResult = await this.redisCache.get<T>(key);
        if (redisResult !== null) {
          this.stats.redisHits++;

          // Store in memory cache for faster access
          if (this.config.enableMemoryLayer !== false) {
            this.setInMemory(key, redisResult, this.config.memoryTTL || 300);
          }

          return redisResult;
        }
      } catch (error) {
        console.error('Redis cache error:', error);
      }
    }

    this.stats.redisMisses++;
    return null;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || 300; // Default 5 minutes

    // Store in memory cache
    if (this.config.enableMemoryLayer !== false) {
      this.setInMemory(key, value, Math.min(ttl, this.config.memoryTTL || 300));
    }

    // Store in Redis cache
    if (this.config.enableRedisLayer !== false) {
      try {
        await this.redisCache.set(key, value, options);
      } catch (error) {
        console.error('Redis cache set error:', error);
      }
    }
  }

  async delete(key: string): Promise<void> {
    // Remove from memory cache
    this.memoryCache.delete(key);

    // Remove from Redis cache
    if (this.config.enableRedisLayer !== false) {
      try {
        await this.redisCache.delete(key);
      } catch (error) {
        console.error('Redis cache delete error:', error);
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    // Check memory cache first
    if (this.config.enableMemoryLayer !== false) {
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && memoryEntry.expires > Date.now()) {
        return true;
      }
    }

    // Check Redis cache
    if (this.config.enableRedisLayer !== false) {
      try {
        return await this.redisCache.exists(key);
      } catch (error) {
        console.error('Redis cache exists error:', error);
        return false;
      }
    }

    return false;
  }

  async expire(key: string, ttl: number): Promise<void> {
    // Update memory cache expiration
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      memoryEntry.expires = Date.now() + ttl * 1000;
    }

    // Update Redis cache expiration
    if (this.config.enableRedisLayer !== false) {
      try {
        await this.redisCache.expire(key, ttl);
      } catch (error) {
        console.error('Redis cache expire error:', error);
      }
    }
  }

  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear Redis cache
    if (this.config.enableRedisLayer !== false) {
      try {
        await this.redisCache.clear();
      } catch (error) {
        console.error('Redis cache clear error:', error);
      }
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // For memory cache, we need to iterate through keys
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    // Invalidate in Redis cache
    if (this.config.enableRedisLayer !== false) {
      try {
        await this.redisCache.invalidatePattern(pattern);
      } catch (error) {
        console.error('Redis cache invalidatePattern error:', error);
      }
    }
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    // Memory cache doesn't support tags, so we skip this layer
    
    // Invalidate in Redis cache
    if (this.config.enableRedisLayer !== false) {
      try {
        await this.redisCache.invalidateByTags(tags);
      } catch (error) {
        console.error('Redis cache invalidateByTags error:', error);
      }
    }
  }

  async getStats(): Promise<any> {
    const redisStats = this.config.enableRedisLayer !== false 
      ? await this.redisCache.getStats() 
      : {};

    return {
      multiLayer: { ...this.stats },
      memory: {
        size: this.memoryCache.size,
        maxSize: this.config.maxMemoryItems || 1000,
      },
      redis: redisStats,
    };
  }

  /**
   * Get value from memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expires <= Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in memory cache
   */
  private setInMemory<T>(key: string, value: T, ttl: number): void {
    // Check if we need to evict old entries
    const maxItems = this.config.maxMemoryItems || 1000;
    if (this.memoryCache.size >= maxItems) {
      this.evictOldestEntries(Math.floor(maxItems * 0.1)); // Evict 10% of entries
    }

    this.memoryCache.set(key, {
      value,
      expires: Date.now() + ttl * 1000,
    });
  }

  /**
   * Evict oldest entries from memory cache
   */
  private evictOldestEntries(count: number): void {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].expires - b[1].expires);

    for (let i = 0; i < Math.min(count, entries.length); i++) {
      this.memoryCache.delete(entries[i][0]);
    }
  }

  /**
   * Clean up expired entries from memory cache
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expires <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Get cache hit rates
   */
  getHitRates(): { memory: number; redis: number; overall: number } {
    const memoryHitRate = this.stats.totalRequests > 0
      ? (this.stats.memoryHits / this.stats.totalRequests) * 100
      : 0;

    const redisHitRate = this.stats.totalRequests > 0
      ? (this.stats.redisHits / this.stats.totalRequests) * 100
      : 0;

    const overallHitRate = this.stats.totalRequests > 0
      ? ((this.stats.memoryHits + this.stats.redisHits) / this.stats.totalRequests) * 100
      : 0;

    return {
      memory: memoryHitRate,
      redis: redisHitRate,
      overall: overallHitRate,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      memoryHits: 0,
      memoryMisses: 0,
      redisHits: 0,
      redisMisses: 0,
      totalRequests: 0,
    };
  }

  /**
   * Warm cache with multiple keys
   */
  async warmCache(
    keys: Array<{
      key: string;
      fetcher: () => Promise<any>;
      options?: CacheOptions;
    }>
  ): Promise<void> {
    const promises = keys.map(async ({ key, fetcher, options }) => {
      try {
        const value = await fetcher();
        await this.set(key, value, options);
      } catch (error) {
        console.error(`Cache warming failed for key ${key}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }
}

/**
 * Create default multi-layer cache
 */
export function createMultiLayerCache(
  redisCache: CacheService,
  config?: MultiLayerCacheConfig
): MultiLayerCache {
  const defaultConfig: MultiLayerCacheConfig = {
    maxMemoryItems: 1000,
    memoryTTL: 300, // 5 minutes
    enableMemoryLayer: true,
    enableRedisLayer: true,
    ...config,
  };

  return new MultiLayerCache(redisCache, defaultConfig);
}