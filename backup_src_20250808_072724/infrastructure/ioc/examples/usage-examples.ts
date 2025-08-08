/**
 * Usage examples for the IoC Container system
 * This file demonstrates how to use the dependency injection container
 * in various scenarios throughout the application.
 */

import {
  Injectable,
  Inject,
  Service,
  Repository,
  Controller,
} from '../decorators';
import { ServiceLocator, resolve, createScope } from '../service-locator';
import { FactoryRegistration, CommonFactories } from '../service-factory';
import { IContainer, ServiceLifetime } from '../container';

// Example 1: Basic Service with Dependencies
@Service('UserService')
class ExampleUserService {
  constructor(
    @Inject('IUserRepository') private userRepository: any,
    @Inject('ILogger') private logger: any,
    @Inject('IDomainEventBus') private eventBus: any
  ) {}

  async createUser(userData: any): Promise<any> {
    this.logger.info('Creating new user', { userData });

    // Business logic here
    const user = await this.userRepository.create(userData);

    // Publish domain event
    await this.eventBus.publish({
      type: 'UserCreated',
      data: user,
    });

    return user;
  }
}

// Example 2: Repository with Database Dependency
@Repository('UserRepository')
class ExampleUserRepository {
  constructor(
    @Inject('PrismaClient') private prisma: any,
    @Inject('ILogger') private logger: any
  ) {}

  async findById(id: string): Promise<any> {
    this.logger.debug('Finding user by ID', { id });
    return await this.prisma.user.findUnique({ where: { id } });
  }

  async create(userData: any): Promise<any> {
    this.logger.debug('Creating user', { userData });
    return await this.prisma.user.create({ data: userData });
  }
}

// Example 3: Controller with Multiple Dependencies
@Controller('UserController')
class ExampleUserController {
  constructor(
    @Inject('IUserService') private userService: any,
    @Inject('ILogger') private logger: any
  ) {}

  async createUser(request: any, reply: any): Promise<void> {
    try {
      const user = await this.userService.createUser(request.body);
      reply.status(201).send(user);
    } catch (error) {
      this.logger.error('Error creating user', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

// Example 4: Using Service Locator Pattern
class ExampleServiceConsumer {
  async doSomething(): Promise<void> {
    // Resolve services directly from the service locator
    const userService = resolve<any>('IUserService');
    const logger = resolve<any>('ILogger');

    logger.info('Doing something with user service');

    // Use the service
    const users = await userService.getAllUsers();
    logger.info(`Found ${users.length} users`);
  }
}

// Example 5: Using Scoped Container in Request Handler
class ExampleRequestHandler {
  async handleRequest(request: any, reply: any): Promise<void> {
    // Create a scoped container for this request
    const scope = createScope();

    try {
      // Resolve services from the scoped container
      const userService = scope.resolve<any>('IUserService');
      const logger = scope.resolve<any>('ILogger');

      // Process request
      const result = await userService.processRequest(request.body);
      reply.send(result);
    } finally {
      // Dispose the scope to clean up resources
      await scope.dispose();
    }
  }
}

// Example 6: Factory Pattern Usage
class ExampleFactoryUsage {
  static registerFactories(container: IContainer): void {
    // Register a composite factory for complex service creation
    FactoryRegistration.registerComposite(
      container,
      'ComplexService',
      cont => {
        const dependency1 = cont.resolve('Dependency1');
        const dependency2 = cont.resolve('Dependency2');
        const config = cont.resolve('IConfiguration');

        return new ComplexService(
          dependency1,
          dependency2,
          config.complexService
        );
      },
      ServiceLifetime.SINGLETON
    );

    // Register conditional factory based on environment
    FactoryRegistration.registerConditional(
      container,
      'IEmailService',
      cont => {
        const config = cont.resolve('IConfiguration');
        return config.app.environment === 'production';
      },
      CommonFactories.createEmailServiceFactory(),
      // Mock email service for non-production
      FactoryRegistration.registerComposite(
        container,
        'MockEmailService',
        () => new MockEmailService(),
        ServiceLifetime.SINGLETON
      )
    );
  }
}

// Example 7: Service with Lifecycle Management
@Service('LifecycleService')
class ExampleLifecycleService {
  private isInitialized = false;
  private resources: any[] = [];

  constructor(@Inject('ILogger') private logger: any) {}

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.logger.info('Initializing lifecycle service');

    // Initialize resources
    this.resources = await this.loadResources();
    this.isInitialized = true;

    this.logger.info('Lifecycle service initialized');
  }

  async dispose(): Promise<void> {
    if (!this.isInitialized) return;

    this.logger.info('Disposing lifecycle service');

    // Clean up resources
    for (const resource of this.resources) {
      if (resource.dispose) {
        await resource.dispose();
      }
    }

    this.resources = [];
    this.isInitialized = false;

    this.logger.info('Lifecycle service disposed');
  }

  private async loadResources(): Promise<any[]> {
    // Load and return resources
    return [];
  }
}

// Example 8: Testing with IoC Container
class ExampleTestSetup {
  static setupTestContainer(): IContainer {
    const container = createScope();

    // Register mock services for testing
    container.registerSingleton('ILogger', MockLogger);
    container.registerSingleton('IUserRepository', MockUserRepository);
    container.registerSingleton('IDomainEventBus', MockEventBus);

    // Register the service under test
    container.registerScoped('IUserService', ExampleUserService);

    return container;
  }

  static async runTest(): Promise<void> {
    const container = ExampleTestSetup.setupTestContainer();

    try {
      // Get service under test
      const userService = container.resolve<ExampleUserService>('IUserService');

      // Run test
      const result = await userService.createUser({ name: 'Test User' });

      // Assert results
      console.assert(result.name === 'Test User');
    } finally {
      // Clean up
      await container.dispose();
    }
  }
}

// Mock classes for examples
class ComplexService {
  constructor(
    private dependency1: any,
    private dependency2: any,
    private config: any
  ) {}
}

class MockEmailService {
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log(`Mock email sent to ${to}: ${subject}`);
  }
}

class MockLogger {
  info(message: string, context?: any): void {
    console.log(`[INFO] ${message}`, context);
  }

  error(message: string, error?: any): void {
    console.error(`[ERROR] ${message}`, error);
  }

  debug(message: string, context?: any): void {
    console.debug(`[DEBUG] ${message}`, context);
  }
}

class MockUserRepository {
  private users: any[] = [];

  async create(userData: any): Promise<any> {
    const user = { id: Date.now().toString(), ...userData };
    this.users.push(user);
    return user;
  }

  async findById(id: string): Promise<any> {
    return this.users.find(u => u.id === id);
  }
}

class MockEventBus {
  async publish(event: any): Promise<void> {
    console.log('Mock event published:', event);
  }
}

export {
  ExampleUserService,
  ExampleUserRepository,
  ExampleUserController,
  ExampleServiceConsumer,
  ExampleRequestHandler,
  ExampleFactoryUsage,
  ExampleLifecycleService,
  ExampleTestSetup,
};
