# Repository Layer

This directory contains the repository layer for the task management application. The repository layer provides a high-level abstraction over database operations, implementing the Repository pattern with advanced features like caching, audit logging, pagination, and bulk operations.

## Architecture

### Base Repository

The `BaseRepository` class provides common functionality for all repositories:

- **CRUD Operations**: Create, Read, Update, Delete
- **Bulk Operations**: Batch create, update, delete
- **Pagination**: Built-in pagination support
- **Filtering**: Advanced filtering capabilities
- **Caching**: Optional caching with TTL
- **Audit Logging**: Track changes and operations
- **Error Handling**: Consistent error handling
- **Transaction Support**: Database transaction support
- **Soft Delete**: Optional soft delete functionality

### Repository Structure

```
repositories/
├── base/
│   ├── interfaces.ts      # Common interfaces and types
│   ├── types.ts          # Error types and configurations
│   └── base.repository.ts # Base repository implementation
├── user.repository.ts     # User-specific operations
├── task.repository.ts     # Task-specific operations
├── project.repository.ts  # Project-specific operations
├── workspace.repository.ts # Workspace-specific operations
├── comment.repository.ts  # Comment-specific operations
├── notification.repository.ts # Notification-specific operations
├── index.ts              # Central exports
└── README.md            # This file
```

## Features

### 1. Type Safety
All repositories are fully typed with TypeScript, providing compile-time safety and excellent IDE support.

### 2. Pagination
Built-in pagination support with metadata:
```typescript
const result = await userRepository.findMany({
  page: 1,
  limit: 10,
  sortBy: 'createdAt',
  sortOrder: 'desc'
});

// Returns:
// {
//   data: User[],
//   pagination: {
//     page: 1,
//     limit: 10,
//     total: 100,
//     totalPages: 10,
//     hasNext: true,
//     hasPrev: false
//   }
// }
```

### 3. Advanced Filtering
Support for complex filtering with Drizzle ORM operators:
```typescript
const tasks = await taskRepository.findMany({
  where: and(
    eq(tasks.status, 'todo'),
    isNotNull(tasks.dueDate)
  )
});
```

### 4. Search Functionality
Built-in search across relevant fields:
```typescript
const users = await userRepository.search({
  query: 'john',
  page: 1,
  limit: 10
});
```

### 5. Bulk Operations
Efficient bulk operations:
```typescript
// Bulk create
const newTasks = await taskRepository.createMany([...taskData]);

// Bulk update
const result = await taskRepository.updateMany(taskIds, { status: 'completed' });

// Bulk delete
const result = await taskRepository.deleteMany(taskIds);
```

### 6. Caching
Optional caching with configurable TTL:
```typescript
// Repositories can be configured with caching
const userRepo = new UserRepository({
  enabled: true,
  ttl: 300, // 5 minutes
  keyPrefix: 'user'
});
```

### 7. Audit Logging
Track all changes with audit logging:
```typescript
// Enable audit logging
const taskRepo = new TaskRepository(
  undefined, // cache config
  { enabled: true, trackChanges: true }
);
```

## Repository Classes

### UserRepository
Handles user-related operations:
- Find by email/username
- Email/username existence checks
- User search
- Role management
- Email verification
- Password reset tokens
- User statistics

### TaskRepository
Handles task-related operations:
- Find by project/assignee/creator
- Status and priority filtering
- Due date queries (overdue, today, this week)
- Tag management
- Bulk status updates
- Task statistics
- Time tracking (estimated/actual hours)

### ProjectRepository
Handles project-related operations:
- Find by owner
- Archive/unarchive projects
- Color management
- Project duplication
- Ownership transfer
- Project statistics

### WorkspaceRepository
Handles workspace-related operations:
- Find by owner
- Settings management
- Ownership transfer
- Workspace statistics

### CommentRepository
Handles comment-related operations:
- Find by task/author
- Content validation
- Bulk operations by task/author
- Comment statistics

### NotificationRepository
Handles notification-related operations:
- Find by user/type
- Read/unread management
- Bulk mark as read
- Notification cleanup
- User notification statistics

## Usage Examples

### Basic CRUD Operations
```typescript
import { userRepository } from '@/db/repositories';

// Create a user
const user = await userRepository.create({
  email: 'john@example.com',
  username: 'john',
  firstName: 'John',
  lastName: 'Doe'
});

// Find by ID
const user = await userRepository.findById('user-id');

// Update
const updatedUser = await userRepository.update('user-id', {
  firstName: 'Johnny'
});

// Delete
const deleted = await userRepository.delete('user-id');
```

### Advanced Queries
```typescript
// Find overdue tasks
const overdueTasks = await taskRepository.findOverdueTasks({
  page: 1,
  limit: 20
});

// Find high priority tasks
const highPriorityTasks = await taskRepository.findHighPriorityTasks();

// Get task statistics
const stats = await taskRepository.getTaskStats('project-id');
```

### Bulk Operations
```typescript
// Bulk assign tasks
const result = await taskRepository.bulkAssign(taskIds, 'assignee-id');

// Bulk update status
const result = await taskRepository.bulkUpdateStatus(taskIds, 'completed');
```

### Search Operations
```typescript
// Search users
const users = await userRepository.search({
  query: 'john',
  page: 1,
  limit: 10
});

// Search tasks
const tasks = await taskRepository.search({
  query: 'bug fix',
  sortBy: 'priority',
  sortOrder: 'desc'
});
```

### Transaction Support
```typescript
// Use transactions for complex operations
const result = await userRepository.withTransaction(async (tx) => {
  const user = await userRepository.create(userData);
  const workspace = await workspaceRepository.create({
    name: 'Default Workspace',
    ownerId: user.id
  });
  return { user, workspace };
});
```

## Error Handling

All repositories use consistent error handling with typed exceptions:

```typescript
import { RepositoryException } from '@/db/repositories';

try {
  const user = await userRepository.create(userData);
} catch (error) {
  if (error instanceof RepositoryException) {
    switch (error.type) {
      case 'DUPLICATE_KEY':
        // Handle duplicate key error
        break;
      case 'VALIDATION_ERROR':
        // Handle validation error
        break;
      case 'FOREIGN_KEY_VIOLATION':
        // Handle foreign key error
        break;
      default:
        // Handle other errors
        break;
    }
  }
}
```

## Best Practices

1. **Use Repository Instances**: Import and use the singleton instances for consistency
2. **Handle Errors**: Always wrap repository calls in try-catch blocks
3. **Use Transactions**: For operations that span multiple repositories
4. **Leverage Pagination**: Always use pagination for list operations
5. **Validate Input**: Repositories include basic validation, but add business logic validation in services
6. **Use Bulk Operations**: For better performance when dealing with multiple records
7. **Monitor Performance**: Enable audit logging in development to monitor query performance

## Integration with Services

Repositories are designed to be used by service classes:

```typescript
// In a service class
import { userRepository, taskRepository } from '@/db/repositories';

export class TaskService {
  async assignTask(taskId: string, assigneeId: string) {
    // Validate assignee exists
    const assignee = await userRepository.findById(assigneeId);
    if (!assignee) {
      throw new Error('Assignee not found');
    }

    // Assign task
    const task = await taskRepository.assignTask(taskId, assigneeId);
    
    // Create notification (example)
    await notificationRepository.create({
      userId: assigneeId,
      title: 'New Task Assigned',
      message: `You have been assigned to task: ${task.title}`,
      type: 'task_assigned'
    });

    return task;
  }
}
```

This repository layer provides a solid foundation for building scalable and maintainable database operations in the task management application.
