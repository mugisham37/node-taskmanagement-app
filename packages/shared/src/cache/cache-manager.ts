import { CacheOptions, MultiLayerCache } from './multi-layer-cache';

export interface CacheConfig {
  redis?: {
    url: string;
    options?: any;
  };
  memory?: CacheOptions;
  defaultTTL?: number;
  keyPrefix?: string;
}

export class CacheManager {
  private cache: MultiLayerCache;
  private keyPrefix: string;
  private defaultTTL: number;

  constructor(config: CacheConfig) {
    this.keyPrefix = config.keyPrefix || 'app';
    this.defaultTTL = config.defaultTTL || 300; // 5 minutes

    // Initialize Redis client if configured
    let redisClient = null;
    if (config.redis) {
      try {
        const { createClient } = require('redis');
        redisClient = createClient({
          url: config.redis.url,
          ...config.redis.options,
        });
        redisClient.connect();
      } catch (error) {
        console.warn('Redis not available, using memory cache only:', error);
      }
    }

    this.cache = new MultiLayerCache(redisClient, config.memory);
  }

  // Key management
  private buildKey(key: string, namespace?: string): string {
    const parts = [this.keyPrefix];
    if (namespace) parts.push(namespace);
    parts.push(key);
    return parts.join(':');
  }

  // Basic cache operations
  async get<T>(key: string, namespace?: string): Promise<T | null> {
    return this.cache.get<T>(this.buildKey(key, namespace));
  }

  async set<T>(key: string, value: T, ttl?: number, namespace?: string): Promise<void> {
    return this.cache.set(this.buildKey(key, namespace), value, ttl || this.defaultTTL);
  }

  async delete(key: string, namespace?: string): Promise<void> {
    return this.cache.delete(this.buildKey(key, namespace));
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
    namespace?: string
  ): Promise<T> {
    return this.cache.getOrSet(
      this.buildKey(key, namespace),
      factory,
      ttl || this.defaultTTL
    );
  }

  // Query result caching with automatic invalidation
  async cacheQuery<T>(
    queryKey: string,
    query: () => Promise<T>,
    dependencies: string[] = [],
    ttl?: number
  ): Promise<T> {
    const key = this.buildKey(queryKey, 'query');
    
    // Check if any dependencies have been invalidated
    const invalidationKey = this.buildKey(`${queryKey}:invalidated`, 'query');
    const isInvalidated = await this.cache.get(invalidationKey);
    
    if (isInvalidated) {
      await this.cache.delete(key);
      await this.cache.delete(invalidationKey);
    }

    return this.cache.getOrSet(key, query, ttl || this.defaultTTL);
  }

  async invalidateQuery(queryKey: string): Promise<void> {
    const key = this.buildKey(queryKey, 'query');
    const invalidationKey = this.buildKey(`${queryKey}:invalidated`, 'query');
    
    await this.cache.delete(key);
    await this.cache.set(invalidationKey, true, 60); // Mark as invalidated for 1 minute
  }

  async invalidateQueries(pattern: string): Promise<void> {
    const fullPattern = this.buildKey(pattern, 'query');
    await this.cache.invalidatePattern(fullPattern);
  }

  // Request deduplication
  private pendingRequests = new Map<string, Promise<any>>();

  async deduplicateRequest<T>(
    key: string,
    request: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cacheKey = this.buildKey(key, 'request');
    
    // Check cache first
    const cached = await this.cache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Check if request is already pending
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    // Execute request and cache result
    const promise = request().then(async (result) => {
      await this.cache.set(cacheKey, result, ttl || this.defaultTTL);
      this.pendingRequests.delete(cacheKey);
      return result;
    }).catch((error) => {
      this.pendingRequests.delete(cacheKey);
      throw error;
    });

    this.pendingRequests.set(cacheKey, promise);
    return promise;
  }

  // Cache warming strategies
  async warmUserData(userId: string): Promise<void> {
    const entries = [
      {
        key: this.buildKey(`user:${userId}`, 'data'),
        factory: async () => {
          // This would be replaced with actual user data fetching
          return { id: userId, warmed: true };
        },
        ttl: 600, // 10 minutes
      },
      {
        key: this.buildKey(`user:${userId}:projects`, 'data'),
        factory: async () => {
          // This would be replaced with actual project fetching
          return [];
        },
        ttl: 300, // 5 minutes
      },
    ];

    await this.cache.warmCache(entries);
  }

  async warmProjectData(projectId: string): Promise<void> {
    const entries = [
      {
        key: this.buildKey(`project:${projectId}`, 'data'),
        factory: async () => {
          // This would be replaced with actual project data fetching
          return { id: projectId, warmed: true };
        },
        ttl: 600,
      },
      {
        key: this.buildKey(`project:${projectId}:tasks`, 'data'),
        factory: async () => {
          // This would be replaced with actual task fetching
          return [];
        },
        ttl: 300,
      },
    ];

    await this.cache.warmCache(entries);
  }

  // Preloading strategies
  async preloadFrequentData(): Promise<void> {
    // This would be called during application startup
    const commonQueries = [
      'dashboard:stats',
      'user:preferences',
      'system:config',
    ];

    for (const query of commonQueries) {
      try {
        // Preload without waiting
        this.getOrSet(query, async () => {
          // This would be replaced with actual data fetching
          return { preloaded: true, query };
        }, 1800); // 30 minutes
      } catch (error) {
        console.warn(`Failed to preload ${query}:`, error);
      }
    }
  }

  // Cache statistics and monitoring
  getStats() {
    return this.cache.getCacheInfo();
  }

  getMetrics() {
    return this.cache.getMetrics();
  }

  resetMetrics() {
    this.cache.resetMetrics();
  }

  // Cleanup and maintenance
  async clear(): Promise<void> {
    await this.cache.clear();
  }

  async cleanup(): Promise<void> {
    // Clear expired entries and optimize cache
    // This would be called periodically
    console.log('Cache cleanup completed');
  }
}

// Singleton instance
let globalCacheManager: CacheManager | null = null;

export function createCacheManager(config: CacheConfig): CacheManager {
  globalCacheManager = new CacheManager(config);
  return globalCacheManager;
}

export function getCacheManager(): CacheManager | null {
  return globalCacheManager;
}