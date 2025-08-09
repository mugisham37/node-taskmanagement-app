# Task Management Project Complete Rebuild - Design Document

## Overview

This design document outlines the complete architectural transformation of the task management system from an over-engineered, fragmented codebase to a production-ready, cohesive backend. The design follows Clean Architecture principles with CQRS pattern, uses Drizzle ORM exclusively, and eliminates all structural bloat while ensuring every component contributes to the system's functionality.

## Architecture

### High-Level Architecture

The system follows a 4-layer Clean Architecture pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Controllers │ │ WebSocket   │ │ Middleware  │           │
│  │             │ │ Handlers    │ │             │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Use Cases   │ │ CQRS        │ │ Application │           │
│  │             │ │ Handlers    │ │ Services    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Domain Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Entities    │ │ Aggregates  │ │ Domain      │           │
│  │ & VOs       │ │             │ │ Services    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Database    │ │ External    │ │ Security &  │           │
│  │ (Drizzle)   │ │ Services    │ │ Monitoring  │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Optimized Directory Structure

```
src/
├── domain/                    # Pure business logic
│   ├── entities/             # Business entities
│   ├── value-objects/        # Value objects with validation
│   ├── aggregates/           # Aggregate roots
│   ├── services/             # Domain services
│   ├── events/               # Domain events
│   ├── repositories/         # Repository interfaces
│   └── specifications/       # Business rule specifications
├── application/              # Use cases & orchestration
│   ├── use-cases/           # Business use cases
│   ├── services/            # Application services
│   ├── commands/            # CQRS commands
│   ├── queries/             # CQRS queries
│   ├── handlers/            # Command/Query handlers
│   └── events/              # Event handling
├── infrastructure/          # External concerns (simplified)
│   ├── database/            # Drizzle ORM setup
│   ├── external-services/   # Email, file storage, etc.
│   ├── security/            # JWT, auth, rate limiting
│   ├── caching/             # Redis caching
│   └── monitoring/          # Logging, metrics, health
├── presentation/            # API controllers & routes
│   ├── controllers/         # REST controllers
│   ├── routes/              # Route definitions
│   ├── middleware/          # Request middleware
│   ├── dto/                 # Data transfer objects
│   └── websocket/           # WebSocket handlers
└── shared/                  # Common utilities (minimal)
    ├── errors/              # Error classes
    ├── utils/               # Utility functions
    └── constants/           # Application constants
```

## Components and Interfaces

### Domain Layer Components

#### Core Entities

**User Entity**

```typescript
class User extends BaseEntity<UserId> {
  private _email: Email;
  private _name: string;
  private _hashedPassword: string;
  private _isActive: boolean;
  private _lastLoginAt: Date | null;

  // Business methods
  updateProfile(name: string, email: string): void;
  activate(): void;
  deactivate(): void;
  recordLogin(): void;
  canCreateProject(): boolean;
}
```

**Task Entity**

```typescript
class Task extends BaseEntity<TaskId> {
  private _title: string;
  private _description: string;
  private _status: TaskStatus;
  private _priority: Priority;
  private _assigneeId: UserId | null;
  private _projectId: ProjectId;
  private _dueDate: Date | null;

  // Business methods
  assign(assigneeId: UserId, assignedBy: UserId): void;
  complete(completedBy: UserId, actualHours?: number): void;
  updatePriority(priority: Priority, updatedBy: UserId): void;
  isOverdue(): boolean;
  canBeAssigned(): boolean;
}
```

**Project Entity**

```typescript
class Project extends BaseEntity<ProjectId> {
  private _name: string;
  private _description: string;
  private _workspaceId: WorkspaceId;
  private _managerId: UserId;
  private _status: ProjectStatus;

  // Business methods
  addMember(userId: UserId, role: ProjectRole): void;
  removeMember(userId: UserId): void;
  canUserCreateTask(userId: UserId): boolean;
  archive(): void;
}
```

#### Value Objects

**Email Value Object**

```typescript
class Email extends ValueObject<string> {
  static create(email: string): Email;
  get domain(): string;
  get localPart(): string;
}
```

**TaskStatus Value Object**

```typescript
enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

class TaskStatusVO extends ValueObject<TaskStatus> {
  canTransitionTo(newStatus: TaskStatus): boolean;
  isCompleted(): boolean;
  isActive(): boolean;
}
```

#### Aggregates

**Task Aggregate**

```typescript
class TaskAggregate extends AggregateRoot {
  private _tasks: Map<TaskId, Task>;
  private _dependencies: Map<TaskId, TaskId[]>;

  createTask(data: CreateTaskData): Task;
  assignTask(taskId: TaskId, assigneeId: UserId, assignedBy: UserId): void;
  completeTask(taskId: TaskId, completedBy: UserId, actualHours?: number): void;
  addTaskDependency(taskId: TaskId, dependsOn: TaskId): void;

  // Business rule enforcement
  private allDependenciesCompleted(taskId: TaskId): boolean;
  private wouldCreateCircularDependency(
    taskId: TaskId,
    dependsOn: TaskId
  ): boolean;
}
```

