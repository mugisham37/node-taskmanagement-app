/**
 * Caching Infrastructure
 * Simple exports for infrastructure layer
 */

// Simple cache interface
export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
}

// Basic cache config
export interface CacheConfig {
  defaultTTL: number;
  enabled: boolean;
}

export const defaultCacheConfig: CacheConfig = {
  defaultTTL: 300,
  enabled: true,
};
