import { CacheDecoratorOptions, CacheInvalidationOptions, CacheService } from './interfaces';

/**
 * Cache decorator implementation
 */
export class CacheDecorator {
  constructor(private readonly cacheService: CacheService) {}

  /**
   * Cache method result decorator
   */
  cache(options: CacheDecoratorOptions = {}): MethodDecorator {
    return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        // Generate cache key
        const cacheKey = typeof options.key === 'function' 
          ? options.key(args)
          : options.key || `${target.constructor.name}.${String(propertyKey)}:${JSON.stringify(args)}`;

        // Check condition if provided
        if (options.condition && !options.condition(args)) {
          return originalMethod.apply(this, args);
        }

        // Try to get from cache
        const cachedResult = await this.cacheService.get(cacheKey);
        if (cachedResult !== null) {
          return cachedResult;
        }

        // Execute original method
        const result = await originalMethod.apply(this, args);

        // Cache the result
        await this.cacheService.set(cacheKey, result, options.ttl);

        return result;
      };

      return descriptor;
    };
  }

  /**
   * Cache invalidation decorator
   */
  invalidate(options: CacheInvalidationOptions = {}): MethodDecorator {
    return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        // Execute original method first
        const result = await originalMethod.apply(this, args);

        // Invalidate cache keys
        if (options.keys) {
          const keys = typeof options.keys === 'function' 
            ? options.keys(args)
            : options.keys;
          
          for (const key of keys) {
            await this.cacheService.delete(key);
          }
        }

        // Invalidate cache patterns
        if (options.patterns) {
          const patterns = typeof options.patterns === 'function'
            ? options.patterns(args)
            : options.patterns;
          
          for (const pattern of patterns) {
            await this.cacheService.invalidatePattern(pattern);
          }
        }

        return result;
      };

      return descriptor;
    };
  }
}

/**
 * Create cache decorator with cache service
 */
export function createCacheDecorator(cacheService: CacheService): CacheDecorator {
  return new CacheDecorator(cacheService);
}

/**
 * Cache method result
 */
export function Cache(options: CacheDecoratorOptions = {}) {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // This will be replaced with actual cache service at runtime
    const cacheKey = options.key || `${target.constructor.name}.${String(propertyKey)}`;
    
    // Store metadata for later processing
    Reflect.defineMetadata('cache:options', { ...options, key: cacheKey }, target, propertyKey);
    
    return descriptor;
  };
}

/**
 * Invalidate cache
 */
export function InvalidateCache(options: CacheInvalidationOptions = {}) {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Store metadata for later processing
    Reflect.defineMetadata('cache:invalidate', options, target, propertyKey);
    
    return descriptor;
  };
}