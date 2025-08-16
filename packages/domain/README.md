# @taskmanagement/domain

Domain layer package containing all business logic, entities, aggregates, and domain services for the task management application.

## Overview

This package implements Domain-Driven Design (DDD) patterns and contains:

- **Aggregates**: Task, Project, User, Workspace aggregates with business rules
- **Entities**: Domain entities with identity and lifecycle management
- **Value Objects**: Immutable objects representing domain concepts
- **Domain Events**: Events that capture important business occurrences
- **Domain Services**: Services that contain business logic not belonging to entities
- **Specifications**: Business rules and validation logic
- **Repository Interfaces**: Contracts for data persistence
- **Factories**: Object creation logic
- **Policies**: Business policies and rules

## Architecture

The domain layer follows Clean Architecture principles and is independent of external concerns like databases, frameworks, or UI. It depends only on the core package for base classes and utilities.

## Key Components

### Aggregates
- `TaskAggregate`: Manages task lifecycle and business rules
- `ProjectAggregate`: Handles project management and team coordination
- `WorkspaceAggregate`: Manages workspace settings and member access
- `NotificationAggregate`: Handles notification preferences and delivery

### Entities
- `Task`: Core task entity with status, priority, and assignment logic
- `Project`: Project entity with timeline and member management
- `User`: User entity with authentication and profile management
- `Workspace`: Workspace entity with settings and access control

### Value Objects
- `TaskId`, `ProjectId`, `UserId`, `WorkspaceId`: Strongly typed identifiers
- `Email`: Email validation and formatting
- `Priority`: Task priority levels
- `TaskStatus`, `ProjectStatus`: Status enumerations

### Domain Events
- `TaskCreatedEvent`, `TaskAssignedEvent`, `TaskCompletedEvent`
- `ProjectCreatedEvent`, `ProjectMemberAddedEvent`
- `UserRegisteredEvent`, `UserActivatedEvent`
- `WorkspaceCreatedEvent`, `WorkspaceMemberInvitedEvent`

## Usage

```typescript
import { Task, TaskId, TaskTitle, TaskDescription } from '@taskmanagement/domain';

// Create a new task
const task = Task.create({
  title: new TaskTitle('Complete project documentation'),
  description: new TaskDescription('Write comprehensive documentation for the project'),
  projectId: new ProjectId('project-123')
});

// Assign task to user
task.assignTo(new UserId('user-456'));

// Complete task
task.complete();
```

## Dependencies

- `@taskmanagement/core`: Base classes and utilities
- `@taskmanagement/types`: TypeScript type definitions

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Building

```bash
# Build the package
npm run build

# Build in watch mode
npm run build:watch
```