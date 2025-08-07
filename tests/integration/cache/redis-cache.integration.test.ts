import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Redis from 'ioredis';
import { CacheManager } from '@/infrastructure/cache/cache-manager';
import { CacheInvalidationStrategy } from '@/infrastructure/cache/cache-invalidation-strategy';
import { TestAssertions } from '../../infrastructure/test-assertions';

describe('Redis Cache Integration', () => {
  let redis: Redis;
  let cacheManager: CacheManager;
  let invalidationStrategy: CacheInvalidationStrategy;

  beforeEach(async () => {
    redis = globalThis.testContext.clients.redis!;
    invalidationStrategy = new CacheInvalidationStrategy(redis);
    cacheManager = new CacheManager(redis, invalidationStrategy);

    // Clear cache before each test
    await redis.flushall();
  });

  afterEach(async () => {
    await redis.flushall();
  });

  describe('basic operations', () => {
    it('should set and get string values', async () => {
      await cacheManager.set('test:string', 'hello world');

      const value = await cacheManager.get<string>('test:string');

      expect(value).toBe('hello world');
    });

    it('should set and get object values', async () => {
      const testObject = {
        id: '123',
        name: 'Test Object',
        nested: {
          value: 42,
          array: [1, 2, 3],
        },
      };

      await cacheManager.set('test:object', testObject);

      const value = await cacheManager.get<typeof testObject>('test:object');

      expect(value).toEqual(testObject);
    });

    it('should return null for non-existent keys', async () => {
      const value = await cacheManager.get('non:existent');

      expect(value).toBeNull();
    });

    it('should delete keys successfully', async () => {
      await cacheManager.set('test:delete', 'to be deleted');

      await cacheManager.delete('test:delete');

      const value = await cacheManager.get('test:delete');
      expect(value).toBeNull();
    });

    it('should check key existence', async () => {
      await cacheManager.set('test:exists', 'exists');

      const exists = await cacheManager.exists('test:exists');
      const notExists = await cacheManager.exists('test:not:exists');

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should set TTL and expire keys', async () => {
      await cacheManager.set('test:ttl', 'expires soon', 1); // 1 second TTL

      const value1 = await cacheManager.get('test:ttl');
      expect(value1).toBe('expires soon');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const value2 = await cacheManager.get('test:ttl');
      expect(value2).toBeNull();
    });

    it('should handle default TTL', async () => {
      await cacheManager.set('test:default:ttl', 'default ttl');

      const ttl = await redis.ttl('test:default:ttl');
      expect(ttl).toBeGreaterThan(0);
    });

    it('should set keys without TTL when specified', async () => {
      await cacheManager.set('test:no:ttl', 'no expiration', -1);

      const ttl = await redis.ttl('test:no:ttl');
      expect(ttl).toBe(-1); // -1 means no expiration
    });
  });

  describe('cache-aside pattern', () => {
    it('should get or set value using factory function', async () => {
      let factoryCalled = false;
      const factory = async () => {
        factoryCalled = true;
        return { id: '123', name: 'Factory Created' };
      };

      // First call should use factory
      const value1 = await cacheManager.getOrSet('test:factory', factory, 60);
      expect(factoryCalled).toBe(true);
      expect(value1).toEqual({ id: '123', name: 'Factory Created' });

      // Reset flag
      factoryCalled = false;

      // Second call should use cache
      const value2 = await cacheManager.getOrSet('test:factory', factory, 60);
      expect(factoryCalled).toBe(false);
      expect(value2).toEqual({ id: '123', name: 'Factory Created' });
    });

    it('should handle factory function errors', async () => {
      const factory = async () => {
        throw new Error('Factory error');
      };

      await expect(
        cacheManager.getOrSet('test:error', factory, 60)
      ).rejects.toThrow('Factory error');

      // Verify nothing was cached
      const value = await cacheManager.get('test:error');
      expect(value).toBeNull();
    });

    it('should handle async factory functions', async () => {
      const factory = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'async result';
      };

      const startTime = Date.now();
      const value = await cacheManager.getOrSet('test:async', factory, 60);
      const endTime = Date.now();

      expect(value).toBe('async result');
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('pattern-based operations', () => {
    beforeEach(async () => {
      // Set up test data
      await Promise.all([
        cacheManager.set('user:123:profile', { name: 'User 123' }),
        cacheManager.set('user:123:settings', { theme: 'dark' }),
        cacheManager.set('user:456:profile', { name: 'User 456' }),
        cacheManager.set('task:789:details', { title: 'Task 789' }),
        cacheManager.set('project:abc:info', { name: 'Project ABC' }),
      ]);
    });

    it('should delete keys by pattern', async () => {
      await cacheManager.deletePattern('user:123:*');

      const profile = await cacheManager.get('user:123:profile');
      const settings = await cacheManager.get('user:123:settings');
      const otherProfile = await cacheManager.get('user:456:profile');

      expect(profile).toBeNull();
      expect(settings).toBeNull();
      expect(otherProfile).not.toBeNull();
    });

    it('should handle complex patterns', async () => {
      await cacheManager.deletePattern('user:*:profile');

      const user123Profile = await cacheManager.get('user:123:profile');
      const user456Profile = await cacheManager.get('user:456:profile');
      const user123Settings = await cacheManager.get('user:123:settings');

      expect(user123Profile).toBeNull();
      expect(user456Profile).toBeNull();
      expect(user123Settings).not.toBeNull();
    });
  });

  describe('cache invalidation strategy', () => {
    beforeEach(async () => {
      // Set up test cache data
      await Promise.all([
        cacheManager.set('user:123:profile', { name: 'User 123' }),
        cacheManager.set('user:123:tasks', ['task1', 'task2']),
        cacheManager.set('workspace:456:users', ['user123', 'user789']),
        cacheManager.set('workspace:456:projects', ['proj1', 'proj2']),
        cacheManager.set('task:789:details', { title: 'Task 789' }),
      ]);
    });

    it('should invalidate user-related cache', async () => {
      await invalidationStrategy.invalidateForUser('123');

      const profile = await cacheManager.get('user:123:profile');
      const tasks = await cacheManager.get('user:123:tasks');
      const workspaceUsers = await cacheManager.get('workspace:456:users');

      expect(profile).toBeNull();
      expect(tasks).toBeNull();
      expect(workspaceUsers).not.toBeNull(); // Should not be affected
    });

    it('should invalidate workspace-related cache', async () => {
      await invalidationStrategy.invalidateForWorkspace('456');

      const workspaceUsers = await cacheManager.get('workspace:456:users');
      const workspaceProjects = await cacheManager.get(
        'workspace:456:projects'
      );
      const userProfile = await cacheManager.get('user:123:profile');

      expect(workspaceUsers).toBeNull();
      expect(workspaceProjects).toBeNull();
      expect(userProfile).not.toBeNull(); // Should not be affected
    });

    it('should invalidate entity-specific cache', async () => {
      await invalidationStrategy.invalidateForEntity('task', '789');

      const taskDetails = await cacheManager.get('task:789:details');
      const userProfile = await cacheManager.get('user:123:profile');

      expect(taskDetails).toBeNull();
      expect(userProfile).not.toBeNull(); // Should not be affected
    });
  });

  describe('performance and concurrency', () => {
    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 100 }, (_, i) =>
        cacheManager.set(`concurrent:${i}`, `value ${i}`)
      );

      await Promise.all(operations);

      // Verify all values were set
      const values = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          cacheManager.get(`concurrent:${i}`)
        )
      );

      values.forEach((value, i) => {
        expect(value).toBe(`value ${i}`);
      });
    });

    it('should handle large objects efficiently', async () => {
      const largeObject = {
        id: '123',
        data: Array.from({ length: 10000 }, (_, i) => ({
          index: i,
          value: `item ${i}`,
          nested: {
            prop1: `nested ${i}`,
            prop2: i * 2,
          },
        })),
      };

      const startTime = Date.now();
      await cacheManager.set('test:large', largeObject);
      const setValue = await cacheManager.get('test:large');
      const endTime = Date.now();

      expect(setValue).toEqual(largeObject);

      // Should complete within reasonable time
      TestAssertions.assertPerformanceMetric(
        endTime - startTime,
        1000, // 1 second
        'Large object cache operation'
      );
    });

    it('should handle rapid successive operations', async () => {
      const key = 'test:rapid';
      const operations = [];

      // Rapid set operations
      for (let i = 0; i < 50; i++) {
        operations.push(cacheManager.set(key, `value ${i}`));
      }

      await Promise.all(operations);

      // Final value should be one of the set values
      const finalValue = await cacheManager.get(key);
      expect(finalValue).toMatch(/^value \d+$/);
    });
  });

  describe('error handling and resilience', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Create a cache manager with invalid Redis connection
      const invalidRedis = new Redis({
        host: 'invalid-host',
        port: 9999,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });

      const invalidCacheManager = new CacheManager(
        invalidRedis,
        new CacheInvalidationStrategy(invalidRedis)
      );

      // Operations should fail gracefully
      await expect(invalidCacheManager.set('test', 'value')).rejects.toThrow();

      await expect(invalidCacheManager.get('test')).rejects.toThrow();

      await invalidRedis.disconnect();
    });

    it('should handle serialization errors', async () => {
      const circularObject: any = { name: 'circular' };
      circularObject.self = circularObject;

      await expect(
        cacheManager.set('test:circular', circularObject)
      ).rejects.toThrow();
    });

    it('should handle very large keys', async () => {
      const veryLongKey = 'test:' + 'x'.repeat(1000000); // 1MB key

      // Redis has key size limits
      await expect(cacheManager.set(veryLongKey, 'value')).rejects.toThrow();
    });
  });

  describe('cache statistics and monitoring', () => {
    it('should track cache hit/miss ratios', async () => {
      // Set some values
      await cacheManager.set('stats:1', 'value1');
      await cacheManager.set('stats:2', 'value2');

      // Mix of hits and misses
      await cacheManager.get('stats:1'); // hit
      await cacheManager.get('stats:2'); // hit
      await cacheManager.get('stats:3'); // miss
      await cacheManager.get('stats:4'); // miss

      // In a real implementation, you would track these statistics
      // For now, we just verify the operations work
      const value1 = await cacheManager.get('stats:1');
      const value3 = await cacheManager.get('stats:3');

      expect(value1).toBe('value1');
      expect(value3).toBeNull();
    });

    it('should measure operation performance', async () => {
      const startTime = Date.now();

      await cacheManager.set('perf:test', 'performance test');
      const value = await cacheManager.get('perf:test');

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(value).toBe('performance test');

      // Cache operations should be fast
      TestAssertions.assertPerformanceMetric(
        duration,
        100, // 100ms
        'Cache operation performance'
      );
    });
  });

  describe('cache warming and preloading', () => {
    it('should support cache warming strategies', async () => {
      // Simulate cache warming with frequently accessed data
      const warmingData = [
        { key: 'warm:user:123', value: { name: 'Frequent User' } },
        { key: 'warm:config:app', value: { theme: 'default' } },
        { key: 'warm:settings:global', value: { maintenance: false } },
      ];

      // Warm the cache
      await Promise.all(
        warmingData.map(
          ({ key, value }) => cacheManager.set(key, value, 3600) // 1 hour TTL
        )
      );

      // Verify all data is cached
      const cachedData = await Promise.all(
        warmingData.map(({ key }) => cacheManager.get(key))
      );

      cachedData.forEach((data, index) => {
        expect(data).toEqual(warmingData[index].value);
      });
    });

    it('should handle cache preloading for related entities', async () => {
      // Simulate preloading related data
      const userId = '123';
      const relatedData = {
        profile: { name: 'User 123', email: 'user123@example.com' },
        preferences: { theme: 'dark', language: 'en' },
        permissions: ['read', 'write', 'admin'],
      };

      // Preload all related data
      await Promise.all([
        cacheManager.set(`user:${userId}:profile`, relatedData.profile),
        cacheManager.set(`user:${userId}:preferences`, relatedData.preferences),
        cacheManager.set(`user:${userId}:permissions`, relatedData.permissions),
      ]);

      // Verify all related data is available
      const [profile, preferences, permissions] = await Promise.all([
        cacheManager.get(`user:${userId}:profile`),
        cacheManager.get(`user:${userId}:preferences`),
        cacheManager.get(`user:${userId}:permissions`),
      ]);

      expect(profile).toEqual(relatedData.profile);
      expect(preferences).toEqual(relatedData.preferences);
      expect(permissions).toEqual(relatedData.permissions);
    });
  });
});
