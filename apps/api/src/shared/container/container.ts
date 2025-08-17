import { Container } from './types';
import { ServiceLifetime, ServiceDescriptor } from './service-descriptor';
import { ServiceFactory } from './service-factory';

/**
 * Dependency Injection Container
 * Manages service registration, resolution, and lifecycle
 */
export class DIContainer implements Container {
  private services = new Map<string, ServiceDescriptor>();
  private instances = new Map<string, any>();
  private factory: ServiceFactory;

  constructor() {
    this.factory = new ServiceFactory(this);
  }

  /**
   * Register a service with the container
   */
  register<T>(
    token: string,
    implementation: new (...args: any[]) => T,
    lifetime: ServiceLifetime = ServiceLifetime.Transient,
    dependencies: string[] = []
  ): void {
    const descriptor = new ServiceDescriptor(
      token,
      implementation,
      lifetime,
      dependencies
    );
    this.services.set(token, descriptor);
  }

  /**
   * Register a singleton service
   */
  registerSingleton<T>(
    token: string,
    implementation: new (...args: any[]) => T,
    dependencies: string[] = []
  ): void {
    this.register(
      token,
      implementation,
      ServiceLifetime.Singleton,
      dependencies
    );
  }

  /**
   * Register a scoped service
   */
  registerScoped<T>(
    token: string,
    implementation: new (...args: any[]) => T,
    dependencies: string[] = []
  ): void {
    this.register(token, implementation, ServiceLifetime.Scoped, dependencies);
  }

  /**
   * Register an instance directly
   */
  registerInstance<T>(token: string, instance: T): void {
    this.instances.set(token, instance);
    const constructor = (instance as any).constructor as new (...args: any[]) => T;
    const descriptor = new ServiceDescriptor(
      token,
      constructor,
      ServiceLifetime.Singleton,
      []
    );
    this.services.set(token, descriptor);
  }

  /**
   * Register a factory function
   */
  registerFactory<T>(
    token: string,
    factory: (container: Container) => T,
    lifetime: ServiceLifetime = ServiceLifetime.Transient
  ): void {
    const descriptor = new ServiceDescriptor(
      token,
      factory as any,
      lifetime,
      [],
      true
    );
    this.services.set(token, descriptor);
  }

  /**
   * Resolve a service by token
   */
  resolve<T>(token: string): T {
    return this.factory.create<T>(token);
  }

  /**
   * Check if a service is registered
   */
  isRegistered(token: string): boolean {
    return this.services.has(token);
  }

  /**
   * Get service descriptor
   */
  getDescriptor(token: string): ServiceDescriptor | undefined {
    return this.services.get(token);
  }

  /**
   * Get or create singleton instance
   */
  getSingletonInstance<T>(token: string): T | undefined {
    return this.instances.get(token);
  }

  /**
   * Set singleton instance
   */
  setSingletonInstance<T>(token: string, instance: T): void {
    this.instances.set(token, instance);
  }

  /**
   * Validate all service dependencies
   */
  validateDependencies(): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    for (const token of Array.from(this.services.keys())) {
      this.validateServiceDependencies(token, visited, visiting);
    }
  }

  /**
   * Get all registered service tokens
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Clear all services and instances
   */
  clear(): void {
    this.services.clear();
    this.instances.clear();
  }

  /**
   * Create a child container (scoped container)
   */
  createScope(): Container {
    const scopedContainer = new DIContainer();

    // Copy service registrations
    for (const [token, descriptor] of Array.from(this.services.entries())) {
      scopedContainer.services.set(token, descriptor);
    }

    // Copy singleton instances
    for (const [token, instance] of Array.from(this.instances.entries())) {
      const descriptor = this.services.get(token);
      if (descriptor?.lifetime === ServiceLifetime.Singleton) {
        scopedContainer.instances.set(token, instance);
      }
    }

    return scopedContainer;
  }

  private validateServiceDependencies(
    token: string,
    visited: Set<string>,
    visiting: Set<string>
  ): void {
    if (visited.has(token)) {
      return;
    }

    if (visiting.has(token)) {
      throw new Error(`Circular dependency detected: ${token}`);
    }

    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new Error(`Service not registered: ${token}`);
    }

    visiting.add(token);

    for (const dependency of descriptor.dependencies) {
      if (!this.services.has(dependency)) {
        throw new Error(
          `Dependency '${dependency}' for service '${token}' is not registered`
        );
      }
      this.validateServiceDependencies(dependency, visited, visiting);
    }

    visiting.delete(token);
    visited.add(token);
  }
}

