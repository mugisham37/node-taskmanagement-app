import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cacheable, CacheEvict } from '../decorators/cache-decorators';

// Mock MultiLayerCache
const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  invalidateByTag: vi.fn(),
  invalidateByPattern: vi.fn(),
  clear: vi.fn()
};

class TestService {
  cache = mockCache as any;

  @Cacheable({
    keyGenerator: (id: string) => `user:${id}`,
    ttl: 300
  })
  async getUser(id: string) {
    return { id, name: `User ${id}` };
  }

  @Cacheable()
  async getProject(id: string) {
    return { id, name: `Project ${id}` };
  }

  @CacheEvict({
    keys: (id: string) => [`user:${id}`],
    tags: ['user']
  })
  async updateUser(id: string, data: any) {
    return { id, ...data };
  }

  @CacheEvict({ allEntries: true })
  async clearAll() {
    return 'cleared';
  }
}

describe('Cache Decorators', () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
    vi.clearAllMocks();
  });

  describe('@Cacheable', () => {
    it('should return cached value if exists', async () => {
      const cachedUser = { id: '1', name: 'Cached User' };
      mockCache.get.mockResolvedValue(cachedUser);

      const result = await service.getUser('1');

      expect(result).toEqual(cachedUser);
      expect(mockCache.get).toHaveBeenCalledWith('user:1', undefined);
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should execute method and cache result if not cached', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCache.set.mockResolvedValue(undefined);

      const result = await service.getUser('1');

      expect(result).toEqual({ id: '1', name: 'User 1' });
      expect(mockCache.get).toHaveBeenCalledWith('user:1', undefined);
      expect(mockCache.set).toHaveBeenCalledWith(
        'user:1',
        { id: '1', name: 'User 1' },
        { ttl: 300 }
      );
    });

    it('should use default key generator when none provided', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCache.set.mockResolvedValue(undefined);

      await service.getProject('1');

      expect(mockCache.get).toHaveBeenCalledWith(
        'TestService:getProject:["1"]',
        undefined
      );
    });
  });

  describe('@CacheEvict', () => {
    it('should evict specific keys after method execution', async () => {
      mockCache.delete.mockResolvedValue(undefined);

      const result = await service.updateUser('1', { name: 'Updated User' });

      expect(result).toEqual({ id: '1', name: 'Updated User' });
      expect(mockCache.delete).toHaveBeenCalledWith('user:1');
      expect(mockCache.invalidateByTag).toHaveBeenCalledWith('user');
    });

    it('should clear all entries when allEntries is true', async () => {
      mockCache.clear.mockResolvedValue(undefined);

      const result = await service.clearAll();

      expect(result).toBe('cleared');
      expect(mockCache.clear).toHaveBeenCalled();
    });

    it('should handle eviction errors gracefully', async () => {
      mockCache.delete.mockRejectedValue(new Error('Eviction failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.updateUser('1', { name: 'Updated User' });

      expect(result).toEqual({ id: '1', name: 'Updated User' });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Cache eviction error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});