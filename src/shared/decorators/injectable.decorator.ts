/**
 * Injectable Decorator
 * 
 * A simple dependency injection decorator for TypeScript classes.
 * This decorator marks classes as injectable and can be extended with
 * more sophisticated DI features as needed.
 */

import 'reflect-metadata';

// Symbol for storing injectable metadata
export const INJECTABLE_METADATA_KEY = Symbol('injectable');

// Interface for injectable metadata
export interface InjectableMetadata {
  token?: string | symbol;
  singleton?: boolean;
  dependencies?: Array<string | symbol | Function>;
}

/**
 * Injectable decorator
 * Marks a class as injectable for dependency injection
 */
export function injectable(metadata?: InjectableMetadata) {
  return function <T extends new (...args: any[]) => any>(target: T): T {
    // Store metadata on the target constructor
    Reflect.defineMetadata(INJECTABLE_METADATA_KEY, {
      token: metadata?.token || target.name,
      singleton: metadata?.singleton ?? true,
      dependencies: metadata?.dependencies || [],
      target
    }, target);

    return target;
  };
}

/**
 * Get injectable metadata from a class
 */
export function getInjectableMetadata(target: any): InjectableMetadata | undefined {
  return Reflect.getMetadata(INJECTABLE_METADATA_KEY, target);
}

/**
 * Check if a class is marked as injectable
 */
export function isInjectable(target: any): boolean {
  return Reflect.hasMetadata(INJECTABLE_METADATA_KEY, target);
}

/**
 * Inject decorator for constructor parameters
 */
export function inject(token: string | symbol) {
  return function (target: any, _propertyKey: string | symbol | undefined, parameterIndex: number) {
    const injectTokens = Reflect.getMetadata('inject:tokens', target) || [];
    
    injectTokens[parameterIndex] = token;
    Reflect.defineMetadata('inject:tokens', injectTokens, target);
  };
}

/**
 * Get injection tokens for a constructor
 */
export function getInjectionTokens(target: any): Array<string | symbol | Function> {
  const paramTypes = Reflect.getMetadata('design:paramtypes', target) || [];
  const injectTokens = Reflect.getMetadata('inject:tokens', target) || [];
  
  return paramTypes.map((type: any, index: number) => {
    return injectTokens[index] || type;
  });
}

/**
 * Simple container for managing injectable instances
 */
export class Container {
  private instances = new Map<string | symbol, any>();
  private constructors = new Map<string | symbol, any>();

  /**
   * Register a class constructor with the container
   */
  register<T>(token: string | symbol, constructor: new (...args: any[]) => T): void {
    this.constructors.set(token, constructor);
  }

  /**
   * Register a singleton instance
   */
  registerInstance<T>(token: string | symbol, instance: T): void {
    this.instances.set(token, instance);
  }

  /**
   * Resolve an instance from the container
   */
  resolve<T>(token: string | symbol | Function): T {
    // If it's a function/constructor, use its name as token
    if (typeof token === 'function') {
      token = token.name;
    }

    // Check if we have a cached instance
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    // Check if we have a registered constructor
    const constructor = this.constructors.get(token);
    if (!constructor) {
      throw new Error(`No registration found for token: ${String(token)}`);
    }

    // Get metadata
    const metadata = getInjectableMetadata(constructor);
    if (!metadata) {
      throw new Error(`Class ${constructor.name} is not marked as injectable`);
    }

    // Resolve dependencies
    const dependencies = getInjectionTokens(constructor);
    const resolvedDependencies = dependencies.map(dep => this.resolve(dep));

    // Create instance
    const instance = new constructor(...resolvedDependencies);

    // Cache if singleton
    if (metadata.singleton) {
      this.instances.set(token, instance);
    }

    return instance;
  }

  /**
   * Clear all instances (useful for testing)
   */
  clear(): void {
    this.instances.clear();
    this.constructors.clear();
  }
}

// Global container instance
export const container = new Container();
