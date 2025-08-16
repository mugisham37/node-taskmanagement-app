import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '../cache-service';
import { RedisClient } from '../providers/redis-client';

// Mock Redis client
const mockRedisClient = {
  isConnected: vi.fn(() => true),
  connect: vi.fn(),
  disconnect: vi.fn(),
  getClient: vi.fn(() => ({
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    keys: vi.fn(),
    smembers: vi.fn(),
    sadd: vi.fn(),
    srem: vi.fn(),
    incrby: vi.fn(),
    decrby: vi.fn(),
    info: vi.fn(),
    ping: vi.fn(() => Promise.resolve('PONG'))
  }))
};

describe('CacheService', () => {
  let cacheService: CacheService;
  let redisClient: RedisClient;

  beforeEach(() => {
    redisClient = mockRedisClient as any;
    cacheService = new CacheService(redisClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      const mockClient = redisClient.getClient();
      mockClient.get = vi.fn().mockResolvedValue(null);

      const result = await cacheService.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should return parsed value for existing key', async () => {
      const mockClient = redisClient.getClient();
      const testValue = { test: 'data' };
      mockClient.get = vi.fn().mockResolvedValue(JSON.stringify(testValue));

      const result = await cacheService.get('test-key');
      expect(result).toEqual(testValue);
    });

    it('should handle JSON parse errors gracefully', async () => {
      const mockClient = redisClient.getClient();
      mockClient.get = vi.fn().mockResolvedValue('invalid-json');

      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value with default TTL', async () => {
      const mockClient = redisClient.getClient();
      mockClient.setex = vi.fn().mockResolvedValue('OK');

      const testValue = { test: 'data' };
      await cacheService.set('test-key', testValue);

      expect(mockClient.setex).toHaveBeenCalledWith(
        'cache:test-key',
        3600, // default TTL
        JSON.stringify(testValue)
      );
    });

    it('should set value with custom TTL', async () => {
      const mockClient = redisClient.getClient();
      mockClient.setex = vi.fn().mockResolvedValue('OK');

      const testValue = { test: 'data' };
      await cacheService.set('test-key', testValue, { ttl: 1800 });

      expect(mockClient.setex).toHaveBeenCalledWith(
        'cache:test-key',
        1800,
        JSON.stringify(testValue)
      );
    });
  });

  describe('delete', () => {
    it('should delete key from cache', async () => {
      const mockClient = redisClient.getClient();
      mockClient.del = vi.fn().mockResolvedValue(1);

      await cacheService.delete('test-key');

      expect(mockClient.del).toHaveBeenCalledWith('cache:test-key');
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      const mockClient = redisClient.getClient();
      mockClient.exists = vi.fn().mockResolvedValue(1);

      const result = await cacheService.exists('test-key');
      expect(result).toBe(true);
    });

    it('should return false for non-existing key', async () => {
      const mockClient = redisClient.getClient();
      mockClient.exists = vi.fn().mockResolvedValue(0);

      const result = await cacheService.exists('test-key');
      expect(result).toBe(false);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const mockClient = redisClient.getClient();
      const cachedValue = { cached: true };
      mockClient.get = vi.fn().mockResolvedValue(JSON.stringify(cachedValue));

      const callback = vi.fn();
      const result = await cacheService.getOrSet('test-key', callback);

      expect(result).toEqual(cachedValue);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should execute callback and cache result if not exists', async () => {
      const mockClient = redisClient.getClient();
      mockClient.get = vi.fn().mockResolvedValue(null);
      mockClient.setex = vi.fn().mockResolvedValue('OK');

      const callbackResult = { fresh: true };
      const callback = vi.fn().mockResolvedValue(callbackResult);

      const result = await cacheService.getOrSet('test-key', callback);

      expect(result).toEqual(callbackResult);
      expect(callback).toHaveBeenCalled();
      expect(mockClient.setex).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when cache is working', async () => {
      const mockClient = redisClient.getClient();
      mockClient.ping = vi.fn().mockResolvedValue('PONG');

      const result = await cacheService.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.latency).toBeGreaterThan(0);
    });

    it('should return unhealthy status when cache fails', async () => {
      const mockClient = redisClient.getClient();
      mockClient.ping = vi.fn().mockRejectedValue(new Error('Connection failed'));

      const result = await cacheService.healthCheck();

      expect(result.status).toBe('unhealthy');
    });
  });
});