import { CacheManager } from './cache-manager';

export interface QueryCacheOptions {
  ttl?: number;
  staleWhileRevalidate?: boolean;
  dependencies?: string[];
  tags?: string[];
}

export class QueryCache {
  constructor(private cacheManager: CacheManager) {}

  async query<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<T> {
    const {
      ttl = 300,
      staleWhileRevalidate = false,
      dependencies = [],
      tags = [],
    } = options;

    const cacheKey = `query:${key}`;
    
    if (staleWhileRevalidate) {
      return this.staleWhileRevalidateQuery(cacheKey, queryFn, ttl, dependencies);
    }

    return this.cacheManager.getOrSet(cacheKey, queryFn, ttl);
  }

  private async staleWhileRevalidateQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl: number,
    dependencies: string[]
  ): Promise<T> {
    const cached = await this.cacheManager.get<{
      data: T;
      timestamp: number;
      ttl: number;
    }>(key);

    const now = Date.now();
    const isStale = cached && (now - cached.timestamp) > (cached.ttl * 1000);

    if (cached && !isStale) {
      return cached.data;
    }

    if (cached && isStale) {
      // Return stale data immediately and revalidate in background
      this.revalidateInBackground(key, queryFn, ttl);
      return cached.data;
    }

    // No cached data, fetch fresh
    const data = await queryFn();
    await this.cacheManager.set(key, {
      data,
      timestamp: now,
      ttl,
    }, ttl);

    return data;
  }

  private async revalidateInBackground<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl: number
  ): Promise<void> {
    try {
      const data = await queryFn();
      await this.cacheManager.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
      }, ttl);
    } catch (error) {
      console.error('Background revalidation failed:', error);
    }
  }

  async invalidate(key: string): Promise<void> {
    await this.cacheManager.delete(`query:${key}`);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    await this.cacheManager.invalidateQueries(pattern);
  }

  async invalidateTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.invalidatePattern(`*:${tag}:*`);
    }
  }

  // Batch operations
  async batchQuery<T>(
    queries: Array<{
      key: string;
      queryFn: () => Promise<T>;
      options?: QueryCacheOptions;
    }>
  ): Promise<T[]> {
    const promises = queries.map(({ key, queryFn, options }) =>
      this.query(key, queryFn, options)
    );

    return Promise.all(promises);
  }

  // Prefetching
  async prefetch<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<void> {
    const cacheKey = `query:${key}`;
    const cached = await this.cacheManager.get(cacheKey);
    
    if (!cached) {
      // Only prefetch if not already cached
      try {
        await this.query(key, queryFn, options);
      } catch (error) {
        console.warn(`Prefetch failed for ${key}:`, error);
      }
    }
  }

  async prefetchBatch(
    queries: Array<{
      key: string;
      queryFn: () => Promise<any>;
      options?: QueryCacheOptions;
    }>
  ): Promise<void> {
    const promises = queries.map(({ key, queryFn, options }) =>
      this.prefetch(key, queryFn, options)
    );

    await Promise.allSettled(promises);
  }
}