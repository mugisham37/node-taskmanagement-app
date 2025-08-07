import { IContainer, ServiceLifetime } from './container';

export interface IServiceFactory<T> {
  create(container: IContainer): T;
}

export abstract class ServiceFactory<T> implements IServiceFactory<T> {
  abstract create(container: IContainer): T;
}

/**
 * Factory for creating complex services with multiple dependencies
 */
export class CompositeServiceFactory<T> extends ServiceFactory<T> {
  constructor(private readonly factoryFunction: (container: IContainer) => T) {
    super();
  }

  create(container: IContainer): T {
    return this.factoryFunction(container);
  }
}

/**
 * Factory for creating services with conditional logic
 */
export class ConditionalServiceFactory<T> extends ServiceFactory<T> {
  constructor(
    private readonly condition: (container: IContainer) => boolean,
    private readonly trueFactory: IServiceFactory<T>,
    private readonly falseFactory: IServiceFactory<T>
  ) {
    super();
  }

  create(container: IContainer): T {
    const factory = this.condition(container)
      ? this.trueFactory
      : this.falseFactory;
    return factory.create(container);
  }
}

/**
 * Factory for creating services with configuration-based selection
 */
export class ConfigurableServiceFactory<T> extends ServiceFactory<T> {
  constructor(
    private readonly configKey: string,
    private readonly factories: Map<string, IServiceFactory<T>>,
    private readonly defaultFactory: IServiceFactory<T>
  ) {
    super();
  }

  create(container: IContainer): T {
    try {
      const config = container.resolve('IConfiguration');
      const configValue = config[this.configKey];

      const factory = this.factories.get(configValue) || this.defaultFactory;
      return factory.create(container);
    } catch {
      return this.defaultFactory.create(container);
    }
  }
}

/**
 * Factory for creating decorated services (proxy pattern)
 */
export class DecoratedServiceFactory<T> extends ServiceFactory<T> {
  constructor(
    private readonly baseFactory: IServiceFactory<T>,
    private readonly decorators: Array<(service: T, container: IContainer) => T>
  ) {
    super();
  }

  create(container: IContainer): T {
    let service = this.baseFactory.create(container);

    for (const decorator of this.decorators) {
      service = decorator(service, container);
    }

    return service;
  }
}

/**
 * Helper functions for registering factories
 */
export class FactoryRegistration {
  static registerFactory<T>(
    container: IContainer,
    token: string,
    factory: IServiceFactory<T>,
    lifetime: ServiceLifetime = ServiceLifetime.TRANSIENT
  ): void {
    container.registerFactory(
      token,
      (cont: IContainer) => factory.create(cont),
      lifetime
    );
  }

  static registerComposite<T>(
    container: IContainer,
    token: string,
    factoryFunction: (container: IContainer) => T,
    lifetime: ServiceLifetime = ServiceLifetime.TRANSIENT
  ): void {
    const factory = new CompositeServiceFactory(factoryFunction);
    FactoryRegistration.registerFactory(container, token, factory, lifetime);
  }

  static registerConditional<T>(
    container: IContainer,
    token: string,
    condition: (container: IContainer) => boolean,
    trueFactory: IServiceFactory<T>,
    falseFactory: IServiceFactory<T>,
    lifetime: ServiceLifetime = ServiceLifetime.TRANSIENT
  ): void {
    const factory = new ConditionalServiceFactory(
      condition,
      trueFactory,
      falseFactory
    );
    FactoryRegistration.registerFactory(container, token, factory, lifetime);
  }

  static registerConfigurable<T>(
    container: IContainer,
    token: string,
    configKey: string,
    factories: Map<string, IServiceFactory<T>>,
    defaultFactory: IServiceFactory<T>,
    lifetime: ServiceLifetime = ServiceLifetime.TRANSIENT
  ): void {
    const factory = new ConfigurableServiceFactory(
      configKey,
      factories,
      defaultFactory
    );
    FactoryRegistration.registerFactory(container, token, factory, lifetime);
  }

  static registerDecorated<T>(
    container: IContainer,
    token: string,
    baseFactory: IServiceFactory<T>,
    decorators: Array<(service: T, container: IContainer) => T>,
    lifetime: ServiceLifetime = ServiceLifetime.TRANSIENT
  ): void {
    const factory = new DecoratedServiceFactory(baseFactory, decorators);
    FactoryRegistration.registerFactory(container, token, factory, lifetime);
  }
}

/**
 * Common service factories
 */
export class CommonFactories {
  /**
   * Creates a factory for storage services based on configuration
   */
  static createStorageServiceFactory(): IServiceFactory<any> {
    return new ConfigurableServiceFactory(
      'storage.provider',
      new Map([
        [
          'local',
          new CompositeServiceFactory(container =>
            container.resolve('LocalStorageService')
          ),
        ],
        [
          's3',
          new CompositeServiceFactory(container =>
            container.resolve('S3StorageService')
          ),
        ],
        [
          'azure',
          new CompositeServiceFactory(container =>
            container.resolve('AzureBlobStorageService')
          ),
        ],
      ]),
      new CompositeServiceFactory(container =>
        container.resolve('LocalStorageService')
      )
    );
  }

  /**
   * Creates a factory for email services based on configuration
   */
  static createEmailServiceFactory(): IServiceFactory<any> {
    return new ConfigurableServiceFactory(
      'email.provider',
      new Map([
        [
          'smtp',
          new CompositeServiceFactory(container =>
            container.resolve('SMTPEmailService')
          ),
        ],
        [
          'sendgrid',
          new CompositeServiceFactory(container =>
            container.resolve('SendGridEmailService')
          ),
        ],
        [
          'ses',
          new CompositeServiceFactory(container =>
            container.resolve('SESEmailService')
          ),
        ],
      ]),
      new CompositeServiceFactory(container =>
        container.resolve('SMTPEmailService')
      )
    );
  }

  /**
   * Creates a factory for cache services based on configuration
   */
  static createCacheServiceFactory(): IServiceFactory<any> {
    return new ConditionalServiceFactory(
      container => {
        try {
          const config = container.resolve('IConfiguration');
          return config.cache?.enabled === true;
        } catch {
          return false;
        }
      },
      new CompositeServiceFactory(container =>
        container.resolve('RedisCacheService')
      ),
      new CompositeServiceFactory(container =>
        container.resolve('InMemoryCacheService')
      )
    );
  }
}
