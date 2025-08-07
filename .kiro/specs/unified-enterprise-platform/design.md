# Unified Enterprise Platform - Design Document

## Overview

This design document outlines the architecture and implementation approach for combining the enterprise authentication system with the comprehensive task management application. The design follows Domain-Driven Design (DDD) principles, maintains enterprise security standards, and creates a scalable, maintainable platform that serves as a unified solution for authentication and task management.

The architecture leverages the authentication system's proven foundation while seamlessly integrating task management capabilities, real-time collaboration, and advanced enterprise features.

## Architecture

### High-Level Architecture

The unified platform follows a layered DDD architecture with clear domain separation:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │   REST API  │ │  WebSocket  │ │    Admin Dashboard      │ │
│  │ Controllers │ │   Gateway   │ │      Interface          │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  Use Cases  │ │  Services   │ │    Event Handlers       │ │
│  │ Orchestration│ │ Business    │ │   Cross-Domain          │ │
│  │             │ │ Logic       │ │   Integration           │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Domain Layer                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │    Auth     │ │    Task     │ │      Shared             │ │
│  │   Domain    │ │ Management  │ │     Domains             │ │
│  │             │ │   Domain    │ │ (Notification, Audit)   │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  Database   │ │   Cache     │ │   External Services     │ │
│  │ (PostgreSQL)│ │  (Redis)    │ │ (Email, SMS, Calendar)  │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Domain Architecture

The system is organized into distinct domains following DDD principles:

#### Core Domains

1. **Authentication Domain**: User management, sessions, roles, permissions, MFA, OAuth
2. **Task Management Domain**: Workspaces, projects, tasks, teams, templates, recurring tasks
3. **Calendar Domain**: Events, integrations, reminders, availability
4. **Collaboration Domain**: Comments, attachments, mentions, sharing
5. **Notification Domain**: Unified notifications, preferences, webhooks
6. **Analytics Domain**: Activity tracking, metrics, reports, dashboards

#### Supporting Domains

1. **Audit Domain**: Comprehensive logging across all domains
2. **File Management Domain**: Secure file storage and access control
3. **Integration Domain**: External service integrations and data import/export

### Technology Stack Integration

#### Backend Framework Migration

- **From**: Express.js (Task Management) → **To**: Fastify 4.24+ (Authentication)
- **Rationale**: Fastify provides better performance, TypeScript support, and plugin architecture
- **Migration Strategy**: Gradual endpoint migration with compatibility layer

#### Database Strategy

- **From**: Drizzle ORM (Task Management) → **To**: Prisma (Authentication)
- **Database**: PostgreSQL 15+ (consistent across both systems)
- **Migration Approach**: Schema unification with data preservation

#### Caching Architecture

- **Primary**: Redis 7+ with clustering support
- **Strategy**: Multi-layer caching (L1: Memory, L2: Redis, L3: Database)
- **Integration**: Extend existing cache infrastructure for task management

## Components and Interfaces

### Core Components

#### 1. Authentication Service Integration

```typescript
interface UnifiedAuthenticationService {
  // Core authentication (existing)
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  validateToken(token: string): Promise<TokenValidation>;
  refreshToken(request: RefreshTokenRequest): Promise<TokenPair>;

  // Enhanced for task management
  authenticateWithWorkspaceContext(
    credentials: AuthCredentials,
    workspaceId?: string
  ): Promise<AuthResultWithContext>;

  validateTaskPermission(
    userId: string,
    resource: string,
    action: string,
    context: PermissionContext
  ): Promise<boolean>;
}
```

#### 2. Workspace Management Service

```typescript
interface WorkspaceService {
  createWorkspace(data: CreateWorkspaceData): Promise<Workspace>;
  getUserWorkspaces(userId: string): Promise<Workspace[]>;
  switchWorkspaceContext(
    userId: string,
    workspaceId: string
  ): Promise<WorkspaceContext>;
  manageWorkspaceMembers(
    workspaceId: string,
    operations: MemberOperation[]
  ): Promise<void>;
  enforceWorkspaceIsolation(
    userId: string,
    resourceId: string
  ): Promise<boolean>;
}
```

#### 3. Unified Permission System

