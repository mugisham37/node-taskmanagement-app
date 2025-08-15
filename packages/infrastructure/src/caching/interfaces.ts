/**
 * Cache Service Interface
 * Platform-agnostic cache service contract
 */
export interface CacheService {
  /**
   * Connect to the cache service
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the cache service
   */
  disconnect(): Promise<void>;

  /**
   * Check if the cache service is healthy
   */
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }>;

  /**
   * Get a value from cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a value from cache
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * Check if cache is connected
   */
  isConnected(): boolean;

  /**
   * Check if key exists in cache
   */
  exists(key: string): Promise<boolean>;

  /**
   * Set TTL for existing key
   */
  expire(key: string, ttl: number): Promise<void>;

  /**
   * Get TTL for key
   */
  getTTL(key: string): Promise<number>;

  /**
   * Invalidate cache by pattern
   */
  invalidatePattern(pattern: string): Promise<number>;

  /**
   * Get or set pattern - if key doesn't exist, execute callback and cache result
   */
  getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    ttl?: number
  ): Promise<T>;
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  ttl?: number;
  namespace?: string;
  tags?: string[];
  useMemoryFallback?: boolean;
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  connected: boolean;
  hitCount: number;
  missCount: number;
  hitRate: number;
  keyCount?: number;
  memoryUsage?: string;
}

/**
 * Memory cache interface for L1 caching
 */
export interface MemoryCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): number;
  getStats(): MemoryCacheStats;
}

/**
 * Memory cache statistics
 */
export interface MemoryCacheStats {
  size: number;
  maxSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictionCount: number;
}

/**
 * Cache decorator interface
 */
export interface CacheDecorator {
  /**
   * Cache method result
   */
  cache(options?: CacheDecoratorOptions): MethodDecorator;

  /**
   * Invalidate cache for method
   */
  invalidate(options?: CacheInvalidationOptions): MethodDecorator;
}

/**
 * Cache decorator options
 */
export interface CacheDecoratorOptions {
  key?: string | ((args: any[]) => string);
  ttl?: number;
  tags?: string[];
  condition?: (args: any[]) => boolean;
}

/**
 * Cache invalidation options
 */
export interface CacheInvalidationOptions {
  keys?: string[] | ((args: any[]) => string[]);
  patterns?: string[] | ((args: any[]) => string[]);
  tags?: string[] | ((args: any[]) => string[]);
}