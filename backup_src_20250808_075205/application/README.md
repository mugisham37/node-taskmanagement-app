# Application Layer - Phase 5: CQRS and Use Case Orchestration

This document describes the comprehensive implementation of Phase 5, which includes CQRS (Command Query Responsibility Segregation), Use Case Orchestration, and Event Handler Implementation.

## Overview

Phase 5 transforms the application layer into a fully orchestrated system that separates command and query responsibilities, provides high-level use case orchestration, and implements comprehensive event handling for both domain and integration events.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   CQRS System   │  │  Use Cases      │  │ Event Handlers  │  │
│  │                 │  │                 │  │                 │  │
│  │ • Command Bus   │  │ • Task Mgmt     │  │ • Domain Events │  │
│  │ • Query Bus     │  │ • Orchestration │  │ • Integration   │  │
│  │ • Handlers      │  │ • Workflows     │  │ • Cross-cutting │  │
│  │ • Validation    │  │ • Coordination  │  │ • Side Effects  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. CQRS Infrastructure

#### Command System (`src/application/cqrs/command.ts`)

- **ICommand**: Base interface for all commands
- **Command**: Abstract base class with correlation tracking
- **ICommandHandler**: Interface for command handlers
- **CommandHandler**: Abstract base class for handlers
- **ICommandBus**: Interface for command routing

#### Query System (`src/application/cqrs/query.ts`)

- **IQuery**: Base interface for all queries
- **Query**: Abstract base class with correlation tracking
- **IQueryHandler**: Interface for query handlers
- **QueryHandler**: Abstract base class for handlers
- **IQueryBus**: Interface for query routing
- **PaginatedResult**: Standard pagination response

#### Command Bus (`src/application/cqrs/command-bus.ts`)

- Routes commands to appropriate handlers
- Provides logging and error handling
- Supports handler registration and discovery
- Includes performance monitoring

#### Query Bus (`src/application/cqrs/query-bus.ts`)

- Routes queries to appropriate handlers
- Optimized for read operations
- Supports caching integration
- Provides performance metrics

### 2. Task Management Commands

#### Available Commands (`src/application/cqrs/commands/task-commands.ts`)

- **CreateTaskCommand**: Create new tasks
- **UpdateTaskCommand**: Update existing tasks
- **DeleteTaskCommand**: Delete tasks
- **AssignTaskCommand**: Assign tasks to users
- **CompleteTaskCommand**: Mark tasks as complete
- **BulkUpdateTasksCommand**: Bulk operations
- **MoveTaskToProjectCommand**: Move tasks between projects
- **AddTaskTagsCommand**: Add tags to tasks
- **RemoveTaskTagsCommand**: Remove tags from tasks

#### Command Handlers (`src/application/cqrs/handlers/task-command-handlers.ts`)

- **CreateTaskCommandHandler**: Handles task creation with validation
- **UpdateTaskCommandHandler**: Handles task updates with business rules
- **DeleteTaskCommandHandler**: Handles task deletion with permissions
- **AssignTaskCommandHandler**: Handles task assignment
- **CompleteTaskCommandHandler**: Handles task completion
- **BulkUpdateTasksCommandHandler**: Handles bulk operations

### 3. Task Management Queries

#### Available Queries (`src/application/cqrs/queries/task-queries.ts`)

- **GetTaskByIdQuery**: Get single task with details
- **GetTasksQuery**: Get tasks with filtering and pagination
- **GetTasksByProjectQuery**: Get tasks for specific project
- **GetTasksByAssigneeQuery**: Get tasks for specific user
- **GetTaskStatsQuery**: Get task statistics
- **SearchTasksQuery**: Full-text search tasks
- **GetOverdueTasksQuery**: Get overdue tasks
- **GetTasksWithUpcomingDueDatesQuery**: Get tasks due soon
- **GetTaskHistoryQuery**: Get task change history
- **GetTaskDependenciesQuery**: Get task dependencies

#### Query Handlers (`src/application/cqrs/handlers/task-query-handlers.ts`)

- Optimized read operations
- Permission checking
- Data transformation
- Caching integration

