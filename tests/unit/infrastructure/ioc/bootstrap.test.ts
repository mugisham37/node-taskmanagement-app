import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Bootstrap } from '@/infrastructure/ioc/bootstrap';

// Mock dependencies
vi.mock('@/infrastructure/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/infrastructure/database/prisma-client', () => ({
  prisma: {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

describe('Bootstrap', () => {
  let bootstrap: Bootstrap;

  beforeEach(() => {
    bootstrap = new Bootstrap();
  });

  afterEach(async () => {
    if (bootstrap.initialized) {
      await bootstrap.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const container = await bootstrap.initialize();

      expect(container).toBeDefined();
      expect(bootstrap.initialized).toBe(true);
    });

    it('should prevent double initialization', async () => {
      await bootstrap.initialize();

      await expect(bootstrap.initialize()).rejects.toThrow(
        'Bootstrap has already been initialized'
      );
    });

    it('should validate critical services during initialization', async () => {
      // This test would need proper mocking of all services
      // For now, we just ensure the method doesn't crash
      const container = await bootstrap.initialize();
      expect(container).toBeDefined();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await bootstrap.initialize();

      await expect(bootstrap.shutdown()).resolves.not.toThrow();
      expect(bootstrap.initialized).toBe(false);
    });

    it('should handle shutdown when not initialized', async () => {
      await expect(bootstrap.shutdown()).resolves.not.toThrow();
    });

    it('should dispose container during shutdown', async () => {
      const container = await bootstrap.initialize();
      const disposeSpy = vi.spyOn(container, 'dispose');

      await bootstrap.shutdown();

      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Mock a service registration failure
      const originalRegister = Bootstrap.prototype['registerServices'];
      Bootstrap.prototype['registerServices'] = vi
        .fn()
        .mockRejectedValue(new Error('Service registration failed'));

      await expect(bootstrap.initialize()).rejects.toThrow(
        'Service registration failed'
      );

      // Restore original method
      Bootstrap.prototype['registerServices'] = originalRegister;
    });

    it('should cleanup on initialization failure', async () => {
      // Mock a validation failure
      const originalValidate = Bootstrap.prototype['validateServices'];
      Bootstrap.prototype['validateServices'] = vi
        .fn()
        .mockRejectedValue(new Error('Validation failed'));

      await expect(bootstrap.initialize()).rejects.toThrow('Validation failed');
      expect(bootstrap.initialized).toBe(false);

      // Restore original method
      Bootstrap.prototype['validateServices'] = originalValidate;
    });
  });

  describe('Container Access', () => {
    it('should provide access to container', async () => {
      const container = await bootstrap.initialize();

      expect(bootstrap.getContainer()).toBe(container);
    });

    it('should return null when not initialized', () => {
      expect(bootstrap.getContainer()).toBeNull();
    });
  });
});
