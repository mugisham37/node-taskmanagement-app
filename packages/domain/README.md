# @monorepo/domain

The domain package contains the core business logic, entities, and domain services for the application. This package implements Domain-Driven Design (DDD) principles and provides a clean separation between business logic and infrastructure concerns.

## Structure

```
src/
├── entities/           # Domain entities with business logic
├── value-objects/      # Immutable value objects
├── aggregates/         # Aggregate roots and business invariants
├── services/           # Domain services for complex business logic
├── events/             # Domain events and event handlers
├── specifications/     # Business rules and validation logic
├── repositories/       # Repository interfaces (contracts)
├── enums/             # Domain-specific enumerations
├── base/              # Base classes and interfaces
└── index.ts           # Main exports
```

## Key Components

### Entities
- **User**: User management and authentication
- **Task**: Task management with status transitions
- **Project**: Project management with member roles
- **Workspace**: Workspace management and organization
- **Notification**: Notification system
- **Calendar Events**: Calendar and scheduling
- **Webhooks**: Webhook management and delivery

### Value Objects
- **IDs**: Strongly-typed identifiers (UserId, TaskId, ProjectId, etc.)
- **Email**: Email validation and formatting
- **Status Objects**: Status with transition validation
- **Priority**: Task priority with comparison logic

### Aggregates
- **TaskAggregate**: Task with dependencies and relationships
- **ProjectAggregate**: Project with members and tasks
- **WorkspaceAggregate**: Workspace with projects and members

### Domain Services
- **TaskDomainService**: Complex task business logic
- **ProjectDomainService**: Project management logic
- **WorkspaceDomainService**: Workspace management logic

## Usage

```typescript
import { 
  User, 
  Task, 
  Project,
  UserId,
  TaskId,
  ProjectId,
  TaskDomainService 
} from '@monorepo/domain';

// Create domain entities
const userId = new UserId('user-123');
const user = new User(userId, 'john@example.com', 'John Doe');

// Use domain services
const taskService = new TaskDomainService();
const canAssignTask = taskService.canAssignTask(task, user);
```

## Dependencies

- `@monorepo/core`: Core utilities, types, and base classes

## Development

```bash
# Build the package
npm run build

# Run tests
npm run test

# Watch mode for development
npm run build:watch
npm run test:watch

# Lint code
npm run lint
npm run lint:fix
```

## Design Principles

1. **Domain-Driven Design**: Clear separation of business logic from infrastructure
2. **Aggregate Boundaries**: Proper encapsulation of business invariants
3. **Value Objects**: Immutable objects for domain concepts
4. **Domain Events**: Decoupled communication between aggregates
5. **Specifications**: Reusable business rules and validation logic

## Testing

The domain package includes comprehensive unit tests for all entities, value objects, and domain services. Tests focus on business logic validation and domain rules enforcement.