### 4. Use Case Orchestration

#### Task Management Use Case (`src/application/use-cases/task-use-cases.ts`)

The `TaskManagementUseCase` class provides high-level orchestration for complex business workflows:

##### Key Methods:

- **createTask()**: Complete task creation workflow with notifications
- **updateTask()**: Task update with change tracking
- **manageTaskWorkflow()**: Workflow state transitions
- **performBulkOperation()**: Coordinated bulk operations
- **setupTaskCollaboration()**: Collaboration setup
- **getTaskInsights()**: Analytics and recommendations

##### Features:

- Business rule validation
- Cross-aggregate coordination
- Notification orchestration
- Analytics integration
- Error handling and rollback
- Permission management

### 5. Event Handler Implementation

#### Domain Event Handlers (`src/application/events/handlers/task-event-handlers.ts`)

- **TaskCreatedEventHandler**: Handles task creation events
- **TaskAssignedEventHandler**: Handles task assignment events
- **TaskCompletedEventHandler**: Handles task completion events
- **TaskStatusChangedEventHandler**: Handles status changes
- **TaskDeletedEventHandler**: Handles task deletion events
- **TaskMovedToProjectEventHandler**: Handles project moves

#### Integration Event Handlers (`src/application/events/handlers/integration-event-handlers.ts`)

- **TaskCreatedIntegrationEventHandler**: External system integration
- **TaskCompletedIntegrationEventHandler**: Completion notifications
- **TaskAssignedIntegrationEventHandler**: Assignment notifications
- **ProjectUpdatedIntegrationEventHandler**: Project sync
- **UserRegisteredIntegrationEventHandler**: User onboarding

#### Event Handler Registry (`src/application/events/event-handler-registry.ts`)

- Automatic handler registration
- Event bus subscription management
- Handler validation and health checks
- Statistics and monitoring

### 6. Validation Infrastructure

#### Command Validation (`src/application/cqrs/validation/command-validator.ts`)

- **ICommandValidator**: Validation interface
- **CommandValidator**: Validation orchestrator
- **ValidationRule**: Base validation rule
- **BaseValidationRule**: Common validation helpers

#### Query Validation (`src/application/cqrs/validation/query-validator.ts`)

- **IQueryValidator**: Query validation interface
- **QueryValidator**: Query validation orchestrator
- Pagination validation
- Search term validation
- Date range validation

### 7. CQRS Factory

#### Factory (`src/application/cqrs/cqrs-factory.ts`)

- **CQRSFactory**: Creates and configures CQRS infrastructure
- Handler registration
- Validation setup
- Container integration
- Configuration management

## Usage Examples

### Creating a Task

```typescript
const useCase = container.resolve<TaskManagementUseCase>(
  'TaskManagementUseCase'
);

const task = await useCase.createTask(
  {
    title: 'Implement new feature',
    description: 'Add user authentication',
    priority: TaskPriority.HIGH,
    projectId: 'project-123',
    assigneeId: 'user-456',
    dueDate: new Date('2024-12-31'),
    notifyAssignee: true,
  },
  'creator-user-id'
);
```

### Querying Tasks

```typescript
const queryBus = container.resolve<IQueryBus>('IQueryBus');

const tasks = await queryBus.send(
  new GetTasksQuery(
    {
      status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
      projectId: 'project-123',
    },
    {
      page: 1,
      limit: 20,
      sortBy: 'dueDate',
      sortOrder: 'asc',
    },
    'user-id'
  )
);
```

### Managing Task Workflow

```typescript
const updatedTask = await useCase.manageTaskWorkflow(
  {
    taskId: 'task-123',
    action: 'complete',
    actualHours: 8,
    completionNotes: 'Feature implemented successfully',
    notifyStakeholders: true,
  },
  'user-id'
);
```

### Bulk Operations

```typescript
const result = await useCase.performBulkOperation(
  {
    taskIds: ['task-1', 'task-2', 'task-3'],
    operation: 'update_status',
    data: { status: TaskStatus.IN_PROGRESS },
    notifyAffected: true,
  },
  'user-id'
);
```

## Configuration

### IoC Container Registration

