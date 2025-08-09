import { RedisClient } from './redis-client';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean;
  tags?: string[];
}

export interface CacheKeyPattern {
  pattern: string;
  tags?: string[];
}

export class CacheService {
  private readonly defaultTTL = 3600; // 1 hour
  private readonly keyPrefix = 'cache:';
  private readonly tagPrefix = 'tag:';

  constructor(private readonly redisClient: RedisClient) {}

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      const value = await client.get(fullKey);

      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      throw new InfrastructureError(
        `Failed to get cache value for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      const ttl = options.ttl || this.defaultTTL;
      const serializedValue = JSON.stringify(value);

      // Set the main cache entry
      await client.setex(fullKey, ttl, serializedValue);

      // Handle tags if provided
      if (options.tags && options.tags.length > 0) {
        await this.addKeyToTags(key, options.tags, ttl);
      }
    } catch (error) {
      throw new InfrastructureError(
        `Failed to set cache value for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      await client.del(fullKey);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to delete cache value for key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate?: number;
  }> {
    try {
      const client = this.redisClient.getClient();
      const info = await client.info('memory');
      const keyspace = await client.info('keyspace');

      // Parse memory usage
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';

      // Parse total keys
      const keysMatch = keyspace.match(/keys=(\d+)/);
      const totalKeys = keysMatch ? parseInt(keysMatch[1], 10) : 0;

      return {
        totalKeys,
        memoryUsage,
      };
    } catch (error) {
      throw new InfrastructureError(
        `Failed to get cache stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
