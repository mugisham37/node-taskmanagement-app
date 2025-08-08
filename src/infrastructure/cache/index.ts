/**
 * Consolidated Cache Infrastructure
 * Single point of access for all caching functionality
 */

// Consolidated Cache Infrastructure
export {
  ConsolidatedCacheManager,
  createConsolidatedCacheManager,
  getConsolidatedCacheManager,
} from './consolidated-cache-manager';
export type {
  IMemoryCache,
  MemoryCacheStats,
  CacheStats,
  CacheConfig,
} from './consolidated-cache-manager';

// Legacy cache components (for backward compatibility)
export {
  CacheManager,
  createCacheManager,
  getCacheManager,
  CacheKeyBuilder,
} from './cache-manager';
export type {
  ICacheManager,
  CacheStats as LegacyCacheStats,
  CacheInvalidationRule,
  CacheStrategy,
  CacheContext,
} from './cache-manager';

export {
  ICacheClient,
  getCacheClient,
  createCacheClient,
  connectCache,
  disconnectCache,
  cacheHealthCheck,
} from './redis-client';
