import { IContainer } from './container';
import { bootstrap } from './bootstrap';

/**
 * Service Locator pattern implementation for accessing the IoC container
 * This provides a global access point to the dependency injection container
 */
export class ServiceLocator {
  private static container: IContainer | null = null;

  /**
   * Sets the container instance (called during bootstrap)
   */
  static setContainer(container: IContainer): void {
    ServiceLocator.container = container;
  }

  /**
   * Gets the current container instance
   */
  static getContainer(): IContainer {
    if (!ServiceLocator.container) {
      throw new Error(
        'Container not initialized. Call bootstrap.initialize() first.'
      );
    }
    return ServiceLocator.container;
  }

  /**
   * Resolves a service from the container
   */
  static resolve<T>(token: string): T {
    return ServiceLocator.getContainer().resolve<T>(token);
  }

  /**
   * Creates a new scope from the container
   */
  static createScope(): IContainer {
    return ServiceLocator.getContainer().createScope();
  }

  /**
   * Checks if a service is registered
   */
  static isRegistered(token: string): boolean {
    try {
      return ServiceLocator.getContainer().isRegistered(token);
    } catch {
      return false;
    }
  }

  /**
   * Clears the container reference (used during shutdown)
   */
  static clear(): void {
    ServiceLocator.container = null;
  }
}

/**
 * Convenience function to resolve services
 */
export function resolve<T>(token: string): T {
  return ServiceLocator.resolve<T>(token);
}

/**
 * Convenience function to create a new scope
 */
export function createScope(): IContainer {
  return ServiceLocator.createScope();
}

/**
 * Convenience function to check if a service is registered
 */
export function isRegistered(token: string): boolean {
  return ServiceLocator.isRegistered(token);
}
