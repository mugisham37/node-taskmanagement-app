# @taskmanagement/types

Shared TypeScript types and DTOs for the task management application.

## Overview

This package contains all shared type definitions, Data Transfer Objects (DTOs), and validation schemas used across the task management monolith. It provides type safety and consistency across all applications and packages.

## Structure

```
src/
├── api/          # API-specific types
├── auth/         # Authentication and authorization types
├── common/       # Common types and utilities
├── database/     # Database-specific types
├── domain/       # Domain-specific types
├── dto/          # Data Transfer Objects and validation schemas
├── events/       # Event-specific types
└── __tests__/    # Unit tests
```

## Key Features

- **Comprehensive DTOs**: Complete set of Data Transfer Objects for all API endpoints
- **Validation Schemas**: Zod-based validation schemas for runtime type checking
- **Type Safety**: Full TypeScript support with strict type checking
- **Auto-generation**: Scripts to generate types from API endpoints and database schemas
- **Test Coverage**: Comprehensive unit tests with 80%+ coverage requirement

## Usage

### Installing

```bash
npm install @taskmanagement/types
```

### Importing Types

```typescript
// Import DTOs
import { CreateTaskRequest, TaskResponseDto } from '@taskmanagement/types/dto';

// Import common types
import { ApiResponse, PaginatedResponse } from '@taskmanagement/types/common';

// Import auth types
import { AuthenticatedUser, SecurityContext } from '@taskmanagement/types/auth';
```

### Using Validation Schemas

```typescript
import { CreateTaskSchema } from '@taskmanagement/types/dto';

// Validate data
const result = CreateTaskSchema.safeParse(requestData);
if (result.success) {
  // Data is valid and typed
  const task = result.data;
} else {
  // Handle validation errors
  console.error(result.error.issues);
}
```

## Available Types

### DTO Types

- **Task DTOs**: `CreateTaskRequest`, `UpdateTaskRequest`, `TaskResponseDto`, `TaskFilters`
- **Project DTOs**: `CreateProjectRequest`, `UpdateProjectRequest`, `ProjectResponseDto`
- **User DTOs**: `CreateUserRequest`, `UpdateUserRequest`, `UserResponseDto`, `LoginRequest`
- **Workspace DTOs**: `CreateWorkspaceRequest`, `WorkspaceResponseDto`
- **Base DTOs**: `BaseDto`, `PaginatedResponseDto`, `ErrorResponseDto`

### Common Types

- **API Types**: `ApiResponse<T>`, `PaginatedResponse<T>`, `QueryOptions`
- **Utility Types**: `Result<T, E>`, `DeepPartial<T>`, `Nullable<T>`, `Optional<T, K>`
- **Filter Types**: `UnifiedTaskFilters`, `TaskStatus`, `Priority`

### Auth Types

- **User Types**: `AuthenticatedUser`, `AuthenticatedRequest`
- **Context Types**: `SecurityContext`, `WorkspaceContext`, `AuthContext`
- **Token Types**: `TokenPayload`, `AccessContext`

## Validation Schemas

All DTOs come with corresponding Zod validation schemas:

```typescript
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskFiltersSchema,
  CreateProjectSchema,
  LoginSchema,
} from '@taskmanagement/types/dto';
```

## Type Generation

### Generate API Types

```bash
npm run generate:api
```

Analyzes tRPC routers and generates corresponding TypeScript types.

### Generate Database Types

```bash
npm run generate:db
```

Analyzes Drizzle schema files and generates database types.

### Generate All Types

```bash
npm run generate:all
```

Runs both API and database type generation.

## Development

### Building

```bash
npm run build
```

### Testing

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Linting

```bash
# Check for linting issues
npm run lint

# Fix linting issues
npm run lint:fix
```

### Type Checking

```bash
npm run type-check
```

## Best Practices

### 1. Use Validation Schemas

Always use the provided Zod schemas for runtime validation:

```typescript
import { CreateTaskSchema } from '@taskmanagement/types/dto';

export async function createTask(data: unknown) {
  const parsed = CreateTaskSchema.parse(data); // Throws on invalid data
  // or
  const result = CreateTaskSchema.safeParse(data); // Returns result object
}
```

### 2. Leverage Type Inference

Use Zod's type inference for automatic TypeScript types:

```typescript
import { CreateTaskSchema } from '@taskmanagement/types/dto';

type CreateTaskRequest = z.infer<typeof CreateTaskSchema>;
```

### 3. Use Utility Types

Leverage the provided utility types for common patterns:

```typescript
import { Result, DeepPartial, Optional } from '@taskmanagement/types/common';

// For operation results
function processTask(): Result<Task, ValidationError> {
  // ...
}

// For partial updates
function updateTask(id: string, updates: DeepPartial<Task>) {
  // ...
}
```

### 4. Consistent Error Handling

Use the standardized error types:

```typescript
import { ErrorResponseDto, ValidationErrorResponseDto } from '@taskmanagement/types/dto';

// Standard API error response
const errorResponse: ErrorResponseDto = {
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input data',
    timestamp: new Date().toISOString(),
    path: '/api/tasks',
  },
};
```

## Contributing

1. Add new types to the appropriate directory (`dto/`, `common/`, `auth/`, etc.)
2. Include corresponding Zod schemas for validation
3. Write comprehensive unit tests
4. Update this README if adding new major features
5. Ensure all tests pass and coverage remains above 80%

## Dependencies

- **zod**: Runtime type validation and schema definition
- **typescript**: TypeScript compiler and type definitions

## License

MIT