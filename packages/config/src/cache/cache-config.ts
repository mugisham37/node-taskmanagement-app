import { z } from 'zod';
import { environmentLoader } from '../environment/environment-loader';

/**
 * Redis cache configuration schema
 */
const RedisCacheConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().min(1).max(65535),
  password: z.string().optional(),
  db: z.number().min(0).default(0),
  keyPrefix: z.string().default('taskmanagement:'),
  
  // Connection settings
  connectTimeout: z.number().default(10000),
  commandTimeout: z.number().default(5000),
  retryDelayOnFailover: z.number().default(100),
  maxRetriesPerRequest: z.number().default(3),
  lazyConnect: z.boolean().default(true),
  keepAlive: z.number().default(30000),
  
  // Cluster settings
  enableCluster: z.boolean().default(false),
  clusterNodes: z.array(z.object({
    host: z.string(),
    port: z.number(),
  })).default([]),
  
  // Sentinel settings
  enableSentinel: z.boolean().default(false),
  sentinels: z.array(z.object({
    host: z.string(),
    port: z.number(),
  })).default([]),
  sentinelName: z.string().optional(),
});

/**
 * Memory cache configuration schema
 */
const MemoryCacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxSize: z.number().default(100), // MB
  maxKeys: z.number().default(10000),
  defaultTTL: z.number().default(300), // 5 minutes
  checkPeriod: z.number().default(600), // 10 minutes
  useClones: z.boolean().default(false),
  deleteOnExpire: z.boolean().default(true),
  enableLegacyCallbacks: z.boolean().default(false),
});

/**
 * Cache strategy configuration schema
 */
const CacheStrategySchema = z.object({
  defaultStrategy: z.enum(['cache-aside', 'write-through', 'write-behind', 'refresh-ahead']).default('cache-aside'),
  defaultTTL: z.number().default(3600), // 1 hour
  maxTTL: z.number().default(86400), // 24 hours
  
  // Cache-aside settings
  cacheAside: z.object({
    enabled: z.boolean().default(true),
    missCallback: z.boolean().default(true),
  }),
  
  // Write-through settings
  writeThrough: z.object({
    enabled: z.boolean().default(false),
    batchSize: z.number().default(100),
    flushInterval: z.number().default(1000),
  }),
  
  // Write-behind settings
  writeBehind: z.object({
    enabled: z.boolean().default(false),
    batchSize: z.number().default(100),
    flushInterval: z.number().default(5000),
    maxRetries: z.number().default(3),
  }),
  
  // Refresh-ahead settings
  refreshAhead: z.object({
    enabled: z.boolean().default(false),
    factor: z.number().min(0).max(1).default(0.8), // Refresh when 80% of TTL elapsed
    maxConcurrentRefresh: z.number().default(10),
  }),
});

/**
 * Cache invalidation configuration schema
 */
const CacheInvalidationSchema = z.object({
  enabled: z.boolean().default(true),
  
  // Tag-based invalidation
  tagBased: z.object({
    enabled: z.boolean().default(true),
    separator: z.string().default(':'),
    maxTags: z.number().default(10),
  }),
  
  // Time-based invalidation
  timeBased: z.object({
    enabled: z.boolean().default(true),
    checkInterval: z.number().default(60000), // 1 minute
    batchSize: z.number().default(1000),
  }),
  
  // Event-based invalidation
  eventBased: z.object({
    enabled: z.boolean().default(true),
    events: z.array(z.string()).default([
      'user.updated',
      'task.created',
      'task.updated',
      'task.deleted',
      'project.updated',
    ]),
  }),
});

/**
 * Cache warming configuration schema
 */
const CacheWarmingSchema = z.object({
  enabled: z.boolean().default(false),
  
  // Startup warming
  onStartup: z.object({
    enabled: z.boolean().default(false),
    timeout: z.number().default(30000),
    concurrency: z.number().default(5),
    keys: z.array(z.string()).default([]),
  }),
  
  // Scheduled warming
  scheduled: z.object({
    enabled: z.boolean().default(false),
    cron: z.string().default('0 */6 * * *'), // Every 6 hours
    keys: z.array(z.string()).default([]),
  }),
  
  // Predictive warming
  predictive: z.object({
    enabled: z.boolean().default(false),
    threshold: z.number().default(0.1), // Warm when hit rate < 10%
    lookbackPeriod: z.number().default(3600), // 1 hour
  }),
});

/**
 * Cache monitoring configuration schema
 */