```typescript
interface UnifiedPermissionService {
  // Hierarchical permission checking
  checkWorkspacePermission(
    userId: string,
    workspaceId: string,
    permission: string
  ): Promise<boolean>;
  checkProjectPermission(
    userId: string,
    projectId: string,
    permission: string
  ): Promise<boolean>;
  checkTaskPermission(
    userId: string,
    taskId: string,
    permission: string
  ): Promise<boolean>;

  // Role-based access control
  assignWorkspaceRole(
    userId: string,
    workspaceId: string,
    role: WorkspaceRole
  ): Promise<void>;
  assignProjectRole(
    userId: string,
    projectId: string,
    role: ProjectRole
  ): Promise<void>;

  // Dynamic permission evaluation
  evaluatePermission(
    context: PermissionEvaluationContext
  ): Promise<PermissionResult>;
}
```

#### 4. Real-Time Collaboration Engine

```typescript
interface CollaborationEngine {
  // WebSocket connection management
  establishConnection(
    userId: string,
    workspaceId: string
  ): Promise<WebSocketConnection>;
  subscribeToTaskUpdates(connectionId: string, taskId: string): Promise<void>;
  subscribeToProjectUpdates(
    connectionId: string,
    projectId: string
  ): Promise<void>;

  // Real-time event broadcasting
  broadcastTaskUpdate(taskId: string, update: TaskUpdate): Promise<void>;
  broadcastCommentAdded(taskId: string, comment: Comment): Promise<void>;
  broadcastPresenceUpdate(
    userId: string,
    presence: PresenceInfo
  ): Promise<void>;

  // Collaborative editing
  handleCollaborativeEdit(
    taskId: string,
    edit: EditOperation
  ): Promise<EditResult>;
  resolveEditConflicts(
    taskId: string,
    conflicts: EditConflict[]
  ): Promise<Resolution>;
}
```

#### 5. Unified Notification System

```typescript
interface UnifiedNotificationService {
  // Multi-channel notification delivery
  sendNotification(
    notification: NotificationRequest
  ): Promise<NotificationResult>;
  sendBulkNotifications(
    notifications: NotificationRequest[]
  ): Promise<BulkNotificationResult>;

  // Channel-specific delivery
  sendEmailNotification(notification: EmailNotification): Promise<void>;
  sendPushNotification(notification: PushNotification): Promise<void>;
  sendWebSocketNotification(notification: WebSocketNotification): Promise<void>;

  // Preference management
  updateNotificationPreferences(
    userId: string,
    preferences: NotificationPreferences
  ): Promise<void>;
  getEffectivePreferences(
    userId: string,
    context: NotificationContext
  ): Promise<EffectivePreferences>;
}
```

### Integration Interfaces

#### 1. Cross-Domain Event Bus

```typescript
interface DomainEventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): Promise<Subscription>;

  // Cross-domain event correlation
  publishWithCorrelation(
    event: DomainEvent,
    correlationId: string
  ): Promise<void>;
  subscribeToCorrelatedEvents(correlationId: string): Promise<EventStream>;
}
```

#### 2. Unified Audit Service

```typescript
interface UnifiedAuditService {
  // Enhanced audit logging
  logAuthenticationEvent(event: AuthEvent): Promise<void>;
  logTaskManagementEvent(event: TaskEvent): Promise<void>;
  logCrossDomainEvent(event: CrossDomainEvent): Promise<void>;

  // Audit querying and reporting
  getAuditTrail(filters: AuditFilters): Promise<AuditEntry[]>;
  generateComplianceReport(
    criteria: ComplianceCriteria
  ): Promise<ComplianceReport>;

  // Real-time audit streaming
  streamAuditEvents(filters: AuditFilters): Promise<AuditStream>;
}
```

## Data Models

### Unified Database Schema

#### Enhanced User Model

```sql
-- Extended users table combining auth and task management
CREATE TABLE users (
  -- Authentication fields (preserved from auth system)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified TIMESTAMP,
  name VARCHAR(255),
  image TEXT,
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- MFA fields (preserved)
  mfa_enabled BOOLEAN DEFAULT FALSE,
  totp_secret VARCHAR(255),
  backup_codes TEXT[],

  -- Security fields (preserved)
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  last_login_at TIMESTAMP,
  last_login_ip INET,
  risk_score FLOAT DEFAULT 0.0,

  -- Task management extensions
  timezone VARCHAR(50) DEFAULT 'UTC',
  work_hours JSONB DEFAULT '{"start": "09:00", "end": "17:00", "days": [1,2,3,4,5]}',
  task_view_preferences JSONB DEFAULT '{"defaultView": "list", "groupBy": "status"}',
  notification_settings JSONB DEFAULT '{"email": true, "push": true, "desktop": true}',
  productivity_settings JSONB DEFAULT '{"pomodoroLength": 25, "breakLength": 5}',
  avatar_color VARCHAR(7) DEFAULT '#3B82F6',

  -- Workspace context
  active_workspace_id UUID REFERENCES workspaces(id),
  workspace_preferences JSONB DEFAULT '{}'
);
```

