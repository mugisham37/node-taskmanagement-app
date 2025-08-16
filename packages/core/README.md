# @taskmanagement/core

Core foundational classes, utilities, and patterns for the task management system.

## Overview

The `@taskmanagement/core` package provides the fundamental building blocks used across all other packages in the task management monorepo. It implements Domain-Driven Design (DDD) patterns, CQRS foundations, and common utilities that ensure consistency and maintainability across the entire system.

## Features

### Base Classes
- **Entity**: Base class for domain entities with identity
- **ValueObject**: Immutable value objects with equality semantics
- **AggregateRoot**: Domain aggregate root with event handling
- **DomainEvent**: Base class for domain events
- **Repository**: Repository interface pattern
- **Service**: Base service class
- **Specification**: Specification pattern implementation
- **UseCase**: Use case base class for CQRS

### Error Handling
- **DomainError**: Base domain error class
- **ValidationError**: Input validation errors
- **NotFoundError**: Resource not found errors
- **AuthorizationError**: Authorization failures
- **BusinessRuleViolationError**: Business rule violations
- **InfrastructureError**: Infrastructure-related errors

### Utilities
- **IdGenerator**: UUID and short ID generation
- **DateUtils**: Date manipulation utilities
- **ValidationUtils**: Common validation helpers
- **AsyncUtils**: Async operation utilities
- **PerformanceMonitor**: Performance monitoring utilities
- **Cache**: Caching utilities
- **ResponseUtils**: API response formatting

### Constants & Enums
- Application-wide constants
- Common enums and status values
- Business rule definitions
- Validation rules and constraints

### Guards & Validators
- Input validation guards
- Type guards and assertions
- Common validation decorators

### Event System
- Event bus implementation
- Event store interface
- Event handling patterns

## Installation

```bash
npm install @taskmanagement/core
```

## Usage

### Basic Entity

```typescript
import { Entity } from '@taskmanagement/core';

class User extends Entity<string> {
  constructor(
    id: string,
    private _email: string,
    private _name: string
  ) {
    super(id);
  }

  get email(): string {
    return this._email;
  }

  get name(): string {
    return this._name;
  }

  updateName(newName: string): void {
    if (!newName.trim()) {
      throw new ValidationError('Name cannot be empty');
    }
    this._name = newName;
  }
}
```

### Value Object

```typescript
import { ValueObject, ValidationError } from '@taskmanagement/core';

interface EmailProps {
  value: string;
}

class Email extends ValueObject<EmailProps> {
  constructor(email: string) {
    if (!Email.isValid(email)) {
      throw new ValidationError('Invalid email format');
    }
    super({ value: email });
  }

  get value(): string {
    return this.props.value;
  }

  static isValid(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
```

### Aggregate Root with Events

```typescript
import { AggregateRoot, DomainEvent } from '@taskmanagement/core';

class UserCreatedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string
  ) {
    super();
  }
}

class UserAggregate extends AggregateRoot<string> {
  constructor(
    id: string,
    private _email: string,
    private _isActive: boolean = true
  ) {
    super(id);
  }

  static create(email: string): UserAggregate {
    const id = IdGenerator.generate();
    const user = new UserAggregate(id, email);
    
    user.addDomainEvent(new UserCreatedEvent(id, email));
    return user;
  }

  deactivate(): void {
    this._isActive = false;
    this.addDomainEvent(new UserDeactivatedEvent(this.id));
  }
}
```

### Error Handling

```typescript
import { 
  ValidationError, 
  NotFoundError, 
  DomainError 
} from '@taskmanagement/core';

class UserService {
  async createUser(email: string): Promise<User> {
    if (!Email.isValid(email)) {
      throw new ValidationError('Invalid email format', { email });
    }

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ValidationError('User already exists', { email });
    }

    // Create user logic...
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found', { id });
    }
    return user;
  }
}
```

### Utilities

```typescript
import { 
  IdGenerator, 
  DateUtils, 
  ValidationUtils 
} from '@taskmanagement/core';

// Generate IDs
const userId = IdGenerator.generate(); // UUID
const shortId = IdGenerator.generateShort(); // Short ID

// Date utilities
const now = DateUtils.now();
const tomorrow = DateUtils.addDays(now, 1);
const isExpired = DateUtils.isBefore(deadline, now);

// Validation utilities
const isValidEmail = ValidationUtils.isEmail('user@example.com');
const isValidUUID = ValidationUtils.isUUID(userId);
```

## API Reference

### Base Classes

#### Entity<T>
Base class for domain entities with identity.

**Methods:**
- `constructor(id: T)`: Creates entity with ID
- `equals(entity: Entity<T>): boolean`: Compares entities by ID
- `isNew(): boolean`: Checks if entity is new (no ID)

#### ValueObject<T>
Base class for immutable value objects.

**Methods:**
- `constructor(props: T)`: Creates value object with props
- `equals(vo: ValueObject<T>): boolean`: Compares value objects by props
- `clone(): ValueObject<T>`: Creates a copy of the value object

#### AggregateRoot<T>
Base class for domain aggregates with event handling.

**Methods:**
- `addDomainEvent(event: DomainEvent): void`: Adds domain event
- `clearDomainEvents(): void`: Clears all domain events
- `getDomainEvents(): DomainEvent[]`: Gets all domain events

### Error Classes

All error classes extend `DomainError` and include:
- `code: string`: Error code for identification
- `statusCode: number`: HTTP status code
- `context?: Record<string, any>`: Additional error context

### Utilities

#### IdGenerator
- `generate(): string`: Generates UUID v4
- `generateShort(): string`: Generates short ID
- `isValid(id: string): boolean`: Validates UUID format

#### DateUtils
- `now(): Date`: Current date/time
- `addDays(date: Date, days: number): Date`: Add days to date
- `isBefore(date1: Date, date2: Date): boolean`: Compare dates
- `format(date: Date, format: string): string`: Format date

#### ValidationUtils
- `isEmail(email: string): boolean`: Validate email format
- `isUUID(id: string): boolean`: Validate UUID format
- `isNotEmpty(value: string): boolean`: Check non-empty string
- `isPositiveNumber(value: number): boolean`: Check positive number

## Testing

The package includes comprehensive unit tests for all components:

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Building

```bash
# Build the package
npm run build

# Build in watch mode
npm run build:watch

# Clean build artifacts
npm run clean
```

## Contributing

1. Follow the established patterns and conventions
2. Add comprehensive unit tests for new functionality
3. Update documentation for API changes
4. Ensure all exports are properly defined in index files

## Dependencies

- `uuid`: UUID generation
- `class-validator`: Validation decorators
- `class-transformer`: Object transformation

## License

MIT