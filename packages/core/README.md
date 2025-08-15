# @taskmanagement/core

Core utilities, types, constants, and base abstractions for the task management application.

## Overview

This package provides the foundational building blocks for the entire application, including:

- **Base Interfaces**: Entity, Repository, DomainEvent, and other core abstractions
- **Types**: Common type definitions and utility types
- **Constants**: Application-wide constants and enums
- **Utilities**: Pure utility functions for common operations
- **Errors**: Base error classes and error handling utilities
- **Guards**: Type guards and validation guards
- **Events**: Base event system and event handling

## Installation

```bash
npm install @taskmanagement/core
```

## Usage

### Base Interfaces

```typescript
import { Entity, Repository, DomainEvent } from '@taskmanagement/core/base';

// Use base entity interface
interface User extends Entity<string> {
  name: string;
  email: string;
}

// Use base repository interface
interface UserRepository extends Repository<User, string> {
  findByEmail(email: string): Promise<User | null>;
}
```

### Utilities

```typescript
import { dateUtils, idGenerator } from '@taskmanagement/core/utils';

// Generate unique IDs
const id = idGenerator.generate();

// Format dates
const formatted = dateUtils.formatISO(new Date());
```

### Error Handling

```typescript
import { DomainError, ValidationError } from '@taskmanagement/core/errors';

// Throw domain-specific errors
throw new DomainError('Business rule violation');

// Handle validation errors
throw new ValidationError('Invalid input', violations);
```

## Exports

- `@taskmanagement/core` - Main exports
- `@taskmanagement/core/types` - Type definitions
- `@taskmanagement/core/constants` - Constants and enums
- `@taskmanagement/core/utils` - Utility functions
- `@taskmanagement/core/errors` - Error classes
- `@taskmanagement/core/guards` - Type guards
- `@taskmanagement/core/events` - Event system
- `@taskmanagement/core/base` - Base interfaces and abstractions

## Development

```bash
# Build the package
npm run build

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Type check
npm run type-check

# Lint code
npm run lint
```