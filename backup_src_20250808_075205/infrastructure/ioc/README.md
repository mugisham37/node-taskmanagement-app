# Dependency Injection Container (IoC)

This directory contains the comprehensive Inversion of Control (IoC) container implementation for the Unified Enterprise Platform. The IoC container provides dependency injection, service lifecycle management, and service composition capabilities.

## Overview

The IoC container system consists of several key components:

- **Container**: Core dependency injection container with lifecycle management
- **Decorators**: Metadata decorators for service registration and injection
- **Service Registry**: Centralized service registration for all application layers
- **Bootstrap**: Application startup and shutdown orchestration
- **Service Locator**: Global access point for the container
- **Service Factory**: Factory patterns for complex service composition

## Key Features

### 1. Service Lifetimes

- **Singleton**: Single instance shared across the entire application
- **Scoped**: Single instance per scope (typically per request)
- **Transient**: New instance every time the service is resolved

### 2. Automatic Dependency Injection

Services can declare their dependencies using decorators, and the container will automatically resolve and inject them.

### 3. Service Composition

Complex services can be created using factory patterns, conditional logic, and service decoration.

### 4. Lifecycle Management

Services can implement initialization and disposal logic that is automatically called during application startup and shutdown.

### 5. Request Scoping

Each HTTP request gets its own scope, ensuring proper isolation of scoped services.

## Usage Examples

### Basic Service Registration

```typescript
import { Injectable, Inject } from '@/infrastructure/ioc';

@Injectable('UserService')
class UserService {
  constructor(
    @Inject('IUserRepository') private userRepository: IUserRepository,
    @Inject('ILogger') private logger: ILogger
  ) {}

  async createUser(userData: any): Promise<User> {
    this.logger.info('Creating user', { userData });
    return await this.userRepository.create(userData);
  }
}
```

### Manual Service Registration

```typescript
import { container, ServiceLifetime } from '@/infrastructure/ioc';

// Register as singleton
container.registerSingleton('ILogger', WinstonLogger);

// Register as scoped
container.registerScoped('IUserService', UserService);

// Register as transient
container.registerTransient('IEmailService', EmailService);

// Register with factory
container.registerFactory(
  'IStorageService',
  container => {
    const config = container.resolve('IConfiguration');
    return new StorageService(config.storage);
  },
  ServiceLifetime.SINGLETON
);
```

### Service Resolution

```typescript
import { resolve, ServiceLocator } from '@/infrastructure/ioc';

// Using convenience function
const userService = resolve<IUserService>('IUserService');

// Using service locator
const logger = ServiceLocator.resolve<ILogger>('ILogger');

// Using scoped container
const scope = ServiceLocator.createScope();
const scopedService = scope.resolve<IScopedService>('IScopedService');
await scope.dispose(); // Clean up when done
```

### Controller Integration

```typescript
import { Controller, Inject } from '@/infrastructure/ioc';
import { resolveFromRequest } from '@/presentation/middleware/ioc-scope.middleware';

@Controller('UserController')
class UserController {
  constructor(@Inject('IUserService') private userService: IUserService) {}

  async createUser(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Services are automatically injected via constructor
    const user = await this.userService.createUser(request.body);
    reply.status(201).send(user);
  }

  // Alternative: resolve from request scope
  async updateUser(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const userService = resolveFromRequest<IUserService>(
      request,
      'IUserService'
    );
    const user = await userService.updateUser(request.params.id, request.body);
    reply.send(user);
  }
}
```

## Architecture

### Service Registration Flow

1. **Bootstrap Initialization**: The bootstrap process starts the IoC container
2. **Service Registration**: Services are registered in dependency order:
   - Domain Services
   - Infrastructure Services
   - Application Services
   - Presentation Services
3. **Service Validation**: Critical services are validated to ensure they can be resolved
4. **Service Initialization**: Services with initialization logic are started
5. **Application Ready**: The application is ready to handle requests

### Request Lifecycle

1. **Request Arrives**: HTTP request is received by Fastify
2. **Scope Creation**: IoC scope middleware creates a new container scope
3. **Service Resolution**: Controllers and services are resolved from the scoped container
4. **Request Processing**: Business logic executes with injected dependencies
5. **Response Sent**: HTTP response is sent to client
6. **Scope Disposal**: Scoped container is disposed, cleaning up scoped services

