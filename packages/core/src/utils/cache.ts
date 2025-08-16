/**
 * Platform-agnostic cache utilities and interfaces
 * Provides abstractions for caching that can be implemented by different backends
 */

// Cache TTL in seconds
export const DEFAULT_TTL = 60 * 5; // 5 minutes

/**
 * Cache interface for platform-agnostic caching
 */
export interface CacheInterface {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<boolean>;
  del(key: string): Promise<boolean>;
  flush(): Promise<void>;
  getStats?(): Promise<any>;
}

/**
 * Cache key builder utility
 */
export const buildCacheKey = (
  ...parts: (string | number | boolean)[]
): string => {
  return parts
    .map(part => String(part))
    .filter(part => part.length > 0)
    .join(':');
};

/**
 * Get or set cache value with a function
 */
export const getOrSet = async <T>(
  cache: CacheInterface,
  key: string,
  fn: () => Promise<T> | T,
  ttl?: number
): Promise<T> => {
  try {
    const cachedValue = await cache.get<T>(key);
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const value = await Promise.resolve(fn());
    await cache.set(key, value, ttl);
    return value;
  } catch (error) {
    // If cache fails, still execute the function
    return await Promise.resolve(fn());
  }
};

/**
 * Memoize a function with caching
 */
export const memoize = <TArgs extends any[], TReturn>(
  cache: CacheInterface,
  fn: (...args: TArgs) => Promise<TReturn>,
  keyGenerator?: (...args: TArgs) => string,
  ttl?: number
) => {
  const keyFn = keyGenerator || ((...args: TArgs) => JSON.stringify(args));
  return async (...args: TArgs): Promise<TReturn> => {
    const key = keyFn(...args);
    return getOrSet(cache, key, () => fn(...args), ttl);
  };
};

/**
 * Cache with tags for bulk invalidation
 */
export class TaggedCache {
  private cache: CacheInterface;
  private tagPrefix = 'tag:';

  constructor(cache: CacheInterface) {
    this.cache = cache;
  }

  async set(
    key: string,
    value: any,
    ttl?: number,
    tags: string[] = []
  ): Promise<boolean> {
    const success = await this.cache.set(key, value, ttl);

    if (success && tags.length > 0) {
      // Store tag associations
      for (const tag of tags) {
        const tagKey = `${this.tagPrefix}${tag}`;
        const taggedKeys = (await this.cache.get<string[]>(tagKey)) || [];
        if (!taggedKeys.includes(key)) {
          taggedKeys.push(key);
          await this.cache.set(tagKey, taggedKeys, ttl);
        }
      }
    }

    return success;
  }

  async invalidateByTag(tag: string): Promise<void> {
    const tagKey = `${this.tagPrefix}${tag}`;
    const taggedKeys = (await this.cache.get<string[]>(tagKey)) || [];

    // Delete all keys associated with this tag
    for (const key of taggedKeys) {
      await this.cache.del(key);
    }

    // Delete the tag key itself
    await this.cache.del(tagKey);
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.invalidateByTag(tag);
    }
  }
}

/**
 * Cache warming utility
 */
export const warmCache = async (
  cache: CacheInterface,
  keys: Array<{ key: string; fn: () => Promise<any>; ttl?: number }>,
  logger?: { info: (msg: string) => void; debug: (msg: string) => void; error: (msg: string, error: any) => void }
): Promise<void> => {
  logger?.info(`Warming cache for ${keys.length} keys`);

  const promises = keys.map(async ({ key, fn, ttl }) => {
    try {
      const value = await fn();
      await cache.set(key, value, ttl);
      logger?.debug(`Cache warmed for key: ${key}`);
    } catch (error) {
      logger?.error(`Failed to warm cache for key ${key}:`, error);
    }
  });

  await Promise.allSettled(promises);
  logger?.info('Cache warming completed');
};

/**
 * In-memory cache implementation for testing or simple use cases
 */
export class MemoryCache implements CacheInterface {
  private cache = new Map<string, { value: any; expires: number }>();
  private defaultTTL: number;

  constructor(defaultTTL: number = DEFAULT_TTL) {
    this.defaultTTL = defaultTTL;
    
    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const expires = Date.now() + (ttl || this.defaultTTL) * 1000;
    this.cache.set(key, { value, expires });
    return true;
  }

  async del(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async flush(): Promise<void> {
    this.cache.clear();
  }

  async getStats(): Promise<any> {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * No-op cache implementation for disabling caching
 */
export class NoOpCache implements CacheInterface {
  async get<T>(_key: string): Promise<T | undefined> {
    return undefined;
  }

  async set<T>(_key: string, _value: T, _ttl?: number): Promise<boolean> {
    return false;
  }

  async del(_key: string): Promise<boolean> {
    return false;
  }

  async flush(): Promise<void> {
    // No-op
  }

  async getStats(): Promise<any> {
    return { disabled: true };
  }
}

/**
 * Cache utilities
 */
export const cacheUtils = {
  /**
   * Create a cache key with namespace
   */
  createKey: (namespace: string, ...parts: (string | number)[]): string => {
    return buildCacheKey(namespace, ...parts);
  },

  /**
   * Check if caching should be disabled
   */
  isCacheDisabled: (): boolean => {
    return (
      (typeof process !== 'undefined' && process.env?.['NODE_ENV'] === 'test') ||
      (typeof process !== 'undefined' && process.env?.['DISABLE_CACHE'] === 'true')
    );
  },

  /**
   * Create appropriate cache instance
   */
  createCache: (options?: { disabled?: boolean; ttl?: number }): CacheInterface => {
    if (options?.disabled || cacheUtils.isCacheDisabled()) {
      return new NoOpCache();
    }
    return new MemoryCache(options?.ttl);
  }
};

export default {
  buildCacheKey,
  getOrSet,
  memoize,
  TaggedCache,
  warmCache,
  MemoryCache,
  NoOpCache,
  cacheUtils,
  DEFAULT_TTL
};