const CacheMonitoringSchema = z.object({
  enabled: z.boolean().default(true),
  
  // Metrics collection
  metrics: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().default(60000), // 1 minute
    includeKeyPatterns: z.boolean().default(false),
    maxKeyPatterns: z.number().default(100),
  }),
  
  // Performance tracking
  performance: z.object({
    enabled: z.boolean().default(true),
    slowOperationThreshold: z.number().default(100), // 100ms
    trackHitRatio: z.boolean().default(true),
    trackMemoryUsage: z.boolean().default(true),
  }),
  
  // Alerting
  alerting: z.object({
    enabled: z.boolean().default(true),
    hitRatioThreshold: z.number().default(0.8), // Alert if hit ratio < 80%
    memoryUsageThreshold: z.number().default(0.9), // Alert if memory usage > 90%
    connectionErrorThreshold: z.number().default(5),
  }),
});

/**
 * Complete cache configuration schema
 */
const CacheConfigSchema = z.object({
  redis: RedisCacheConfigSchema,
  memory: MemoryCacheConfigSchema,
  strategy: CacheStrategySchema,
  invalidation: CacheInvalidationSchema,
  warming: CacheWarmingSchema,
  monitoring: CacheMonitoringSchema,
});

export type RedisCacheConfig = z.infer<typeof RedisCacheConfigSchema>;
export type MemoryCacheConfig = z.infer<typeof MemoryCacheConfigSchema>;
export type CacheStrategy = z.infer<typeof CacheStrategySchema>;
export type CacheInvalidation = z.infer<typeof CacheInvalidationSchema>;
export type CacheWarming = z.infer<typeof CacheWarmingSchema>;
export type CacheMonitoring = z.infer<typeof CacheMonitoringSchema>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;

/**
 * Cache configuration loader
 */
export class CacheConfigLoader {
  /**
   * Load complete cache configuration
   */
  static load(): CacheConfig {
    const env = environmentLoader.getEnv();
    const environment = environmentLoader.getEnvironment();

    const config = {
      redis: this.getRedisConfig(env),
      memory: this.getMemoryConfig(environment),
      strategy: this.getStrategyConfig(environment),
      invalidation: this.getInvalidationConfig(environment),
      warming: this.getWarmingConfig(environment),
      monitoring: this.getMonitoringConfig(environment),
    };

    return CacheConfigSchema.parse(config);
  }

  /**
   * Get Redis configuration
   */
  private static getRedisConfig(env: any): RedisCacheConfig {
    return {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB,
      keyPrefix: env.REDIS_KEY_PREFIX || 'taskmanagement:',
      connectTimeout: parseInt(env.REDIS_CONNECT_TIMEOUT || '10000'),
      commandTimeout: parseInt(env.REDIS_COMMAND_TIMEOUT || '5000'),
      retryDelayOnFailover: parseInt(env.REDIS_RETRY_DELAY || '100'),
      maxRetriesPerRequest: parseInt(env.REDIS_MAX_RETRIES || '3'),
      lazyConnect: env.REDIS_LAZY_CONNECT !== 'false',
      keepAlive: parseInt(env.REDIS_KEEP_ALIVE || '30000'),
      
      // Cluster configuration
      enableCluster: env.REDIS_CLUSTER_ENABLED === 'true',
      clusterNodes: env.REDIS_CLUSTER_NODES ? 
        env.REDIS_CLUSTER_NODES.split(',').map((node: string) => {
          const [host, port] = node.split(':');
          return { host, port: parseInt(port) };
        }) : [],
      
      // Sentinel configuration
      enableSentinel: env.REDIS_SENTINEL_ENABLED === 'true',
      sentinels: env.REDIS_SENTINELS ?
        env.REDIS_SENTINELS.split(',').map((sentinel: string) => {
          const [host, port] = sentinel.split(':');
          return { host, port: parseInt(port) };
        }) : [],
      sentinelName: env.REDIS_SENTINEL_NAME,
    };
  }

