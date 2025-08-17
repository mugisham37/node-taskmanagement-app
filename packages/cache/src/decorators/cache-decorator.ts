import { ICacheProvider } from '../providers/cache-provider.interface';

export interface CacheOptions {
  ttl?: number;
  keyGenerator?: (...args: any[]) => string;
  condition?: (...args: any[]) => boolean;
  tags?: string[];
}

export function Cacheable(options: CacheOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const cacheProvider: ICacheProvider = target.cacheProvider || target.constructor.cacheProvider;

    if (!cacheProvider) {
      throw new Error('Cache provider not found. Ensure the class has a cacheProvider property.');
    }

    descriptor.value = async function (...args: any[]) {
      // Check condition if provided
      if (options.condition && !options.condition.apply(this, args)) {
        return method.apply(this, args);
      }

      // Generate cache key
      const key = options.keyGenerator 
        ? options.keyGenerator.apply(this, args)
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      // Try to get from cache
      const cached = await cacheProvider.get(key);
      if (cached !== null) {
        return cached;
      }

      // Execute method and cache result
      const result = await method.apply(this, args);
      if (result !== null && result !== undefined) {
        await cacheProvider.set(key, result, options.ttl);
      }

      return result;
    };

    return descriptor;
  };
}

export function CacheEvict(options: { key?: string; pattern?: string; allEntries?: boolean } = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const cacheProvider: ICacheProvider = target.cacheProvider || target.constructor.cacheProvider;

    if (!cacheProvider) {
      throw new Error('Cache provider not found. Ensure the class has a cacheProvider property.');
    }

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);

      // Evict cache entries
      if (options.allEntries) {
        await cacheProvider.clear();
      } else if (options.pattern) {
        await cacheProvider.invalidatePattern(options.pattern);
      } else if (options.key) {
        await cacheProvider.delete(options.key);
      }

      return result;
    };

    return descriptor;
  };
}

export function CachePut(options: CacheOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const cacheProvider: ICacheProvider = target.cacheProvider || target.constructor.cacheProvider;

    if (!cacheProvider) {
      throw new Error('Cache provider not found. Ensure the class has a cacheProvider property.');
    }

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);

      // Always update cache with new result
      const key = options.keyGenerator 
        ? options.keyGenerator.apply(this, args)
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      if (result !== null && result !== undefined) {
        await cacheProvider.set(key, result, options.ttl);
      }

      return result;
    };

    return descriptor;
  };
}