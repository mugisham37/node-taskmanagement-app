import Redis, { RedisOptions } from 'ioredis';
import { CacheService, CacheStats } from './interfaces';
import { LRUMemoryCache } from './memory-cache';

/**
 * Redis configuration interface
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
  keepAlive?: number;
  family?: number;
  keyPrefix?: string;
  defaultTTL?: number;
}

/**
 * Redis client wrapper
 */
export class RedisClient {
  private client: Redis;
  private connected: boolean = false;

  constructor(config: RedisConfig) {
    const redisOptions: RedisOptions = {
      host: config.host,
      port: config.port,
      ...(config.password && { password: config.password }),
      db: config.db || 0,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      enableReadyCheck: config.enableReadyCheck ?? true,
      lazyConnect: config.lazyConnect ?? true,
      keepAlive: config.keepAlive || 30000,
      family: config.family || 4,
      keyPrefix: config.keyPrefix || '',
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      },
    };

    this.client = new Redis(redisOptions);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.connected = true;
    });

    this.client.on('error', () => {
      this.connected = false;
    });

    this.client.on('close', () => {
      this.connected = false;
    });

    this.client.on('end', () => {
      this.connected = false;
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    this.connected = false;
  }

  getClient(): Redis {
    return this.client;
  }

  isConnected(): boolean {
    return this.connected && this.client.status === 'ready';
  }

  async ping(): Promise<string> {
    return await this.client.ping();
  }

  async flushAll(): Promise<void> {
    await this.client.flushall();
  }
}

/**
 * Redis-based cache service with L1 memory cache
 */
export class RedisCacheService implements CacheService {
  private readonly defaultTTL: number;
  private readonly keyPrefix: string;
  private readonly memoryCache: LRUMemoryCache;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private readonly redisClient: RedisClient,
    config?: RedisConfig
  ) {
    this.memoryCache = new LRUMemoryCache(1000);
    this.defaultTTL = config?.defaultTTL || 3600;
    this.keyPrefix = config?.keyPrefix || 'cache:';
    this.startCleanupInterval();
  }

  async connect(): Promise<void> {
    if (!this.redisClient.isConnected()) {
      await this.redisClient.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.redisClient.isConnected()) {
      await this.redisClient.disconnect();
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  isConnected(): boolean {
    return this.redisClient.isConnected();
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);

    try {
      // Try L1 cache first (memory)
      const memoryValue = await this.memoryCache.get<T>(fullKey);
      if (memoryValue !== null) {
        return memoryValue;
      }

      // Try L2 cache (Redis)
      const client = this.redisClient.getClient();
      const value = await client.get(fullKey);

      if (value === null) {
        return null;
      }

      const parsedValue = JSON.parse(value) as T;

      // Populate L1 cache with L2 value
      await this.memoryCache.set(
        fullKey,
        parsedValue,
        Math.min(this.defaultTTL, 300)
      );

      return parsedValue;
    } catch (error) {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.buildKey(key);
    const cacheTTL = ttl || this.defaultTTL;
    const memoryTTL = Math.min(cacheTTL, 300); // Max 5 minutes in memory

    try {
      const promises: Promise<void>[] = [];

      // Set in L1 cache (memory)
      promises.push(this.memoryCache.set(fullKey, value, memoryTTL));

      // Set in L2 cache (Redis)
      const client = this.redisClient.getClient();
      const serializedValue = JSON.stringify(value);
      promises.push(
        client.setex(fullKey, cacheTTL, serializedValue).then(() => {})
      );

      await Promise.all(promises);
    } catch (error) {
      // Fallback to memory cache only
      await this.memoryCache.set(fullKey, value, memoryTTL);
    }
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);

    try {
      const promises: Promise<void>[] = [];

      promises.push(this.memoryCache.delete(fullKey));

      const client = this.redisClient.getClient();
      promises.push(client.del(fullKey).then(() => {}));

      await Promise.all(promises);
    } catch (error) {
      // At least clear from memory cache
      await this.memoryCache.delete(fullKey);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redisClient.flushAll();
      await this.memoryCache.clear();
    } catch (error) {
      await this.memoryCache.clear();
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      const result = await client.exists(fullKey);
      return result === 1;
    } catch (error) {
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      await client.expire(fullKey, ttl);
    } catch (error) {
      // Ignore error for now
    }
  }

  async getTTL(key: string): Promise<number> {
    try {
      const client = this.redisClient.getClient();
      const fullKey = this.buildKey(key);
      return await client.ttl(fullKey);
    } catch (error) {
      return -1;
    }
  }

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
      return 0;
    }
  }

  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cachedValue = await this.get<T>(key);

    if (cachedValue !== null) {
      return cachedValue;
    }

    const value = await callback();
    await this.set(key, value, ttl);
    return value;
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency?: number;
  }> {
    const startTime = Date.now();

    try {
      // Test memory cache
      const testKey = `health-check-${Date.now()}`;
      await this.memoryCache.set(testKey, 'test', 1);
      const value = await this.memoryCache.get(testKey);
      const memoryHealthy = value === 'test';
      await this.memoryCache.delete(testKey);

      // Test Redis cache
      let redisHealthy = true;
      if (this.redisClient.isConnected()) {
        const result = await this.redisClient.ping();
        redisHealthy = result === 'PONG';
      }

      const latency = Date.now() - startTime;
      const isHealthy = memoryHealthy && redisHealthy;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
      };
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const memoryStats = this.memoryCache.getStats();

      const stats: CacheStats = {
        connected: this.redisClient.isConnected(),
        hitCount: memoryStats.hitCount,
        missCount: memoryStats.missCount,
        hitRate: memoryStats.hitRate,
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

          stats.memoryUsage = memoryUsage;
          stats.keyCount = totalKeys;
        } catch (error) {
          // Ignore Redis stats errors
        }
      }

      return stats;
    } catch (error) {
      return {
        connected: false,
        hitCount: 0,
        missCount: 0,
        hitRate: 0,
      };
    }
  }

  private startCleanupInterval(): void {
    // Clean up expired memory cache entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        try {
          this.memoryCache.cleanup();
        } catch (error) {
          // Ignore cleanup errors
        }
      },
      5 * 60 * 1000
    );
  }

  private buildKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
}