  /**
   * Get memory cache configuration
   */
  private static getMemoryConfig(environment: string): MemoryCacheConfig {
    const baseConfig = {
      enabled: true,
      maxSize: 100, // MB
      maxKeys: 10000,
      defaultTTL: 300, // 5 minutes
      checkPeriod: 600, // 10 minutes
      useClones: false,
      deleteOnExpire: true,
      enableLegacyCallbacks: false,
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          maxSize: 500, // More memory in production
          maxKeys: 50000,
        };
      
      case 'staging':
        return {
          ...baseConfig,
          maxSize: 200,
          maxKeys: 20000,
        };
      
      case 'test':
        return {
          ...baseConfig,
          maxSize: 10,
          maxKeys: 1000,
          defaultTTL: 60, // Shorter TTL in tests
        };
      
      case 'development':
      default:
        return baseConfig;
    }
  }

  /**
   * Get cache strategy configuration
   */
  private static getStrategyConfig(environment: string): CacheStrategy {
    const baseConfig = {
      defaultStrategy: 'cache-aside' as const,
      defaultTTL: 3600,
      maxTTL: 86400,
      cacheAside: {
        enabled: true,
        missCallback: true,
      },
      writeThrough: {
        enabled: false,
        batchSize: 100,
        flushInterval: 1000,
      },
      writeBehind: {
        enabled: false,
        batchSize: 100,
        flushInterval: 5000,
        maxRetries: 3,
      },
      refreshAhead: {
        enabled: false,
        factor: 0.8,
        maxConcurrentRefresh: 10,
      },
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          refreshAhead: {
            ...baseConfig.refreshAhead,
            enabled: true, // Enable refresh-ahead in production
          },
        };
      
      case 'test':
        return {
          ...baseConfig,
          defaultTTL: 60, // Shorter TTL in tests
          maxTTL: 300,
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Get cache invalidation configuration
   */
  private static getInvalidationConfig(environment: string): CacheInvalidation {
    return {
      enabled: true,
      tagBased: {
        enabled: true,
        separator: ':',
        maxTags: 10,
      },
      timeBased: {
        enabled: true,
        checkInterval: environment === 'production' ? 30000 : 60000,
        batchSize: 1000,
      },
      eventBased: {
        enabled: true,
        events: [
          'user.updated',
          'task.created',
          'task.updated',
          'task.deleted',
          'project.updated',
          'workspace.updated',
        ],
      },
    };
  }

  /**
   * Get cache warming configuration
   */
  private static getWarmingConfig(environment: string): CacheWarming {
    const baseConfig = {
      enabled: false,
      onStartup: {
        enabled: false,
        timeout: 30000,
        concurrency: 5,
        keys: [],
      },
      scheduled: {
        enabled: false,
        cron: '0 */6 * * *',
        keys: [],
      },
      predictive: {
        enabled: false,
        threshold: 0.1,
        lookbackPeriod: 3600,
      },
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          enabled: true,
          onStartup: {
            ...baseConfig.onStartup,
            enabled: true,
            keys: [
              'users:active',
              'projects:recent',
              'tasks:priority',
            ],
          },
          scheduled: {
            ...baseConfig.scheduled,
            enabled: true,
            keys: [
              'analytics:dashboard',
              'reports:summary',
            ],
          },
          predictive: {
            ...baseConfig.predictive,
            enabled: true,
          },
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Get cache monitoring configuration
   */
  private static getMonitoringConfig(environment: string): CacheMonitoring {
    const baseConfig = {
      enabled: true,
      metrics: {
        enabled: true,
        interval: 60000,
        includeKeyPatterns: false,
        maxKeyPatterns: 100,
      },
      performance: {
        enabled: true,
        slowOperationThreshold: 100,
        trackHitRatio: true,
        trackMemoryUsage: true,
      },
      alerting: {
        enabled: true,
        hitRatioThreshold: 0.8,
        memoryUsageThreshold: 0.9,
        connectionErrorThreshold: 5,
      },
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          metrics: {
            ...baseConfig.metrics,
            interval: 30000, // More frequent in production
          },
          performance: {
            ...baseConfig.performance,
            slowOperationThreshold: 50, // Stricter in production
          },
          alerting: {
            ...baseConfig.alerting,
            hitRatioThreshold: 0.9, // Higher threshold in production
            connectionErrorThreshold: 3,
          },
        };
      
      case 'test':
        return {
          ...baseConfig,
          enabled: false,
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Validate cache configuration
   */
  static validate(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const config = this.load();
      const environment = environmentLoader.getEnvironment();

      // Validate Redis configuration
      if (!config.redis.host) {
        errors.push('Redis host is required');
      }

      if (config.redis.enableCluster && config.redis.clusterNodes.length === 0) {
        errors.push('Cluster enabled but no cluster nodes configured');
      }

      if (config.redis.enableSentinel && config.redis.sentinels.length === 0) {
        errors.push('Sentinel enabled but no sentinel nodes configured');
      }

      // Validate memory cache configuration
      if (config.memory.maxSize > 1000 && environment === 'production') {
        warnings.push('Large memory cache size may impact performance');
      }

      // Validate strategy configuration
      if (config.strategy.defaultTTL > config.strategy.maxTTL) {
        errors.push('Default TTL cannot be greater than max TTL');
      }

      // Environment-specific validations
      if (environment === 'production') {
        if (!config.monitoring.enabled) {
          warnings.push('Cache monitoring is disabled in production');
        }
        
        if (!config.warming.enabled) {
          warnings.push('Cache warming is disabled in production');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Cache configuration validation failed: ${error}`],
        warnings: [],
      };
    }
  }
}