### Application Layer Components

#### Use Cases

**Create Task Use Case**

```typescript
class CreateTaskUseCase {
  async execute(command: CreateTaskCommand): Promise<TaskResponseDto> {
    // 1. Validate command
    // 2. Load project aggregate
    // 3. Check permissions
    // 4. Create task through aggregate
    // 5. Save changes
    // 6. Publish events
    // 7. Return response
  }
}
```

#### CQRS Implementation

**Commands**

```typescript
interface ICommand {
  readonly timestamp: Date;
  readonly userId: UserId;
}

class CreateTaskCommand implements ICommand {
  constructor(
    public readonly title: string,
    public readonly description: string,
    public readonly priority: Priority,
    public readonly projectId: ProjectId,
    public readonly createdById: UserId,
    public readonly userId: UserId,
    public readonly dueDate?: Date,
    public readonly assigneeId?: UserId
  ) {}
}
```

**Queries**

```typescript
interface IQuery {
  readonly timestamp: Date;
  readonly userId: UserId;
}

class GetTasksByProjectQuery implements IQuery {
  constructor(
    public readonly projectId: ProjectId,
    public readonly userId: UserId,
    public readonly filters?: TaskFilters,
    public readonly pagination?: PaginationOptions
  ) {}
}
```

### Infrastructure Layer Components

#### Database Layer (Drizzle Only)

**Schema Definition**

```typescript
// Drizzle schema with proper relations
export const users = pgTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  hashedPassword: text('hashed_password').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: varchar('id', { length: 36 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: taskStatusEnum('status').default('TODO').notNull(),
  priority: priorityEnum('priority').default('MEDIUM').notNull(),
  assigneeId: varchar('assignee_id', { length: 36 }).references(() => users.id),
  projectId: varchar('project_id', { length: 36 })
    .references(() => projects.id)
    .notNull(),
  createdById: varchar('created_by_id', { length: 36 })
    .references(() => users.id)
    .notNull(),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Repository Implementation**

```typescript
class TaskRepository implements ITaskRepository {
  async findById(id: TaskId): Promise<Task | null>;
  async findByProjectId(
    projectId: ProjectId,
    filters?: TaskFilters
  ): Promise<Task[]>;
  async save(task: Task): Promise<void>;
  async getTaskAggregate(projectId: ProjectId): Promise<TaskAggregate>;
  async saveAggregate(aggregate: TaskAggregate): Promise<void>;
}
```

#### External Services

**Email Service**

```typescript
class EmailService {
  async sendEmail(data: SendEmailData): Promise<void>;
  async sendTaskAssignmentNotification(
    task: Task,
    assignee: User
  ): Promise<void>;
  async sendTaskCompletionNotification(
    task: Task,
    completedBy: User
  ): Promise<void>;
}
```

**Cache Service**

```typescript
class CacheService {
  async get<T>(key: string): Promise<T | null>;
  async set(key: string, value: any, ttl?: number): Promise<void>;
  async del(key: string): Promise<void>;
  async invalidatePattern(pattern: string): Promise<void>;
}
```

### Presentation Layer Components

#### Controllers

**Task Controller**

```typescript
class TaskController {
  async createTask(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  async updateTask(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  async getTask(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  async listTasks(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  async assignTask(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  async completeTask(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void>;
}
```

#### WebSocket Implementation

**WebSocket Gateway**

```typescript
class WebSocketGateway {
  handleConnection(socket: WebSocket, request: IncomingMessage): void;
  handleDisconnection(socket: WebSocket): void;
  broadcastTaskUpdate(taskId: TaskId, update: TaskUpdateEvent): void;
  broadcastPresenceUpdate(userId: UserId, status: PresenceStatus): void;
}
```

## Data Models

### Database Schema

```sql
-- Users table
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  hashed_password TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Workspaces table
CREATE TABLE workspaces (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id VARCHAR(36) REFERENCES users(id) NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Projects table
CREATE TABLE projects (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  workspace_id VARCHAR(36) REFERENCES workspaces(id) NOT NULL,
  manager_id VARCHAR(36) REFERENCES users(id) NOT NULL,
  status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tasks table
CREATE TABLE tasks (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status task_status DEFAULT 'TODO' NOT NULL,
  priority priority DEFAULT 'MEDIUM' NOT NULL,
  assignee_id VARCHAR(36) REFERENCES users(id),
  project_id VARCHAR(36) REFERENCES projects(id) NOT NULL,
  created_by_id VARCHAR(36) REFERENCES users(id) NOT NULL,
  due_date TIMESTAMP,
  estimated_hours INTEGER,
  actual_hours INTEGER,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Task dependencies table
CREATE TABLE task_dependencies (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) REFERENCES tasks(id) NOT NULL,
  depends_on_id VARCHAR(36) REFERENCES tasks(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(task_id, depends_on_id)
);

-- Project members table
CREATE TABLE project_members (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) REFERENCES projects(id) NOT NULL,
  user_id VARCHAR(36) REFERENCES users(id) NOT NULL,
  role project_role DEFAULT 'MEMBER' NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(project_id, user_id)
);
```

### Domain Events

```typescript
// Task Events
class TaskCreatedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly projectId: ProjectId,
    public readonly createdById: UserId
  ) {}
}

class TaskAssignedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly assigneeId: UserId,
    public readonly assignedBy: UserId
  ) {}
}

class TaskCompletedEvent extends DomainEvent {
  constructor(
    public readonly taskId: TaskId,
    public readonly completedBy: UserId,
    public readonly completedAt: Date
  ) {}
}
```

## Error Handling

### Error Hierarchy

```typescript
// Base error classes
abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;
}

class DomainError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;
}

class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;
}

class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly isOperational = true;
}

