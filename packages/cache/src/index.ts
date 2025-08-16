// Core cache interfaces and services
export { CacheKeyPattern, CacheOptions, CacheService, CacheStats, IMemoryCache, MemoryCacheStats, RedisCacheService } from './cache-service';
export { ICacheService } from './cache-service-interface';
export { MultiLayerCache } from './multi-layer-cache';

// Cache providers
export { MemoryCacheConfig, MemoryCacheProvider } from './providers/memory-cache-provider';
export { RedisClient, RedisConfig } from './providers/redis-client';

// Cache utilities
export { CacheKeys, CacheTTL, CacheTags } from './cache-keys';

// Cache warming
export { CacheWarmer, WarmupConfig, WarmupStrategy } from './warming/cache-warmer';

// Cache strategies
export {
  CachePerformanceMetrics, CacheStrategy, PerformanceCacheStrategies
} from './strategies/performance-cache-strategies';

// Cache decorators
export {
  CacheConditional, CacheDecoratorOptions, CacheEvict,
  CachePut, CacheWarm, Cacheable
} from './decorators/cache-decorators';

// Cache serializers
export {
  BinarySerializer, CompressedJsonSerializer, ICacheSerializer,
  JsonSerializer
} from './serializers/json-serializer';

// Cache invalidation
export {
  CascadingInvalidation, EntityBasedInvalidation, InvalidationContext, InvalidationManager, InvalidationStrategy, TagBasedInvalidation,
  TimeBasedInvalidation
} from './invalidation/invalidation-strategies';

// Cache compression
export {
  CompressionManager, CompressionProvider,
  GzipCompressionProvider,
  LZ4CompressionProvider
} from './compression/compression-utils';

// Cache monitoring
export {
  CacheHealthMonitor, CacheMetrics, CacheMetricsCollector, CacheOperation
} from './monitoring/cache-metrics';

// Cache partitioning
export {
  CachePartitioner, EntityTypePartitionStrategy, HashPartitionStrategy, PartitionContext, PartitionStrategy, UserPartitionStrategy,
  WorkspacePartitionStrategy
} from './partitioning/cache-partitioner';

// Re-export for convenience
export * from './cache-keys';
export * from './cache-service';
export * from './cache-service-interface';
export * from './compression/compression-utils';
export * from './decorators/cache-decorators';
export * from './invalidation/invalidation-strategies';
export * from './monitoring/cache-metrics';
export * from './multi-layer-cache';
export * from './partitioning/cache-partitioner';
export * from './providers/memory-cache-provider';
export * from './providers/redis-client';
export * from './serializers/json-serializer';
export * from './strategies/performance-cache-strategies';
export * from './warming/cache-warmer';
