import { getCacheManager } from './cache-manager';

export interface CacheDecoratorOptions {
  ttl?: number;
  namespace?: string;
  keyGenerator?: (...args: any[]) => string;
  condition?: (...args: any[]) => boolean;
  tags?: string[];
}

export class CacheDecorator {
  static cache(options: CacheDecoratorOptions = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      const {
        ttl = 300,
        namespace = 'method',
        keyGenerator,
        condition,
        tags = [],
      } = options;

      descriptor.value = async function (...args: any[]) {
        const cacheManager = getCacheManager();
        if (!cacheManager) {
          return originalMethod.apply(this, args);
        }

        // Check condition if provided
        if (condition && !condition.apply(this, args)) {
          return originalMethod.apply(this, args);
        }

        // Generate cache key
        const key = keyGenerator
          ? keyGenerator.apply(this, args)
          : `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;

        return cacheManager.getOrSet(
          key,
          () => originalMethod.apply(this, args),
          ttl,
          namespace
        );
      };

      return descriptor;
    };
  }

  static invalidateOnUpdate(cacheKeys: string[] | ((...args: any[]) => string[])) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const result = await originalMethod.apply(this, args);
        
        const cacheManager = getCacheManager();
        if (cacheManager) {
          const keys = typeof cacheKeys === 'function' 
            ? cacheKeys.apply(this, args)
            : cacheKeys;

          for (const key of keys) {
            await cacheManager.delete(key);
          }
        }

        return result;
      };

      return descriptor;
    };
  }

  static warmCache(warmupFn: (...args: any[]) => Promise<void>) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        // Execute warmup function in background
        warmupFn.apply(this, args).catch(error => {
          console.warn('Cache warmup failed:', error);
        });

        return originalMethod.apply(this, args);
      };

      return descriptor;
    };
  }
}

// Functional decorators for non-class usage
export function cacheResult<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: CacheDecoratorOptions = {}
): T {
  const {
    ttl = 300,
    namespace = 'function',
    keyGenerator,
    condition,
  } = options;

  return (async (...args: any[]) => {
    const cacheManager = getCacheManager();
    if (!cacheManager) {
      return fn(...args);
    }

    // Check condition if provided
    if (condition && !condition(...args)) {
      return fn(...args);
    }

    // Generate cache key
    const key = keyGenerator
      ? keyGenerator(...args)
      : `${fn.name}:${JSON.stringify(args)}`;

    return cacheManager.getOrSet(
      key,
      () => fn(...args),
      ttl,
      namespace
    );
  }) as T;
}

export function invalidateCache(keys: string | string[], namespace?: string) {
  return async () => {
    const cacheManager = getCacheManager();
    if (!cacheManager) return;

    const keyList = Array.isArray(keys) ? keys : [keys];
    
    for (const key of keyList) {
      await cacheManager.delete(key, namespace);
    }
  };
}

// Memoization with cache
export function memoizeWithCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: CacheDecoratorOptions = {}
): T {
  const cache = new Map<string, { value: any; timestamp: number; ttl: number }>();
  const { ttl = 300000, keyGenerator } = options; // Default 5 minutes

  return (async (...args: any[]) => {
    const key = keyGenerator
      ? keyGenerator(...args)
      : JSON.stringify(args);

    const now = Date.now();
    const cached = cache.get(key);

    if (cached && (now - cached.timestamp) < cached.ttl) {
      return cached.value;
    }

    const value = await fn(...args);
    cache.set(key, { value, timestamp: now, ttl });

    return value;
  }) as T;
}

// Cache-aside pattern helper
export async function cacheAside<T>(
  key: string,
  fetchFn: () => Promise<T>,
  updateFn?: (data: T) => Promise<void>,
  ttl?: number,
  namespace?: string
): Promise<T> {
  const cacheManager = getCacheManager();
  if (!cacheManager) {
    return fetchFn();
  }

  // Try to get from cache
  let data = await cacheManager.get<T>(key, namespace);
  
  if (data === null) {
    // Cache miss - fetch from source
    data = await fetchFn();
    
    // Update cache
    await cacheManager.set(key, data, ttl, namespace);
    
    // Optional: update the source if needed
    if (updateFn) {
      await updateFn(data);
    }
  }

  return data;
}

// Write-through cache pattern
export async function writeThrough<T>(
  key: string,
  data: T,
  writeFn: (data: T) => Promise<void>,
  ttl?: number,
  namespace?: string
): Promise<void> {
  const cacheManager = getCacheManager();
  
  // Write to both cache and source simultaneously
  await Promise.all([
    writeFn(data),
    cacheManager?.set(key, data, ttl, namespace),
  ]);
}

// Write-behind cache pattern
export async function writeBehind<T>(
  key: string,
  data: T,
  writeFn: (data: T) => Promise<void>,
  ttl?: number,
  namespace?: string
): Promise<void> {
  const cacheManager = getCacheManager();
  
  // Write to cache immediately
  await cacheManager?.set(key, data, ttl, namespace);
  
  // Write to source in background
  writeFn(data).catch(error => {
    console.error('Write-behind operation failed:', error);
  });
}