#### Multi-Tenant Workspace Model

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,

  -- Ownership and billing
  owner_id UUID NOT NULL REFERENCES users(id),
  subscription_tier VARCHAR(50) DEFAULT 'free',
  billing_email VARCHAR(255),

  -- Configuration
  settings JSONB DEFAULT '{}',
  branding JSONB DEFAULT '{}',
  security_settings JSONB DEFAULT '{}',

  -- Status and limits
  is_active BOOLEAN DEFAULT TRUE,
  member_limit INTEGER DEFAULT 10,
  project_limit INTEGER DEFAULT 5,
  storage_limit_gb INTEGER DEFAULT 1,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

#### Enhanced Project Model

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',

  -- Project management
  owner_id UUID NOT NULL REFERENCES users(id),
  status project_status DEFAULT 'planning',
  priority project_priority DEFAULT 'medium',

  -- Timeline and budget
  start_date DATE,
  end_date DATE,
  budget_amount DECIMAL(10,2),
  budget_currency VARCHAR(3) DEFAULT 'USD',

  -- Configuration
  settings JSONB DEFAULT '{}',
  template_id UUID REFERENCES project_templates(id),

  -- Status tracking
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP,
  archived_by UUID REFERENCES users(id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_dates CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date),
  CONSTRAINT valid_budget CHECK (budget_amount IS NULL OR budget_amount >= 0)
);
```

#### Comprehensive Task Model

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  project_id UUID REFERENCES projects(id),

  -- Basic task information
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status task_status DEFAULT 'todo',
  priority task_priority DEFAULT 'medium',

  -- Assignment and ownership
  assignee_id UUID REFERENCES users(id),
  creator_id UUID NOT NULL REFERENCES users(id),
  reporter_id UUID REFERENCES users(id),

  -- Timeline management
  due_date TIMESTAMP,
  start_date TIMESTAMP,
  completed_at TIMESTAMP,

  -- Effort tracking
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  story_points INTEGER,

  -- Organization
  tags TEXT[] DEFAULT '{}',
  labels UUID[] DEFAULT '{}',
  epic_id UUID REFERENCES tasks(id),
  parent_task_id UUID REFERENCES tasks(id),

  -- Attachments and links
  attachments JSONB DEFAULT '[]',
  external_links JSONB DEFAULT '[]',

  -- Recurring task support
  recurring_task_id UUID REFERENCES recurring_tasks(id),
  recurrence_instance_date DATE,

  -- Collaboration
  watchers UUID[] DEFAULT '{}',
  last_activity_at TIMESTAMP DEFAULT NOW(),

  -- Metadata
  custom_fields JSONB DEFAULT '{}',
  position INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_effort CHECK (estimated_hours IS NULL OR estimated_hours >= 0),
  CONSTRAINT valid_actual_hours CHECK (actual_hours IS NULL OR actual_hours >= 0),
  CONSTRAINT valid_story_points CHECK (story_points IS NULL OR story_points >= 0),
  CONSTRAINT no_self_parent CHECK (id != parent_task_id)
);
```

### Permission and Role Models

#### Hierarchical Permission System

```sql
-- Enhanced roles with workspace context
CREATE TABLE workspace_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions TEXT[] NOT NULL,
  is_system_role BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(workspace_id, name)
);

-- User workspace memberships
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role_id UUID NOT NULL REFERENCES workspace_roles(id),

  -- Membership details
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP,

  -- Status
  status member_status DEFAULT 'active',

  UNIQUE(workspace_id, user_id)
);

-- Project-specific roles
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role project_member_role DEFAULT 'member',

  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, user_id)
);
```

## Error Handling

### Unified Error Architecture

#### Error Hierarchy

