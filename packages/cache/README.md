# @taskmanagement/cache

A comprehensive caching package providing multi-layer caching, Redis integration, and advanced caching strategies for the task management application.

## Features

- **Multi-layer caching** with memory (L1) and Redis (L2) support
- **Multiple cache providers** (Redis, in-memory)
- **Cache decorators** for method-level caching
- **Intelligent invalidation** strategies
- **Cache warming** and preloading
- **Performance monitoring** and metrics
- **Cache partitioning** for scalability
- **Compression** support for large values
- **Serialization** strategies

## Installation

```bash
npm install @taskmanagement/cache
```

## Quick Start

### Basic Usage

```typescript
import { CacheService, RedisClient } from '@taskmanagement/cache';

// Initialize Redis client
const redisClient = new RedisClient({
  host: 'localhost',
  port: 6379
});

// Create cache service
const cacheService = new CacheService(redisClient);

// Connect to cache
await cacheService.connect();

// Basic operations
await cacheService.set('user:123', { name: 'John Doe' }, { ttl: 3600 });
const user = await cacheService.get('user:123');
await cacheService.delete('user:123');
```

### Using Cache Decorators

```typescript
import { Cacheable, CacheEvict } from '@taskmanagement/cache';

class UserService {
  @Cacheable({
    keyGenerator: (id: string) => `user:${id}`,
    ttl: 3600,
    tags: ['user']
  })
  async getUser(id: string) {
    // This method will be cached
    return await this.fetchUserFromDatabase(id);
  }

  @CacheEvict({
    keys: (id: string) => [`user:${id}`],
    tags: ['user']
  })
  async updateUser(id: string, data: any) {
    // This will invalidate the user cache
    return await this.updateUserInDatabase(id, data);
  }
}
```

### Multi-layer Cache

```typescript
import { MultiLayerCache } from '@taskmanagement/cache';
import Redis from 'ioredis';

const redis = new Redis();
const cache = new MultiLayerCache(redis, {
  maxMemoryItems: 1000,
  memoryTTL: 300
});

// Automatically uses L1 (memory) and L2 (Redis)
await cache.set('key', 'value', { ttl: 3600 });
const value = await cache.get('key');
```

## Advanced Features

### Cache Warming

```typescript
import { CacheWarmer } from '@taskmanagement/cache';

const warmer = new CacheWarmer(cacheService, {
  enabled: true,
  strategies: ['user-data', 'project-data'],
  batchSize: 100,
  delayBetweenBatches: 1000
});

// Warm cache on application startup
await warmer.warmup();
```

### Cache Partitioning

```typescript
import { CachePartitioner, UserPartitionStrategy } from '@taskmanagement/cache';

const partitioner = new CachePartitioner('user');
partitioner.registerStrategy(new UserPartitionStrategy());
partitioner.registerCacheProvider('user_123', userCacheService);

// Automatically routes to correct partition
await partitioner.set('data', value, 3600, { userId: '123' });
```

### Performance Monitoring

```typescript
import { CacheMetricsCollector, CacheHealthMonitor } from '@taskmanagement/cache';

const metricsCollector = new CacheMetricsCollector();
const healthMonitor = new CacheHealthMonitor(metricsCollector);

// Start monitoring
const monitoringInterval = healthMonitor.startMonitoring(60000);

// Get performance report
const report = metricsCollector.getPerformanceReport();
console.log('Cache hit rate:', report.summary.hitRate);
```

### Invalidation Strategies

```typescript
import { InvalidationManager } from '@taskmanagement/cache';

const invalidationManager = new InvalidationManager();

// Invalidate related cache entries
await invalidationManager.invalidate(cacheService, {
  entityType: 'user',
  entityId: '123',
  operation: 'update',
  userId: '123'
});
```

## Configuration

### Redis Configuration

```typescript
const redisConfig = {
  host: 'localhost',
  port: 6379,
  password: 'your-password',
  db: 0,
  keyPrefix: 'myapp:',
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  lazyConnect: true
};
```

### Cache Service Configuration

```typescript
const cacheConfig = {
  defaultTTL: 3600,
  keyPrefix: 'cache:',
  useMemoryFallback: true
};
```

## Cache Keys

The package provides a comprehensive key management system:

```typescript
import { CacheKeys, CacheTags, CacheTTL } from '@taskmanagement/cache';

// Predefined key patterns
const userKey = CacheKeys.user('123');
const projectKey = CacheKeys.project('456');
const taskKey = CacheKeys.task('789');

// Cache tags for bulk invalidation
const userTag = CacheTags.userRelated('123');

// Predefined TTL values
const shortTTL = CacheTTL.SHORT; // 5 minutes
const longTTL = CacheTTL.LONG;   // 1 hour
```

## Error Handling

The cache service handles errors gracefully:

```typescript
try {
  const value = await cacheService.get('key');
} catch (error) {
  // Cache errors are logged but don't throw
  // Returns null on error
}

// Health check
const health = await cacheService.healthCheck();
if (health.status === 'unhealthy') {
  console.log('Cache is not available');
}
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Performance Tips

1. **Use appropriate TTL values** - Balance between data freshness and cache efficiency
2. **Implement cache warming** - Preload frequently accessed data
3. **Use cache tags** - Enable efficient bulk invalidation
4. **Monitor cache metrics** - Track hit rates and performance
5. **Partition large datasets** - Distribute load across multiple cache instances
6. **Compress large values** - Reduce memory usage and network overhead

## API Reference

### CacheService

- `get<T>(key: string): Promise<T | null>`
- `set<T>(key: string, value: T, options?: CacheOptions): Promise<void>`
- `delete(key: string): Promise<void>`
- `exists(key: string): Promise<boolean>`
- `getOrSet<T>(key: string, callback: () => Promise<T>, options?: CacheOptions): Promise<T>`
- `invalidatePattern(pattern: string): Promise<number>`
- `invalidateByTags(tags: string[]): Promise<number>`
- `healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }>`

### Cache Decorators

- `@Cacheable(options?: CacheDecoratorOptions)`
- `@CacheEvict(options?: { keys?: string[]; tags?: string[]; patterns?: string[]; allEntries?: boolean })`
- `@CachePut(options?: CacheDecoratorOptions)`
- `@CacheConditional(options: { condition: (...args: any[]) => boolean })`

## License

MIT