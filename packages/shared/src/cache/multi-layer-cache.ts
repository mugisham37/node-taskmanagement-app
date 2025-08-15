import { LRUCache } from 'lru-cache';

export interface CacheOptions {
  memoryMaxSize?: number;
  memoryTTL?: number;
  redisTTL?: number;
  enableCompression?: boolean;
  enableMetrics?: boolean;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  memoryHits: number;
  redisHits: number;
  errors: number;
}

export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  compressed?: boolean;
}

export class MultiLayerCache {
  private memoryCache: LRUCache<string, CacheEntry>;
  private redisClient: any;
  private options: Required<CacheOptions>;
  private metrics: CacheMetrics;

  constructor(
    redisClient: any,
    options: CacheOptions = {}
  ) {
    this.redisClient = redisClient;
    this.options = {
      memoryMaxSize: 1000,
      memoryTTL: 5 * 60 * 1000, // 5 minutes
      redisTTL: 30 * 60, // 30 minutes
      enableCompression: true,
      enableMetrics: true,
      ...options,
    };

    this.memoryCache = new LRUCache<string, CacheEntry>({
      max: this.options.memoryMaxSize,
      ttl: this.options.memoryTTL,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      memoryHits: 0,
      redisHits: 0,
      errors: 0,
    };
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      // Level 1: Memory cache
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && this.isValidEntry(memoryEntry)) {
        if (this.options.enableMetrics) {
          this.metrics.hits++;
          this.metrics.memoryHits++;
        }
        return this.deserializeValue(memoryEntry.value);
      }

      // Level 2: Redis cache
      if (this.redisClient) {
        const redisValue = await this.redisClient.get(key);
        if (redisValue) {
          const entry: CacheEntry = JSON.parse(redisValue);
          if (this.isValidEntry(entry)) {
            // Store in memory cache for faster access
            this.memoryCache.set(key, entry);
            
            if (this.options.enableMetrics) {
              this.metrics.hits++;
              this.metrics.redisHits++;
            }
            
            return this.deserializeValue(entry.value);
          }
        }
      }

      if (this.options.enableMetrics) {
        this.metrics.misses++;
      }
      
      return null;
    } catch (error) {
      if (this.options.enableMetrics) {
        this.metrics.errors++;
      }
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const cacheTTL = ttl || this.options.redisTTL;
      const entry: CacheEntry<T> = {
        value: this.serializeValue(value),
        timestamp: Date.now(),
        ttl: cacheTTL * 1000, // Convert to milliseconds
      };

      // Set in memory cache
      this.memoryCache.set(key, entry);

      // Set in Redis cache
      if (this.redisClient) {
        await this.redisClient.setEx(key, cacheTTL, JSON.stringify(entry));
      }

      if (this.options.enableMetrics) {
        this.metrics.sets++;
      }
    } catch (error) {
      if (this.options.enableMetrics) {
        this.metrics.errors++;
      }
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      // Delete from memory cache
      this.memoryCache.delete(key);

      // Delete from Redis cache
      if (this.redisClient) {
        await this.redisClient.del(key);
      }

      if (this.options.enableMetrics) {
        this.metrics.deletes++;
      }
    } catch (error) {
      if (this.options.enableMetrics) {
        this.metrics.errors++;
      }
      console.error('Cache delete error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      
      if (this.redisClient) {
        await this.redisClient.flushAll();
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  // Cache invalidation patterns
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (this.redisClient) {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      }

      // For memory cache, we need to iterate through keys
      for (const key of this.memoryCache.keys()) {
        if (this.matchesPattern(key, pattern)) {
          this.memoryCache.delete(key);
        }
      }
    } catch (error) {
      console.error('Cache invalidate pattern error:', error);
    }
  }

  async invalidateTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.invalidatePattern(`*:${tag}:*`);
    }
  }

  // Cache warming
  async warmCache(entries: Array<{
    key: string;
    factory: () => Promise<any>;
    ttl?: number;
  }>): Promise<void> {
    const promises = entries.map(async ({ key, factory, ttl }) => {
      try {
        const value = await factory();
        await this.set(key, value, ttl);
      } catch (error) {
        console.error(`Failed to warm cache for key ${key}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  // Metrics and monitoring
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      memoryHits: 0,
      redisHits: 0,
      errors: 0,
    };
  }

  getHitRate(): number {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? this.metrics.hits / total : 0;
  }

  getCacheInfo(): {
    memorySize: number;
    memoryMaxSize: number;
    redisConnected: boolean;
    metrics: CacheMetrics;
    hitRate: number;
  } {
    return {
      memorySize: this.memoryCache.size,
      memoryMaxSize: this.options.memoryMaxSize,
      redisConnected: !!this.redisClient,
      metrics: this.getMetrics(),
      hitRate: this.getHitRate(),
    };
  }

  private isValidEntry(entry: CacheEntry): boolean {
    if (!entry.ttl) return true;
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private serializeValue(value: any): any {
    if (this.options.enableCompression && typeof value === 'object') {
      // Simple compression could be added here
      return value;
    }
    return value;
  }

  private deserializeValue(value: any): any {
    return value;
  }

  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(key);
  }
}