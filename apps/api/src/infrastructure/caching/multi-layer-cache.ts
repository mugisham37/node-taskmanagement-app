import { LRUCache } from 'lru-cache';
import { Redis } from 'ioredis';
import { Container } from '../../shared/container/Container';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  serialize?: boolean; // Whether to serialize/deserialize data
}

export interface CacheStats {
  memoryHits: number;
  memoryMisses: number;
  redisHits: number;
  redisMisses: number;
  totalRequests: number;
}

export class MultiLayerCache {
  private memoryCache: LRUCache<string, any>;
  private redis: Redis;
  private stats: CacheStats = {
    memoryHits: 0,
    memoryMisses: 0,
    redisHits: 0,
    redisMisses: 0,
    totalRequests: 0,
  };

  constructor(
    private container: Container,
    options: {
      maxMemoryItems?: number;
      memoryTTL?: number;
    } = {}
  ) {
    this.memoryCache = new LRUCache({
      max: options.maxMemoryItems || 1000,
      ttl: (options.memoryTTL || 300) * 1000, // Convert to milliseconds
    });

    this.redis = this.container.resolve<Redis>('RedisClient');
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    this.stats.totalRequests++;

    // Level 1: Memory cache
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult !== undefined) {
      this.stats.memoryHits++;
      return memoryResult;
    }
    this.stats.memoryMisses++;

    // Level 2: Redis cache
    try {
      const redisResult = await this.redis.get(key);
      if (redisResult !== null) {
        this.stats.redisHits++;
        const parsed =
          options.serialize !== false ? JSON.parse(redisResult) : redisResult;

        // Store in memory cache for faster access
        this.memoryCache.set(key, parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Redis cache error:', error);
    }

    this.stats.redisMisses++;
    return null;
  }

  async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<void> {
    const ttl = options.ttl || 300; // Default 5 minutes
    const serializedValue =
      options.serialize !== false ? JSON.stringify(value) : value;

    // Store in memory cache
    this.memoryCache.set(key, value);

    // Store in Redis cache
    try {
      if (ttl > 0) {
        await this.redis.setex(key, ttl, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }

      // Handle cache tags for invalidation
      if (options.tags && options.tags.length > 0) {
        await this.addCacheTags(key, options.tags);
      }
    } catch (error) {
      console.error('Redis cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    // Remove from memory cache
    this.memoryCache.delete(key);

    // Remove from Redis cache
    try {
      await this.redis.del(key);
      await this.removeCacheTags(key);
    } catch (error) {
      console.error('Redis cache delete error:', error);
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    try {
      const tagKey = `cache_tag:${tag}`;
      const keys = await this.redis.smembers(tagKey);

      if (keys.length > 0) {
        // Remove from memory cache
        keys.forEach(key => this.memoryCache.delete(key));

        // Remove from Redis cache
        await this.redis.del(...keys);

        // Remove the tag set
        await this.redis.del(tagKey);
      }
    } catch (error) {
      console.error('Cache invalidation by tag error:', error);
    }
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        // Remove from memory cache
        keys.forEach(key => this.memoryCache.delete(key));

        // Remove from Redis cache
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidation by pattern error:', error);
    }
  }

  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear Redis cache (be careful with this in production)
    try {
      await this.redis.flushdb();
    } catch (error) {
      console.error('Redis cache clear error:', error);
    }
  }

  private async addCacheTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    tags.forEach(tag => {
      const tagKey = `cache_tag:${tag}`;
      pipeline.sadd(tagKey, key);
      pipeline.expire(tagKey, 3600); // Tag expires in 1 hour
    });

    await pipeline.exec();
  }

  private async removeCacheTags(key: string): Promise<void> {
    try {
      // This is a simplified approach - in production you might want to track
      // which tags a key belongs to for more efficient removal
      const tagKeys = await this.redis.keys('cache_tag:*');

      if (tagKeys.length > 0) {
        const pipeline = this.redis.pipeline();
        tagKeys.forEach(tagKey => {
          pipeline.srem(tagKey, key);
        });
        await pipeline.exec();
      }
    } catch (error) {
      console.error('Remove cache tags error:', error);
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      memoryHits: 0,
      memoryMisses: 0,
      redisHits: 0,
      redisMisses: 0,
      totalRequests: 0,
    };
  }

  // Utility method for cache warming
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