```typescript
// Base error classes
abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp: Date = new Date();
  readonly correlationId?: string;

  constructor(
    message: string,
    public readonly context?: Record<string, any>,
    correlationId?: string
  ) {
    super(message);
    this.correlationId = correlationId;
  }
}

// Authentication domain errors
class AuthenticationError extends DomainError {
  readonly code = "AUTH_ERROR";
  readonly statusCode = 401;
}

class AuthorizationError extends DomainError {
  readonly code = "AUTHORIZATION_ERROR";
  readonly statusCode = 403;
}

// Task management domain errors
class TaskNotFoundError extends DomainError {
  readonly code = "TASK_NOT_FOUND";
  readonly statusCode = 404;
}

class WorkspaceAccessDeniedError extends DomainError {
  readonly code = "WORKSPACE_ACCESS_DENIED";
  readonly statusCode = 403;
}

// Cross-domain errors
class CrossDomainValidationError extends DomainError {
  readonly code = "CROSS_DOMAIN_VALIDATION_ERROR";
  readonly statusCode = 400;
}
```

#### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    correlationId?: string;
    path: string;
    method: string;
  };
  meta: {
    requestId: string;
    version: string;
  };
}
```

### Error Handling Strategy

1. **Domain-Specific Errors**: Each domain defines its own error types
2. **Error Correlation**: All errors include correlation IDs for tracing
3. **Structured Logging**: Errors are logged with full context
4. **Client-Friendly Messages**: User-facing error messages are sanitized
5. **Monitoring Integration**: Errors trigger monitoring alerts

## Testing Strategy

### Multi-Layer Testing Approach

#### 1. Unit Testing

```typescript
// Domain entity testing
describe("Task Entity", () => {
  it("should enforce business rules when assigning task", () => {
    const task = new Task(taskProps);
    const assignee = new User(userProps);

    expect(() => task.assignTo(assignee, context)).not.toThrow();
    expect(task.assigneeId).toBe(assignee.id);
  });
});

