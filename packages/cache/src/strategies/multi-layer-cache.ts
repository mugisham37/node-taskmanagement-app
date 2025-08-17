import { ICacheProvider } from '../providers/cache-provider.interface';
import { MemoryProvider } from '../providers/memory-provider';
import { RedisProvider } from '../providers/redis-provider';
import { CacheConfig, CacheStats } from '../types/cache.types';

export class MultiLayerCache implements ICacheProvider {
  private l1Cache: MemoryProvider; // Fast in-memory cache
  private l2Cache: RedisProvider;  // Distributed Redis cache
  private stats: CacheStats;

  constructor(
    private config: CacheConfig,
    redisProvider: RedisProvider,
    memoryProvider?: MemoryProvider
  ) {
    this.l2Cache = redisProvider;
    this.l1Cache = memoryProvider || new MemoryProvider({
      maxSize: config.l1MaxSize || 1000,
      ttl: config.l1Ttl || 300 // 5 minutes
    });
    
    this.stats = {
      hits: 0,
      misses: 0,
      l1Hits: 0,
      l2Hits: 0,
      sets: 0,
      deletes: 0
    };
  }

  async get<T>(key: string): Promise<T | null> {
    // Try L1 cache first (fastest)
    const l1Result = await this.l1Cache.get<T>(key);
    if (l1Result !== null) {
      this.stats.hits++;
      this.stats.l1Hits++;
      return l1Result;
    }

    // Try L2 cache (Redis)
    const l2Result = await this.l2Cache.get<T>(key);
    if (l2Result !== null) {
      this.stats.hits++;
      this.stats.l2Hits++;
      
      // Populate L1 cache for future requests
      await this.l1Cache.set(key, l2Result, this.config.l1Ttl);
      return l2Result;
    }

    this.stats.misses++;
    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTtl = ttl || this.config.defaultTtl || 3600;
    
    // Set in both layers
    await Promise.all([
      this.l1Cache.set(key, value, Math.min(effectiveTtl, this.config.l1Ttl || 300)),
      this.l2Cache.set(key, value, effectiveTtl)
    ]);
    
    this.stats.sets++;
  }

  async delete(key: string): Promise<void> {
    await Promise.all([
      this.l1Cache.delete(key),
      this.l2Cache.delete(key)
    ]);
    
    this.stats.deletes++;
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.l1Cache.clear(),
      this.l2Cache.clear()
    ]);
  }

  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    const l1Misses: string[] = [];

    // Check L1 cache for all keys
    for (const key of keys) {
      const l1Result = await this.l1Cache.get<T>(key);
      if (l1Result !== null) {
        results.set(key, l1Result);
        this.stats.l1Hits++;
      } else {
        l1Misses.push(key);
      }
    }

    // Check L2 cache for L1 misses
    if (l1Misses.length > 0) {
      const l2Results = await this.l2Cache.mget<T>(l1Misses);
      
      for (const [key, value] of l2Results) {
        results.set(key, value);
        this.stats.l2Hits++;
        
        // Populate L1 cache
        await this.l1Cache.set(key, value, this.config.l1Ttl);
      }
    }

    this.stats.hits += results.size;
    this.stats.misses += keys.length - results.size;
    
    return results;
  }

  async mset<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    const effectiveTtl = ttl || this.config.defaultTtl || 3600;
    
    await Promise.all([
      this.l1Cache.mset(entries, Math.min(effectiveTtl, this.config.l1Ttl || 300)),
      this.l2Cache.mset(entries, effectiveTtl)
    ]);
    
    this.stats.sets += entries.size;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  async warmup(keys: string[], loader: (key: string) => Promise<any>): Promise<void> {
    const warmupPromises = keys.map(async (key) => {
      const exists = await this.l2Cache.exists(key);
      if (!exists) {
        try {
          const value = await loader(key);
          if (value !== null && value !== undefined) {
            await this.set(key, value);
          }
        } catch (error) {
          console.warn(`Cache warmup failed for key ${key}:`, error);
        }
      }
    });

    await Promise.all(warmupPromises);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    await Promise.all([
      this.l1Cache.invalidatePattern(pattern),
      this.l2Cache.invalidatePattern(pattern)
    ]);
  }
}