The CQRS infrastructure is automatically registered through the service registry:

```typescript
// All CQRS components are registered in ServiceRegistry
registerApplicationServices(container);

// Event handlers are registered through EventHandlerRegistry
const registry = container.resolve<EventHandlerRegistry>(
  'EventHandlerRegistry'
);
await registry.registerAllHandlers();
```

### Event Handler Setup

```typescript
const registry = createEventHandlerRegistry(container, {
  enableDomainEventHandlers: true,
  enableIntegrationEventHandlers: true,
  enableMetrics: true,
});

await registry.registerAllHandlers();
```

## Error Handling

### Command Validation

```typescript
try {
  const result = await commandBus.send(command);
} catch (error) {
  if (error instanceof CommandValidationError) {
    // Handle validation errors
    console.log('Validation errors:', error.errors);
  } else if (error instanceof NotFoundError) {
    // Handle not found errors
    console.log('Resource not found:', error.message);
  }
}
```

### Event Handler Errors

Event handlers include comprehensive error handling:

- Errors are logged but don't fail the main operation
- Integration events are resilient to external system failures
- Retry mechanisms for transient failures
- Dead letter queues for failed events

## Monitoring and Observability

### Metrics

- Command execution times
- Query performance
- Event processing statistics
- Handler success/failure rates
- Validation error rates

### Logging

- Structured logging with correlation IDs
- Command/query tracing
- Event processing logs
- Error tracking with context

### Health Checks

- CQRS bus health
- Handler registration validation
- Event bus connectivity
- External system integration status

## Testing

### Unit Testing

```typescript
describe('CreateTaskCommandHandler', () => {
  it('should create task with valid data', async () => {
    const command = new CreateTaskCommand(
      'Test Task',
      'Description',
      TaskPriority.MEDIUM,
      undefined,
      undefined,
      undefined,
      undefined,
      [],
      'user-123'
    );

    const result = await handler.handle(command);

    expect(result).toBeDefined();
    expect(result.title).toBe('Test Task');
  });
});
```

### Integration Testing

```typescript
describe('Task Use Case Integration', () => {
  it('should orchestrate complete task creation workflow', async () => {
    const request = {
      title: 'Integration Test Task',
      assigneeId: 'user-456',
      notifyAssignee: true,
    };

    const task = await useCase.createTask(request, 'creator-123');

    // Verify task creation
    expect(task).toBeDefined();

    // Verify notifications were sent
    expect(notificationService.createNotification).toHaveBeenCalled();

    // Verify analytics tracking
    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      'task_created',
      expect.any(Object)
    );
  });
});
```

## Performance Considerations

### Command Optimization

- Validation caching
- Bulk operation batching
- Transaction optimization
- Event batching

### Query Optimization

- Read model optimization
- Caching strategies
- Pagination efficiency
- Index utilization

### Event Processing

- Asynchronous processing
- Event batching
- Parallel handler execution
- Circuit breakers for external calls

## Best Practices

1. **Command Design**
   - Keep commands focused on single operations
   - Include all necessary data in the command
   - Use correlation IDs for tracing

2. **Query Design**
   - Optimize for specific read scenarios
   - Use appropriate pagination
   - Implement caching where beneficial

3. **Event Handling**
   - Keep handlers idempotent
   - Handle failures gracefully
   - Use correlation IDs for tracing

4. **Use Case Orchestration**
   - Coordinate multiple operations
   - Handle cross-aggregate scenarios
   - Provide comprehensive error handling

5. **Validation**
   - Validate at command/query boundaries
   - Use business rule validation
   - Provide clear error messages

## Future Enhancements

1. **Advanced CQRS Features**
   - Event sourcing integration
   - Saga pattern implementation
   - Advanced caching strategies

2. **Enhanced Orchestration**
   - Workflow engine integration
   - Advanced compensation patterns
   - Multi-tenant support

3. **Monitoring Improvements**
   - Advanced metrics collection
   - Distributed tracing
   - Performance analytics

This Phase 5 implementation provides a robust, scalable foundation for complex business operations while maintaining clean separation of concerns and comprehensive error handling.
