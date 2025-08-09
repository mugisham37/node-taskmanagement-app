import { Container, ServiceLifetime } from './types';
import { ServiceDescriptor } from './service-descriptor';

/**
 * Service factory for creating and managing service instances
 */
export class ServiceFactory {
  private creationStack = new Set<string>();

  constructor(private container: Container) {}

  /**
   * Create service instance
   */
  create<T>(token: string): T {
    // Check for circular dependency
    if (this.creationStack.has(token)) {
      const stack = Array.from(this.creationStack).join(' -> ');
      throw new Error(`Circular dependency detected: ${stack} -> ${token}`);
    }

    const descriptor = this.container.getDescriptor(token);
    if (!descriptor) {
      throw new Error(`Service not registered: ${token}`);
    }

    // Check for existing singleton instance
    if (descriptor.isSingleton) {
      const existingInstance = this.container.getSingletonInstance<T>(token);
      if (existingInstance) {
        return existingInstance;
      }
    }

    this.creationStack.add(token);

    try {
      const instance = this.createInstance<T>(descriptor);

      // Store singleton instance
      if (descriptor.isSingleton) {
        this.container.setSingletonInstance(token, instance);
      }

      return instance;
    } finally {
      this.creationStack.delete(token);
    }
  }

  /**
   * Create instance based on descriptor
   */
  private createInstance<T>(descriptor: ServiceDescriptor): T {
    if (descriptor.isFactory) {
      const factory = descriptor.implementation as any;
      return factory(this.container);
    }

    // Resolve dependencies
    const dependencies = descriptor.dependencies.map(dep =>
      this.container.resolve(dep)
    );

    // Create instance with dependencies
    return new descriptor.implementation(...dependencies);
  }

  /**
   * Validate service can be created
   */
  validateService(token: string): void {
    const visited = new Set<string>();
    this.validateServiceRecursive(token, visited, new Set());
  }

  private validateServiceRecursive(
    token: string,
    visited: Set<string>,
    visiting: Set<string>
  ): void {
    if (visited.has(token)) {
      return;
    }

    if (visiting.has(token)) {
      const stack = Array.from(visiting).join(' -> ');
      throw new Error(`Circular dependency detected: ${stack} -> ${token}`);
    }

    const descriptor = this.container.getDescriptor(token);
    if (!descriptor) {
      throw new Error(`Service not registered: ${token}`);
    }

    visiting.add(token);

    for (const dependency of descriptor.dependencies) {
      this.validateServiceRecursive(dependency, visited, visiting);
    }

    visiting.delete(token);
    visited.add(token);
  }
}
