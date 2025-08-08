import NodeCache from 'node-cache';
import { createClient, RedisClientType } from 'redis';
import logger from '../infrastructure/config/logger';
import config from '../infrastructure/config/environment';

// Cache TTL in seconds
const DEFAULT_TTL = 60 * 5; // 5 minutes
const REDIS_CONNECTION_TIMEOUT = 5000; // 5 seconds

// Create node-cache instance as fallback
const nodeCache = new NodeCache({
  stdTTL: DEFAULT_TTL,
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false, // Don't clone objects (for performance)
});

// Redis client instance
let redisClient: RedisClientType | null = null;
let redisConnected = false;

/**
 * Initialize Redis connection
 */
const initializeRedis = async (): Promise<void> => {
  if (!config.redisUrl) {
    logger.info('Redis URL not provided, using node-cache only');
    return;
  }

  try {
    redisClient = createClient({
      url: config.redisUrl,
      socket: {
        connectTimeout: REDIS_CONNECTION_TIMEOUT,
      },
    });

    redisClient.on('error', err => {
      logger.error('Redis Client Error:', err);
      redisConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
      redisConnected = true;
    });

    redisClient.on('disconnect', () => {
      logger.warn('Redis Client Disconnected');
      redisConnected = false;
    });

    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    redisClient = null;
    redisConnected = false;
  }
};

/**
 * Check if caching is disabled
 */
const isCacheDisabled = (): boolean => {
  return config.nodeEnv === 'test' || process.env.DISABLE_CACHE === 'true';
};

/**
 * Get value from cache (Redis first, then node-cache fallback)
 * @param key Cache key
 * @returns Cached value or undefined if not found
 */
export const get = async (key: string): Promise<any | undefined> => {
  if (isCacheDisabled()) {
    return undefined;
  }

  try {
    // Try Redis first
    if (redisClient && redisConnected) {
      const value = await redisClient.get(key);
      if (value !== null) {
        try {
          return JSON.parse(value);
        } catch {
          return value; // Return as string if not JSON
        }
      }
    }

    // Fallback to node-cache
    return nodeCache.get(key);
  } catch (error) {
    logger.error(`Cache get error for key ${key}:`, error);
    // Try node-cache as fallback
    return nodeCache.get(key);
  }
};

/**
 * Set value in cache (both Redis and node-cache)
 * @param key Cache key
 * @param value Value to cache
 * @param ttl Time to live in seconds (optional)
 * @returns true if successful, false otherwise
 */
export const set = async (
  key: string,
  value: any,
  ttl?: number
): Promise<boolean> => {
  if (isCacheDisabled()) {
    return false;
  }

  const cacheTTL = ttl || DEFAULT_TTL;
  let redisSuccess = false;
  let nodeCacheSuccess = false;

  try {
    // Set in Redis
    if (redisClient && redisConnected) {
      const serializedValue =
        typeof value === 'string' ? value : JSON.stringify(value);
      await redisClient.setEx(key, cacheTTL, serializedValue);
      redisSuccess = true;
    }
  } catch (error) {
    logger.error(`Redis set error for key ${key}:`, error);
  }

  try {
    // Set in node-cache as backup
    nodeCacheSuccess = nodeCache.set(key, value, cacheTTL);
  } catch (error) {
    logger.error(`Node-cache set error for key ${key}:`, error);
  }

  return redisSuccess || nodeCacheSuccess;
};

/**
 * Delete value from cache (both Redis and node-cache)
 * @param key Cache key
 * @returns true if successful, false if key doesn't exist
 */
export const del = async (key: string): Promise<boolean> => {
  let redisSuccess = false;
  let nodeCacheSuccess = false;

  try {
    // Delete from Redis
    if (redisClient && redisConnected) {
      const result = await redisClient.del(key);
      redisSuccess = result > 0;
    }
  } catch (error) {
    logger.error(`Redis delete error for key ${key}:`, error);
  }

  try {
    // Delete from node-cache
    nodeCacheSuccess = nodeCache.del(key) > 0;
  } catch (error) {
    logger.error(`Node-cache delete error for key ${key}:`, error);
  }

  return redisSuccess || nodeCacheSuccess;
};

/**
 * Clear all cache (both Redis and node-cache)
 */
