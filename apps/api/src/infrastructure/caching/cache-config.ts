/**
 * Cache Configuration for Infrastructure Layer
 */

// Import types when available, otherwise define locally
export interface RedisConfig {
  host: string;
  port: number;
  password?: string | undefined;
  db: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  enableOfflineQueue?: boolean;
  maxRetriesPerRequest?: number;
}

export interface MemoryCacheConfig {
  maxSize: number;
  ttl: number;
}

export interface InfrastructureCacheConfig {
  redis: RedisConfig;
  memory: MemoryCacheConfig;
  defaultTTL: number;
  enableCompression: boolean;
  enableMetrics: boolean;
}

export const defaultCacheConfig: InfrastructureCacheConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'taskmanagement:',
    retryDelayOnFailover: 100,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 3,
  },
  memory: {
    maxSize: 1000,
    ttl: 300000, // 5 minutes
  },
  defaultTTL: 300, // 5 minutes
  enableCompression: true,
  enableMetrics: true,
};

export function getCacheConfig(): InfrastructureCacheConfig {
  return {
    ...defaultCacheConfig,
    redis: {
      ...defaultCacheConfig.redis,
      host: process.env.REDIS_HOST || defaultCacheConfig.redis.host,
      port: parseInt(process.env.REDIS_PORT || String(defaultCacheConfig.redis.port)),
      password: process.env.REDIS_PASSWORD || defaultCacheConfig.redis.password,
      db: parseInt(process.env.REDIS_DB || String(defaultCacheConfig.redis.db)),
    },
  };
}
