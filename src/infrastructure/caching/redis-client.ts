import Redis, { RedisOptions } from 'ioredis';
import { logger } from '../logging/logger';

export interface ICacheClient {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  increment(key: string, value?: number): Promise<number>;
  decrement(key: string, value?: number): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  ttl(key: string): Promise<number>;
  flushAll(): Promise<void>;
  ping(): Promise<string>;
  disconnect(): Promise<void>;
}

class RedisCacheClient implements ICacheClient {
  private client: Redis;
  private isConnected = false;

  constructor(options?: RedisOptions) {
    const defaultOptions: RedisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      ...options,
    };

    this.client = new Redis(defaultOptions);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.client.on('error', error => {
      this.isConnected = false;
      logger.error('Redis client error', { error });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis client connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });

    this.client.on('end', () => {
      this.isConnected = false;
      logger.info('Redis client connection ended');
    });
  }

  public async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
        this.isConnected = true;
        logger.info('Redis client connected successfully');
      } catch (error) {
        logger.error('Failed to connect Redis client', { error });
        throw error;
      }
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        // If parsing fails, return as string
        return value as unknown as T;
      }
    } catch (error) {
      logger.error('Redis GET error', { key, error });
      throw error;
    }
  }

  public async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number
  ): Promise<void> {
    try {
      const serializedValue =
        typeof value === 'string' ? value : JSON.stringify(value);

      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
    } catch (error) {
      logger.error('Redis SET error', { key, ttlSeconds, error });
      throw error;
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Redis DELETE error', { key, error });
      throw error;
    }
  }

  public async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.client.del(...keys);
      return deleted;
    } catch (error) {
      logger.error('Redis DELETE PATTERN error', { pattern, error });
      throw error;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error', { key, error });
      throw error;
    }
  }

  public async increment(key: string, value: number = 1): Promise<number> {
    try {
      return await this.client.incrby(key, value);
    } catch (error) {
      logger.error('Redis INCREMENT error', { key, value, error });
      throw error;
    }
  }

  public async decrement(key: string, value: number = 1): Promise<number> {
    try {
      return await this.client.decrby(key, value);
    } catch (error) {
      logger.error('Redis DECREMENT error', { key, value, error });
      throw error;
    }
  }

  public async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.expire(key, ttlSeconds);
    } catch (error) {
      logger.error('Redis EXPIRE error', { key, ttlSeconds, error });
      throw error;
    }
  }

  public async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Redis TTL error', { key, error });
      throw error;
    }
  }

  public async flushAll(): Promise<void> {
    try {
      await this.client.flushall();
    } catch (error) {
      logger.error('Redis FLUSH ALL error', { error });
      throw error;
    }
  }

  public async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      logger.error('Redis PING error', { error });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis client disconnected');
    } catch (error) {
      logger.error('Redis disconnect error', { error });
      throw error;
    }
  }

  public getClient(): Redis {
    return this.client;
  }

  public isClientConnected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let cacheClient: RedisCacheClient | null = null;

export function createCacheClient(options?: RedisOptions): ICacheClient {
  if (!cacheClient) {
    cacheClient = new RedisCacheClient(options);
  }
  return cacheClient;
}

export function getCacheClient(): ICacheClient {
  if (!cacheClient) {
    cacheClient = new RedisCacheClient();
  }
  return cacheClient;
}

export async function connectCache(): Promise<void> {
  const client = getCacheClient() as RedisCacheClient;
  await client.connect();
}

export async function disconnectCache(): Promise<void> {
  if (cacheClient) {
    await cacheClient.disconnect();
    cacheClient = null;
  }
}

export async function cacheHealthCheck(): Promise<boolean> {
  try {
    const client = getCacheClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Cache health check failed', { error });
    return false;
  }
}
