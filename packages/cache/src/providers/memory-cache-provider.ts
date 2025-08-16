import { ICacheService } from '../cache-service-interface';

export interface MemoryCacheConfig {
  maxSize: number;
  defaultTTL: number;
  cleanupInterval: number;
}

export class MemoryCacheProvider implements ICacheService {
  private cache = new Map<string, { value: any; expiry: number }>();
  private cleanupInterval?: NodeJS.Timeout;
  private connected = false;

  constructor(private readonly config: MemoryCacheConfig) {
    this.startCleanupInterval();
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.connected = false;
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }> {
    const startTime = Date.now();
    const testKey = `health-check-${Date.now()}`;
    
    try {
      await this.set(testKey, 'test', 1);
      const value = await this.get(testKey);
      await this.delete(testKey);
      
      const latency = Date.now() - startTime;
      return {
        status: value === 'test' ? 'healthy' : 'unhealthy',
        latency
      };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiry = Date.now() + (ttl || this.config.defaultTTL) * 1000;
    
    // If at capacity, remove oldest item
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { value, expiry });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }

  getSize(): number {
    return this.cache.size;
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.cache) {
      if (now > item.expiry) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }
}