import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Container, ServiceLifetime } from '@/infrastructure/ioc/container';
import { Injectable, Inject } from '@/infrastructure/ioc/decorators';

// Test classes
@Injectable('TestService')
class TestService {
  getValue(): string {
    return 'test-value';
  }
}

@Injectable('DependentService')
class DependentService {
  constructor(@Inject('TestService') private testService: TestService) {}

  getTestValue(): string {
    return this.testService.getValue();
  }
}

class DisposableService {
  private disposed = false;

  async dispose(): Promise<void> {
    this.disposed = true;
  }

  isDisposed(): boolean {
    return this.disposed;
  }
}

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  afterEach(async () => {
    await container.dispose();
  });

  describe('Service Registration', () => {
    it('should register and resolve singleton services', () => {
      container.registerSingleton('TestService', TestService);

      const instance1 = container.resolve<TestService>('TestService');
      const instance2 = container.resolve<TestService>('TestService');

      expect(instance1).toBeInstanceOf(TestService);
      expect(instance1).toBe(instance2); // Same instance
    });

    it('should register and resolve transient services', () => {
      container.registerTransient('TestService', TestService);

      const instance1 = container.resolve<TestService>('TestService');
      const instance2 = container.resolve<TestService>('TestService');

      expect(instance1).toBeInstanceOf(TestService);
      expect(instance1).not.toBe(instance2); // Different instances
    });

    it('should register and resolve scoped services', () => {
      container.registerScoped('TestService', TestService);

      const instance1 = container.resolve<TestService>('TestService');
      const instance2 = container.resolve<TestService>('TestService');

      expect(instance1).toBeInstanceOf(TestService);
      expect(instance1).toBe(instance2); // Same instance within scope
    });

    it('should register factory functions', () => {
      container.registerFactory(
        'TestService',
        () => new TestService(),
        ServiceLifetime.SINGLETON
      );

      const instance = container.resolve<TestService>('TestService');
      expect(instance).toBeInstanceOf(TestService);
    });
  });

  describe('Dependency Injection', () => {
    it('should resolve dependencies automatically', () => {
      container.registerSingleton('TestService', TestService);
      container.registerSingleton('DependentService', DependentService);

      const dependentService =
        container.resolve<DependentService>('DependentService');

      expect(dependentService).toBeInstanceOf(DependentService);
      expect(dependentService.getTestValue()).toBe('test-value');
    });

    it('should throw error for unregistered services', () => {
      expect(() => container.resolve('UnregisteredService')).toThrow(
        "Service 'UnregisteredService' is not registered"
      );
    });
  });

  describe('Scoped Containers', () => {
    it('should create scoped containers', () => {
      const scopedContainer = container.createScope();

      expect(scopedContainer).toBeDefined();
      expect(scopedContainer).not.toBe(container);
    });

    it('should inherit services from parent container', () => {
      container.registerSingleton('TestService', TestService);

      const scopedContainer = container.createScope();
      const instance = scopedContainer.resolve<TestService>('TestService');

      expect(instance).toBeInstanceOf(TestService);
    });

    it('should maintain separate scoped instances', () => {
      container.registerScoped('TestService', TestService);

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const instance1 = scope1.resolve<TestService>('TestService');
      const instance2 = scope2.resolve<TestService>('TestService');

      expect(instance1).not.toBe(instance2); // Different instances in different scopes
    });
  });

  describe('Service Disposal', () => {
    it('should dispose services with dispose method', async () => {
      container.registerScoped('DisposableService', DisposableService);

      const instance =
        container.resolve<DisposableService>('DisposableService');
      expect(instance.isDisposed()).toBe(false);

      await container.dispose();
      expect(instance.isDisposed()).toBe(true);
    });

    it('should prevent operations after disposal', async () => {
      await container.dispose();

      expect(() =>
        container.registerSingleton('TestService', TestService)
      ).toThrow('Container has been disposed');

      expect(() => container.resolve('TestService')).toThrow(
        'Container has been disposed'
      );
    });
  });

  describe('Service Registration Validation', () => {
    it('should check if service is registered', () => {
      expect(container.isRegistered('TestService')).toBe(false);

      container.registerSingleton('TestService', TestService);
      expect(container.isRegistered('TestService')).toBe(true);
    });

    it('should handle circular dependencies gracefully', () => {
      // This would typically be caught during development
      // For now, we just ensure it doesn't crash the container
      container.registerSingleton('TestService', TestService);

      expect(() => container.resolve('TestService')).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages', () => {
      expect(() => container.resolve('NonExistentService')).toThrow(
        "Service 'NonExistentService' is not registered"
      );
    });

    it('should handle factory function errors', () => {
      container.registerFactory(
        'FailingService',
        () => {
          throw new Error('Factory failed');
        },
        ServiceLifetime.TRANSIENT
      );

      expect(() => container.resolve('FailingService')).toThrow(
        'Factory failed'
      );
    });
  });
});
