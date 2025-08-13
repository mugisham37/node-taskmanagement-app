/**
 * Cache Service Interface
 * Defines the contract for cache services
 */
export interface ICacheService {
  /**
   * Connect to the cache service
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the cache service
   */
  disconnect(): Promise<void>;

  /**
   * Check if the cache service is healthy
   */
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }>;

  /**
   * Get a value from cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a value from cache
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * Check if cache is connected
   */
  isConnected(): boolean;
}
