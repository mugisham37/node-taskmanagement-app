/**
 * Cache Adapters for Infrastructure Layer
 */

import { InfrastructureCacheConfig } from './cache-config';

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

export class InMemoryCacheAdapter implements CacheAdapter {
  private cache = new Map<string, { value: any; expiry: number }>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set<T>(key: string, value: T, ttl = 300): Promise<void> {
    const expiry = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiry });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async keys(pattern: string): Promise<string[]> {
    // Simple pattern matching for in-memory cache
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter((key) => regex.test(key));
  }
}

export class RedisCacheAdapter implements CacheAdapter {
  // This would be implemented with actual Redis client
  // For now, providing interface compatibility

  async get<T>(key: string): Promise<T | null> {
    // Redis implementation would go here
    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Redis implementation would go here
  }

  async del(key: string): Promise<void> {
    // Redis implementation would go here
  }

  async exists(key: string): Promise<boolean> {
    // Redis implementation would go here
    return false;
  }

  async clear(): Promise<void> {
    // Redis implementation would go here
  }

  async keys(pattern: string): Promise<string[]> {
    // Redis implementation would go here
    return [];
  }
}

export function createCacheAdapter(config: InfrastructureCacheConfig): CacheAdapter {
  // For now, return in-memory cache adapter
  // In production, would check config and return appropriate adapter
  return new InMemoryCacheAdapter();
}