### Shutdown Process

1. **Shutdown Signal**: Application receives SIGTERM or SIGINT
2. **Service Shutdown**: Services are shut down in reverse dependency order
3. **Container Disposal**: All containers and their services are disposed
4. **Resource Cleanup**: Database connections, caches, etc. are closed
5. **Process Exit**: Application exits gracefully

## Configuration

### Service Registration

Services are automatically registered during bootstrap through the `ServiceRegistry`. The registry handles:

- Domain services (business logic)
- Application services (use cases and orchestration)
- Infrastructure services (repositories, external APIs, caching)
- Presentation services (controllers, middleware)

### Factory Patterns

Complex services can use factory patterns for conditional creation:

```typescript
// Storage service based on configuration
FactoryRegistration.registerConfigurable(
  container,
  'IStorageService',
  'storage.provider',
  new Map([
    ['local', new LocalStorageFactory()],
    ['s3', new S3StorageFactory()],
    ['azure', new AzureStorageFactory()],
  ]),
  new LocalStorageFactory() // default
);
```

## Testing

The IoC container is designed to be testable:

```typescript
import { Container } from '@/infrastructure/ioc';

describe('UserService', () => {
  let container: Container;
  let userService: UserService;

  beforeEach(() => {
    container = new Container();

    // Register mocks
    container.registerSingleton('IUserRepository', MockUserRepository);
    container.registerSingleton('ILogger', MockLogger);

    // Register service under test
    container.registerScoped('IUserService', UserService);

    userService = container.resolve('IUserService');
  });

  afterEach(async () => {
    await container.dispose();
  });

  it('should create user', async () => {
    const userData = { name: 'Test User' };
    const user = await userService.createUser(userData);

    expect(user.name).toBe('Test User');
  });
});
```

## Best Practices

### 1. Use Interfaces

Always register and resolve services using interfaces rather than concrete classes:

```typescript
// Good
container.registerSingleton('IUserService', UserService);
const userService = resolve<IUserService>('IUserService');

// Avoid
container.registerSingleton('UserService', UserService);
const userService = resolve<UserService>('UserService');
```

### 2. Prefer Constructor Injection

Use constructor injection over property injection for better testability:

```typescript
// Good
class UserService {
  constructor(
    @Inject('IUserRepository') private userRepository: IUserRepository
  ) {}
}

// Avoid property injection
class UserService {
  @Inject('IUserRepository')
  private userRepository: IUserRepository;
}
```

### 3. Use Appropriate Lifetimes

Choose the right service lifetime for your use case:

- **Singleton**: Stateless services, configuration, logging
- **Scoped**: Services that maintain request-specific state
- **Transient**: Lightweight services, value objects

### 4. Handle Disposal

Implement disposal logic for services that manage resources:

```typescript
class DatabaseService {
  async dispose(): Promise<void> {
    await this.connection.close();
  }
}
```

### 5. Avoid Service Locator Anti-pattern

Prefer dependency injection over service locator pattern where possible:

```typescript
// Good - dependency injection
class UserService {
  constructor(@Inject('ILogger') private logger: ILogger) {}
}

// Avoid - service locator
class UserService {
  doSomething(): void {
    const logger = resolve<ILogger>('ILogger'); // Anti-pattern
  }
}
```

## Troubleshooting

### Common Issues

1. **Service Not Registered**: Ensure the service is registered in the `ServiceRegistry`
2. **Circular Dependencies**: Refactor to break circular dependencies or use factory patterns
3. **Scope Issues**: Ensure scoped services are resolved within the correct scope
4. **Disposal Errors**: Check that all disposable services implement proper cleanup logic

### Debugging

Enable debug logging to see service registration and resolution:

```typescript
import { logger } from '@/infrastructure/logging/logger';

// The container automatically logs service registration and resolution
// Check the logs for detailed information about the IoC container operations
```

## Performance Considerations

- Service resolution is optimized for performance with caching
- Singleton services are created once and reused
- Scoped services are cached within their scope
- Transient services are created fresh each time (use sparingly for heavy objects)

## Security Considerations

- Services are isolated within their scopes
- No global state is shared between requests
- Proper disposal prevents memory leaks
- Service registration is controlled and validated during bootstrap
