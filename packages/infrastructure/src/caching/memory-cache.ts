import { MemoryCache, MemoryCacheStats } from './interfaces';

/**
 * LRU Memory Cache Implementation
 * Provides L1 caching with automatic eviction
 */
export class LRUMemoryCache implements MemoryCache {
  private cache = new Map<string, { value: any; expiry: number }>();
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  constructor(private readonly maxSize: number = 1000) {}

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);

    if (!item) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.missCount++;
      return null;
    }

    // Update access order
    this.accessOrder.set(key, ++this.accessCounter);
    this.hitCount++;

    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const expiry = Date.now() + ttlSeconds * 1000;

    // If at capacity and key doesn't exist, evict LRU item
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, { value, expiry });
    this.accessOrder.set(key, ++this.accessCounter);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.accessOrder.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): MemoryCacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate =
      totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: Math.round(hitRate * 100) / 100,
      evictionCount: this.evictionCount,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.cache) {
      if (now > item.expiry) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruAccess = Infinity;

    for (const [key, access] of this.accessOrder) {
      if (access < lruAccess) {
        lruAccess = access;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessOrder.delete(lruKey);
      this.evictionCount++;
    }
  }
}