export const flush = async (): Promise<void> => {
  try {
    // Clear Redis
    if (redisClient && redisConnected) {
      await redisClient.flushAll();
    }
  } catch (error) {
    logger.error('Redis flush error:', error);
  }

  try {
    // Clear node-cache
    nodeCache.flushAll();
  } catch (error) {
    logger.error('Node-cache flush error:', error);
  }
};

/**
 * Get cache statistics
 * @returns Cache statistics
 */
export const getStats = async (): Promise<{
  nodeCache: NodeCache.Stats;
  redis?: any;
}> => {
  const stats: any = {
    nodeCache: nodeCache.getStats(),
  };

  try {
    if (redisClient && redisConnected) {
      const redisInfo = await redisClient.info('memory');
      stats.redis = {
        connected: redisConnected,
        info: redisInfo,
      };
    }
  } catch (error) {
    logger.error('Error getting Redis stats:', error);
  }

  return stats;
};

/**
 * Get or set cache value with a function
 * @param key Cache key
 * @param fn Function to execute if cache miss
 * @param ttl Time to live in seconds (optional)
 * @returns Cached or computed value
 */
export const getOrSet = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> => {
  if (isCacheDisabled()) {
    return await fn();
  }

  try {
    const cachedValue = await get(key);
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const value = await fn();
    await set(key, value, ttl);
    return value;
  } catch (error) {
    logger.error(`Error in getOrSet for cache key ${key}:`, error);
    // If cache fails, still execute the function
    return await fn();
  }
};

/**
 * Memoize a function with caching
 * @param fn Function to memoize
 * @param keyGenerator Function to generate cache key from arguments
 * @param ttl Time to live in seconds (optional)
 * @returns Memoized function
 */
export const memoize = <TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  keyGenerator: (...args: TArgs) => string,
  ttl?: number
) => {
  return async (...args: TArgs): Promise<TReturn> => {
    const key = keyGenerator(...args);
    return getOrSet(key, () => fn(...args), ttl);
  };
};

/**
 * Cache with tags for bulk invalidation
 */
class TaggedCache {
  private tagPrefix = 'tag:';

  async set(
    key: string,
    value: any,
    ttl?: number,
    tags: string[] = []
  ): Promise<boolean> {
    const success = await set(key, value, ttl);

    if (success && tags.length > 0) {
      // Store tag associations
      for (const tag of tags) {
        const tagKey = `${this.tagPrefix}${tag}`;
        const taggedKeys = (await get(tagKey)) || [];
        if (!taggedKeys.includes(key)) {
          taggedKeys.push(key);
          await set(tagKey, taggedKeys, ttl);
        }
      }
    }

    return success;
  }

  async invalidateByTag(tag: string): Promise<void> {
    const tagKey = `${this.tagPrefix}${tag}`;
    const taggedKeys = (await get(tagKey)) || [];

    // Delete all keys associated with this tag
    for (const key of taggedKeys) {
      await del(key);
    }

    // Delete the tag key itself
    await del(tagKey);
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.invalidateByTag(tag);
    }
  }
}

export const taggedCache = new TaggedCache();

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
 * Cache warming utility
 */
export const warmCache = async (
  keys: Array<{ key: string; fn: () => Promise<any>; ttl?: number }>
): Promise<void> => {
  logger.info(`Warming cache for ${keys.length} keys`);

  const promises = keys.map(async ({ key, fn, ttl }) => {
    try {
      const value = await fn();
      await set(key, value, ttl);
      logger.debug(`Cache warmed for key: ${key}`);
    } catch (error) {
      logger.error(`Failed to warm cache for key ${key}:`, error);
    }
  });

  await Promise.allSettled(promises);
  logger.info('Cache warming completed');
};

/**
 * Initialize cache system
 */
export const initializeCache = async (): Promise<void> => {
  logger.info('Initializing cache system...');
  await initializeRedis();
  logger.info('Cache system initialized');
};

/**
 * Gracefully close cache connections
 */
export const closeCache = async (): Promise<void> => {
  try {
    if (redisClient && redisConnected) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
    nodeCache.close();
    logger.info('Cache system closed');
  } catch (error) {
    logger.error('Error closing cache:', error);
  }
};

// Default export with all cache functions
export default {
  get,
  set,
  del,
  flush,
  getStats,
  getOrSet,
  memoize,
  taggedCache,
  buildCacheKey,
  warmCache,
  initializeCache,
  closeCache,
};