// Service testing with mocks
describe("TaskService", () => {
  it("should create task with proper authorization", async () => {
    const mockAuthService = createMockAuthService();
    const mockTaskRepo = createMockTaskRepository();

    const service = new TaskService(mockAuthService, mockTaskRepo);
    const result = await service.createTask(userId, taskData);

    expect(mockAuthService.validatePermission).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
```

#### 2. Integration Testing

```typescript
// Cross-domain integration testing
describe("Authentication + Task Management Integration", () => {
  it("should create task with authenticated user context", async () => {
    // Authenticate user
    const authResult = await authService.authenticate(credentials);

    // Create task with auth context
    const task = await taskService.createTask(authResult.user.id, taskData);

    // Verify audit trail
    const auditLogs = await auditService.getAuditTrail({
      userId: authResult.user.id,
      action: "TASK_CREATED",
    });

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      userId: authResult.user.id,
      action: "TASK_CREATED",
      resourceId: task.id,
    });
  });
});
```

#### 3. End-to-End Testing

```typescript
// Full workflow testing
describe("Complete Task Management Workflow", () => {
  it("should handle complete project lifecycle", async () => {
    // 1. User registration and authentication
    const user = await registerUser(userData);
    const authToken = await authenticateUser(user.email, password);

    // 2. Workspace creation
    const workspace = await createWorkspace(authToken, workspaceData);

    // 3. Project creation
    const project = await createProject(authToken, workspace.id, projectData);

    // 4. Task creation and assignment
    const task = await createTask(authToken, project.id, taskData);
    await assignTask(authToken, task.id, assigneeId);

    // 5. Real-time collaboration
    const wsConnection = await establishWebSocketConnection(authToken);
    await subscribeToTaskUpdates(wsConnection, task.id);

    // 6. Task completion and analytics
    await completeTask(authToken, task.id);
    const analytics = await getProjectAnalytics(authToken, project.id);

    expect(analytics.completionRate).toBeGreaterThan(0);
  });
});
```

### Testing Infrastructure

#### Test Database Management

```typescript
// Test database setup with proper isolation
class TestDatabaseManager {
  async setupTestDatabase(): Promise<Database> {
    const testDb = await createTestDatabase();
    await runMigrations(testDb);
    await seedTestData(testDb);
    return testDb;
  }

  async cleanupTestDatabase(db: Database): Promise<void> {
    await truncateAllTables(db);
    await closeConnection(db);
  }
}
```

#### Mock Service Factory

```typescript
// Comprehensive mock factory for testing
class MockServiceFactory {
  createMockAuthService(): jest.Mocked<AuthenticationService> {
    return {
      authenticate: jest.fn(),
      validateToken: jest.fn(),
      checkPermission: jest.fn(),
      // ... other methods
    };
  }

  createMockTaskService(): jest.Mocked<TaskService> {
    return {
      createTask: jest.fn(),
      updateTask: jest.fn(),
      assignTask: jest.fn(),
      // ... other methods
    };
  }
}
```

## Performance Optimization

### Caching Strategy

#### Multi-Layer Caching Architecture

```typescript
interface CacheStrategy {
  // L1: In-memory cache for frequently accessed data
  memoryCache: {
    userSessions: Map<string, SessionData>;
    workspacePermissions: Map<string, PermissionSet>;
    activeConnections: Map<string, WebSocketConnection>;
  };

  // L2: Redis cache for shared data
  redisCache: {
    userProfiles: RedisCache<UserProfile>;
    projectData: RedisCache<ProjectData>;
    taskLists: RedisCache<TaskList>;
    analyticsData: RedisCache<AnalyticsData>;
  };

  // L3: Database with optimized queries
  database: {
    readReplicas: DatabaseConnection[];
    writeConnection: DatabaseConnection;
    connectionPool: ConnectionPool;
  };
}
```

#### Intelligent Cache Invalidation

```typescript
class IntelligentCacheInvalidation {
  async invalidateTaskRelatedCaches(taskId: string): Promise<void> {
    const task = await this.getTask(taskId);

    // Invalidate task-specific caches
    await this.cache.delete(`task:${taskId}`);
    await this.cache.delete(`task:${taskId}:comments`);

    // Invalidate project-related caches
    if (task.projectId) {
      await this.cache.invalidateByTag(`project:${task.projectId}`);
    }

    // Invalidate user-related caches
    if (task.assigneeId) {
      await this.cache.invalidateByTag(`user:${task.assigneeId}:tasks`);
    }

    // Invalidate workspace analytics
    await this.cache.invalidateByTag(`workspace:${task.workspaceId}:analytics`);
  }
}
```

### Database Optimization

#### Query Optimization Strategy

```sql
-- Optimized indexes for common queries
CREATE INDEX CONCURRENTLY idx_tasks_workspace_status
ON tasks(workspace_id, status)
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_tasks_assignee_due_date
ON tasks(assignee_id, due_date)
WHERE status != 'completed' AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_activities_user_timestamp
ON activities(user_id, created_at DESC)
WHERE created_at > NOW() - INTERVAL '30 days';

-- Partial indexes for performance
CREATE INDEX CONCURRENTLY idx_tasks_overdue
ON tasks(due_date, status)
WHERE due_date < NOW() AND status NOT IN ('completed', 'cancelled');
```

#### Connection Pool Configuration

```typescript
const databaseConfig = {
  connectionPool: {
    min: 5,
    max: 20,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
  readReplicas: {
    enabled: true,
    connections: ["read-replica-1", "read-replica-2"],
    loadBalancing: "round-robin",
  },
};
```

### Real-Time Performance

#### WebSocket Connection Management

```typescript
class OptimizedWebSocketManager {
  private connectionPools = new Map<string, WebSocketPool>();

  async optimizeConnection(userId: string, workspaceId: string): Promise<void> {
    // Connection pooling by workspace
    const poolKey = `workspace:${workspaceId}`;
    let pool = this.connectionPools.get(poolKey);

    if (!pool) {
      pool = new WebSocketPool({
        maxConnections: 1000,
        heartbeatInterval: 30000,
        compressionEnabled: true,
      });
      this.connectionPools.set(poolKey, pool);
    }

    // Intelligent subscription management
    await this.optimizeSubscriptions(userId, workspaceId);
  }

  private async optimizeSubscriptions(
    userId: string,
    workspaceId: string
  ): Promise<void> {
    // Subscribe only to relevant channels
    const userProjects = await this.getUserProjects(userId, workspaceId);
    const relevantChannels = [
      `user:${userId}`,
      `workspace:${workspaceId}`,
      ...userProjects.map((p) => `project:${p.id}`),
    ];

    await this.subscribeToChannels(userId, relevantChannels);
  }
}
```

This comprehensive design document provides the architectural foundation for successfully combining the enterprise authentication system with the task management application. The design maintains the security and scalability of the authentication system while seamlessly integrating comprehensive task management capabilities.
