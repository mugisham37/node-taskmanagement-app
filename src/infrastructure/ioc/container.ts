import 'reflect-metadata';

export enum ServiceLifetime {
  SINGLETON = 'singleton',
  TRANSIENT = 'transient',
  SCOPED = 'scoped',
}

export interface ServiceDescriptor {
  token: string;
  implementation: any;
  lifetime: ServiceLifetime;
  factory?: (...args: any[]) => any;
  dependencies?: string[];
}

export interface IContainer {
  register<T>(
    token: string,
    implementation: new (...args: any[]) => T,
    lifetime: ServiceLifetime
  ): void;
  registerSingleton<T>(
    token: string,
    implementation: new (...args: any[]) => T
  ): void;
  registerTransient<T>(
    token: string,
    implementation: new (...args: any[]) => T
  ): void;
  registerScoped<T>(
    token: string,
    implementation: new (...args: any[]) => T
  ): void;
  registerFactory<T>(
    token: string,
    factory: (...args: any[]) => T,
    lifetime: ServiceLifetime
  ): void;
  resolve<T>(token: string): T;
  createScope(): IContainer;
  dispose(): Promise<void>;
  isRegistered(token: string): boolean;
}

export class Container implements IContainer {
  private services = new Map<string, ServiceDescriptor>();
  private singletonInstances = new Map<string, any>();
  private scopedInstances = new Map<string, any>();
  private isDisposed = false;
  private parent?: Container;

  constructor(parent?: Container) {
    this.parent = parent;
  }

  register<T>(
    token: string,
    implementation: new (...args: any[]) => T,
    lifetime: ServiceLifetime
  ): void {
    this.validateNotDisposed();

    const dependencies = this.extractDependencies(implementation);

    this.services.set(token, {
      token,
      implementation,
      lifetime,
      dependencies,
    });
  }

  registerSingleton<T>(
    token: string,
    implementation: new (...args: any[]) => T
  ): void {
    this.register(token, implementation, ServiceLifetime.SINGLETON);
  }

  registerTransient<T>(
    token: string,
    implementation: new (...args: any[]) => T
  ): void {
    this.register(token, implementation, ServiceLifetime.TRANSIENT);
  }

  registerScoped<T>(
    token: string,
    implementation: new (...args: any[]) => T
  ): void {
    this.register(token, implementation, ServiceLifetime.SCOPED);
  }

  registerFactory<T>(
    token: string,
    factory: (...args: any[]) => T,
    lifetime: ServiceLifetime
  ): void {
    this.validateNotDisposed();

    this.services.set(token, {
      token,
      implementation: null,
      lifetime,
      factory,
    });
  }

  resolve<T>(token: string): T {
    this.validateNotDisposed();

    const service = this.findService(token);
    if (!service) {
      throw new Error(`Service '${token}' is not registered`);
    }

    return this.createInstance<T>(service);
  }

  createScope(): IContainer {
    this.validateNotDisposed();
    return new Container(this);
  }

  isRegistered(token: string): boolean {
    return (
      this.services.has(token) || (this.parent?.isRegistered(token) ?? false)
    );
  }

  async dispose(): Promise<void> {
    if (this.isDisposed) return;

    // Dispose scoped instances
    for (const instance of this.scopedInstances.values()) {
      await this.disposeInstance(instance);
    }
    this.scopedInstances.clear();

    // For root container, dispose singletons
    if (!this.parent) {
      for (const instance of this.singletonInstances.values()) {
        await this.disposeInstance(instance);
      }
      this.singletonInstances.clear();
    }

    this.isDisposed = true;
  }

  private findService(token: string): ServiceDescriptor | undefined {
    return this.services.get(token) || this.parent?.findService(token);
  }

  private createInstance<T>(service: ServiceDescriptor): T {
    switch (service.lifetime) {
      case ServiceLifetime.SINGLETON:
        return this.createSingleton<T>(service);
      case ServiceLifetime.SCOPED:
        return this.createScoped<T>(service);
      case ServiceLifetime.TRANSIENT:
        return this.createTransient<T>(service);
      default:
        throw new Error(`Unknown service lifetime: ${service.lifetime}`);
    }
  }

  private createSingleton<T>(service: ServiceDescriptor): T {
    const rootContainer = this.getRootContainer();

    if (rootContainer.singletonInstances.has(service.token)) {
      return rootContainer.singletonInstances.get(service.token);
    }

    const instance = this.instantiate<T>(service);
    rootContainer.singletonInstances.set(service.token, instance);
    return instance;
  }

  private createScoped<T>(service: ServiceDescriptor): T {
    if (this.scopedInstances.has(service.token)) {
      return this.scopedInstances.get(service.token);
    }

    const instance = this.instantiate<T>(service);
    this.scopedInstances.set(service.token, instance);
    return instance;
  }

  private createTransient<T>(service: ServiceDescriptor): T {
    return this.instantiate<T>(service);
  }

  private instantiate<T>(service: ServiceDescriptor): T {
    if (service.factory) {
      const dependencies = this.resolveDependencies(service.dependencies || []);
      return service.factory(...dependencies);
    }

    if (!service.implementation) {
      throw new Error(
        `No implementation or factory provided for service '${service.token}'`
      );
    }

    const dependencies = this.resolveDependencies(service.dependencies || []);
    return new service.implementation(...dependencies);
  }

  private resolveDependencies(dependencies: string[]): any[] {
    return dependencies.map(dep => this.resolve(dep));
  }

  private extractDependencies(implementation: any): string[] {
    // Use reflect-metadata to extract constructor parameter types
    const paramTypes =
      Reflect.getMetadata('design:paramtypes', implementation) || [];
    const paramNames =
      Reflect.getMetadata('custom:paramnames', implementation) || [];

    // If we have custom parameter names (from decorators), use those
    if (paramNames.length > 0) {
      return paramNames;
    }

    // Otherwise, try to infer from parameter types
    return paramTypes.map((type: any, index: number) => {
      if (type && type.name) {
        return type.name;
      }
      return `param_${index}`;
    });
  }

  private getRootContainer(): Container {
    let current: Container = this;
    while (current.parent) {
      current = current.parent;
    }
    return current;
  }

  private async disposeInstance(instance: any): Promise<void> {
    if (instance && typeof instance.dispose === 'function') {
      await instance.dispose();
    }
  }

  private validateNotDisposed(): void {
    if (this.isDisposed) {
      throw new Error('Container has been disposed');
    }
  }
}

// Global container instance
export const container = new Container();