class InsufficientPermissionsError extends AppError {
  readonly statusCode = 403;
  readonly isOperational = true;
}
```

### Error Handling Strategy

1. **Domain Layer**: Throws domain-specific errors for business rule violations
2. **Application Layer**: Catches domain errors and translates them to application errors
3. **Infrastructure Layer**: Handles technical errors (database, network, etc.)
4. **Presentation Layer**: Catches all errors and returns appropriate HTTP responses

## Testing Strategy

### Testing Pyramid

```
                    ┌─────────────┐
                    │     E2E     │ (Few, Critical Paths)
                    │    Tests    │
                    └─────────────┘
                ┌───────────────────────┐
                │   Integration Tests   │ (API, Database)
                │                       │
                └───────────────────────┘
        ┌─────────────────────────────────────────┐
        │            Unit Tests                   │ (Domain, Application)
        │                                         │
        └─────────────────────────────────────────┘
```

### Test Categories

1. **Unit Tests**: Domain entities, value objects, services, use cases
2. **Integration Tests**: Repository implementations, API endpoints
3. **Contract Tests**: External service integrations
4. **E2E Tests**: Critical user workflows
5. **Performance Tests**: Load testing for critical endpoints

### Test Infrastructure

- **Test Database**: Separate PostgreSQL instance for integration tests
- **Test Containers**: Docker containers for isolated testing
- **Mocking**: Mock external services and infrastructure dependencies
- **Fixtures**: Reusable test data and scenarios

## Security Considerations

### Authentication & Authorization

1. **JWT-based Authentication**: Stateless token-based auth
2. **Role-based Access Control**: User roles and permissions
3. **Resource-level Authorization**: Check permissions at entity level
4. **Token Refresh**: Secure token refresh mechanism

### Input Validation

1. **Schema Validation**: Zod schemas for all inputs
2. **Sanitization**: Clean user inputs to prevent injection
3. **Rate Limiting**: Prevent abuse and DoS attacks
4. **CORS Configuration**: Proper cross-origin resource sharing

### Data Protection

1. **Password Hashing**: Argon2 for password hashing
2. **Sensitive Data**: Encrypt sensitive data at rest
3. **Audit Logging**: Log all security-relevant events
4. **HTTPS Only**: Force HTTPS in production

## Performance Optimization

### Caching Strategy

1. **Redis Caching**: Cache frequently accessed data
2. **Query Optimization**: Optimize database queries with proper indexing
3. **Connection Pooling**: Efficient database connection management
4. **Response Compression**: Compress API responses

### Database Optimization

1. **Indexing Strategy**: Create indexes for frequently queried columns
2. **Query Optimization**: Use Drizzle's query builder efficiently
3. **Pagination**: Implement cursor-based pagination for large datasets
4. **Read Replicas**: Use read replicas for read-heavy operations

### Monitoring & Observability

1. **Health Checks**: Endpoint health monitoring
2. **Metrics Collection**: Application and business metrics
3. **Distributed Tracing**: Request tracing across services
4. **Error Tracking**: Comprehensive error monitoring and alerting

## Deployment Architecture

### Production Environment

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │────│  API Instances  │────│   PostgreSQL    │
│    (Nginx)      │    │   (Node.js)     │    │   (Primary)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                       ┌─────────────────┐    ┌─────────────────┐
                       │     Redis       │    │   PostgreSQL    │
                       │   (Caching)     │    │  (Read Replica) │
                       └─────────────────┘    └─────────────────┘
```

### Container Strategy

1. **Docker Containers**: Containerized application deployment
2. **Multi-stage Builds**: Optimized container images
3. **Health Checks**: Container health monitoring
4. **Resource Limits**: Proper resource allocation

This design provides a comprehensive blueprint for transforming the current over-engineered system into a production-ready, maintainable, and scalable task management platform.
