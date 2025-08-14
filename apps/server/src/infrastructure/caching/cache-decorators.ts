import { MultiLayerCache, CacheOptions } from './multi-layer-cache';

export interface CacheDecoratorOptions extends CacheOptions {
  keyGenerator?: (...args: any[]) => string;
  condition?: (...args: any[]) => boolean;
}

// Cache decorator for methods
export function Cacheable(options: CacheDecoratorOptions = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cache = this.cache as MultiLayerCache;
      if (!cache) {
        console.warn('Cache not available, executing method directly');
        return method.apply(this, args);
      }

      // Check condition if provided
      if (options.condition && !options.condition.apply(this, args)) {
        return method.apply(this, args);
      }

      // Generate cache key
      const key = options.keyGenerator
        ? options.keyGenerator.apply(this, args)
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      // Try to get from cache
      const cachedResult = await cache.get(key, options);
      if (cachedResult !== null) {
        return cachedResult;
      }

      // Execute method and cache result
      const result = await method.apply(this, args);
      if (result !== null && result !== undefined) {
        await cache.set(key, result, options);
      }

      return result;
    };

    return descriptor;
  };
}

// Cache eviction decorator
export function CacheEvict(
  options: {
    keys?: string[] | ((...args: any[]) => string[]);
    tags?: string[] | ((...args: any[]) => string[]);
    patterns?: string[] | ((...args: any[]) => string[]);
    allEntries?: boolean;
  } = {}
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);

      const cache = this.cache as MultiLayerCache;
      if (!cache) {
        return result;
      }

      try {
        // Clear all entries if specified
        if (options.allEntries) {
          await cache.clear();
          return result;
        }

        // Evict specific keys
        if (options.keys) {
          const keys =
            typeof options.keys === 'function'
              ? options.keys.apply(this, args)
              : options.keys;

          for (const key of keys) {
            await cache.delete(key);
          }
        }

        // Evict by tags
        if (options.tags) {
          const tags =
            typeof options.tags === 'function'
              ? options.tags.apply(this, args)
              : options.tags;

          for (const tag of tags) {
            await cache.invalidateByTag(tag);
          }
        }

        // Evict by patterns
        if (options.patterns) {
          const patterns =
            typeof options.patterns === 'function'
              ? options.patterns.apply(this, args)
              : options.patterns;

          for (const pattern of patterns) {
            await cache.invalidateByPattern(pattern);
          }
        }
      } catch (error) {
        console.error('Cache eviction error:', error);
      }

      return result;
    };

    return descriptor;
  };
}

// Cache put decorator (always cache the result)
export function CachePut(options: CacheDecoratorOptions = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);

      const cache = this.cache as MultiLayerCache;
      if (!cache) {
        return result;
      }

      // Check condition if provided
      if (options.condition && !options.condition.apply(this, args)) {
        return result;
      }

      // Generate cache key
      const key = options.keyGenerator
        ? options.keyGenerator.apply(this, args)
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      // Always cache the result
      if (result !== null && result !== undefined) {
        await cache.set(key, result, options);
      }

      return result;
    };

    return descriptor;
  };
}

// Conditional cache decorator
export function CacheConditional(options: {
  condition: (...args: any[]) => boolean;
  cacheOptions?: CacheDecoratorOptions;
}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (!options.condition.apply(this, args)) {
        return method.apply(this, args);
      }

      // Apply caching if condition is met
      return Cacheable(options.cacheOptions || {})(
        target,
        propertyName,
        descriptor
      ).value.apply(this, args);
    };

    return descriptor;
  };
}

// Cache warming decorator (for initialization methods)
export function CacheWarm(options: {
  keys: Array<{
    key: string | ((...args: any[]) => string);
    fetcher: (...args: any[]) => Promise<any>;
    options?: CacheOptions;
  }>;
}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);

      const cache = this.cache as MultiLayerCache;
      if (!cache) {
        return result;
      }

      // Warm cache with specified keys
      const warmingKeys = options.keys.map(
        ({ key, fetcher, options: cacheOptions }) => ({
          key: typeof key === 'function' ? key.apply(this, args) : key,
          fetcher: () => fetcher.apply(this, args),
          options: cacheOptions,
        })
      );

      // Don't await cache warming to avoid blocking the main operation
      cache.warmCache(warmingKeys).catch(error => {
        console.error('Cache warming error:', error);
      });

      return result;
    };

    return descriptor;
  };
}
