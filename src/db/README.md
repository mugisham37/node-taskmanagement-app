# Database Layer Documentation

This directory contains the complete database layer implementation for the task management application, built with Drizzle ORM and PostgreSQL.

## 🏗️ Architecture Overview

The database layer follows a clean, modular architecture with the following components:

```
db/
├── connection.ts          # Database connection and pool management
├── health.ts             # Health monitoring and metrics
├── setup.ts              # Database initialization and setup utilities
├── index.ts              # Main exports
├── schema/               # Database schema definitions
├── repositories/         # Data access layer
├── migrations/           # Database migration system
└── README.md            # This documentation
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { db, repositories, initializeDatabase } from '../db';

// Initialize database (run migrations, health checks)
await initializeDatabase({
  runMigrations: true,
  validateHealth: true,
  seedData: false
});

// Use repositories
const user = await repositories.user.findById('user-id');
const tasks = await repositories.task.findMany({ 
  where: eq(tasks.userId, 'user-id'),
  page: 1,
  limit: 10 
});
```

### Advanced Setup

```typescript
import { DatabaseSetup } from '../db';

const setup = new DatabaseSetup({
  runMigrations: true,
  seedData: true,
  validateHealth: true,
  logSetup: true
});

const result = await setup.initialize();
if (!result.success) {
  console.error('Setup failed:', result.errors);
}
```

## 📊 Schema Design

### Core Entities

- **Users**: User accounts and authentication
- **Workspaces**: Multi-tenant workspace organization
- **Teams**: Team management within workspaces
- **Projects**: Project organization and management
- **Tasks**: Core task management with rich metadata
- **Comments**: Task and project discussions
- **Notifications**: Real-time notification system
- **Activities**: Audit trail and activity logging
- **Audit Logs**: Comprehensive system audit trail

### Advanced Features

- **Task Templates**: Reusable task configurations
- **Recurring Tasks**: Automated task creation patterns
- **Calendar Integration**: External calendar synchronization
- **Invitations**: Team and workspace invitation system
- **Feedback**: User feedback and rating system

### Schema Features

- ✅ **Soft Delete Support**: Non-destructive record deletion
- ✅ **Optimistic Locking**: Concurrent update protection
- ✅ **Audit Trails**: Comprehensive change tracking
- ✅ **Timestamps**: Automatic created/updated tracking
- ✅ **UUID Primary Keys**: Globally unique identifiers
- ✅ **Foreign Key Constraints**: Data integrity enforcement
- ✅ **Indexes**: Optimized query performance
- ✅ **JSONB Support**: Flexible metadata storage

## 🗄️ Repository Pattern

### Base Repository

All repositories extend `BaseRepository` which provides:

```typescript
// CRUD Operations
findById(id: string): Promise<T | null>
findMany(options: PaginationOptions): Promise<PaginatedResult<T>>
create(data: TInsert): Promise<T>
update(id: string, data: Partial<TInsert>, expectedVersion?: number): Promise<T | null>
delete(id: string): Promise<boolean>

// Bulk Operations
createMany(data: TInsert[]): Promise<T[]>
updateMany(ids: string[], data: Partial<TInsert>): Promise<BulkOperationResult>
deleteMany(ids: string[]): Promise<BulkOperationResult>

// Utility Methods
exists(id: string): Promise<boolean>
count(options?: FilterOptions): Promise<number>
withTransaction<R>(callback: (tx: any) => Promise<R>): Promise<R>

// Soft Delete Support
softDelete(id: string): Promise<T | null>
restore(id: string): Promise<T | null>
findWithDeleted(options?: PaginationOptions): Promise<PaginatedResult<T>>
findDeleted(options?: PaginationOptions): Promise<PaginatedResult<T>>
```

### Repository Features

- **Pagination**: Built-in pagination with metadata
- **Filtering**: Flexible where conditions
- **Sorting**: Multi-column sorting support
- **Caching**: Optional result caching (configurable)
- **Audit Logging**: Automatic change tracking
- **Error Handling**: Consistent error management
- **Transaction Support**: Database transaction wrapping
- **Optimistic Locking**: Concurrent update protection

### Example Repository Usage

```typescript
import { repositories } from '../db';

// Basic operations
const user = await repositories.user.create({
  email: 'user@example.com',
  name: 'John Doe',
  role: 'USER'
});

// Pagination and filtering
const tasks = await repositories.task.findMany({
  where: and(
    eq(tasks.userId, userId),
    eq(tasks.status, 'IN_PROGRESS')
  ),
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc'
});

// Bulk operations
const result = await repositories.task.updateMany(
  ['task1', 'task2', 'task3'],
  { status: 'COMPLETED' }
);

// Transactions
await repositories.user.withTransaction(async (tx) => {
  const user = await repositories.user.create(userData);
  await repositories.workspace.create({
    ...workspaceData,
    ownerId: user.id
  });
});
```

## 🔄 Migration System

### Migration Structure

Migrations follow a timestamp-based naming convention:

```
migrations/
├── 20240101120000_initial_schema.sql
├── 20240102130000_add_audit_logs.sql
└── migration-runner.ts
```

### Migration File Format

```sql
-- UP
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- DOWN
DROP TABLE users;
```

### Migration Commands

```typescript
import { migrationRunner } from '../db';

// Run pending migrations
await migrationRunner.runMigrations();

// Check migration status
const status = await migrationRunner.getMigrationStatus();

// Validate migrations
const validation = await migrationRunner.validateMigrations();

// Rollback specific migration
await migrationRunner.rollbackMigration('20240101120000_initial_schema');
```

## 🏥 Health Monitoring

### Health Metrics

The health system provides comprehensive database monitoring:

```typescript
import { checkDatabaseHealth, getDatabaseMetrics } from '../db';

const health = await checkDatabaseHealth();
// Returns: connection status, query performance, pool usage, etc.

const metrics = await getDatabaseMetrics();
// Returns: table sizes, index usage, slow queries, etc.
```

### Available Metrics

- **Connection Health**: Pool status and connection counts
- **Query Performance**: Average query times and slow query detection
- **Database Size**: Table sizes and growth trends
- **Index Usage**: Index efficiency and unused index detection
- **Lock Analysis**: Lock contention and blocking queries
- **Cache Hit Ratios**: Buffer cache performance

### Health Monitoring Integration

```typescript
import { dbHealthMonitor } from '../db';

// Start continuous monitoring
dbHealthMonitor.start({
  interval: 30000, // 30 seconds
  onAlert: (alert) => {
    console.warn('Database alert:', alert);
    // Send to monitoring system
  }
});
```

## 🔍 Audit System

### Comprehensive Audit Trail

The audit system tracks all database changes:

```typescript
import { auditRepository } from '../db';

// Log custom activity
await auditRepository.logActivity({
  entityType: 'task',
  entityId: 'task-123',
  action: 'UPDATE',
  userId: 'user-456',
  oldValues: { status: 'TODO' },
  newValues: { status: 'IN_PROGRESS' },
  metadata: { source: 'web_app' }
});

// Query audit history
const history = await auditRepository.getEntityHistory('task', 'task-123');
const userActivity = await auditRepository.findUserActivity('user-456');
const securityEvents = await auditRepository.getSecurityEvents();
```

### Audit Features

- **Automatic Tracking**: Repository operations are automatically audited
- **Change Detection**: Old vs new value comparison
- **User Attribution**: Track who made changes
- **IP and User Agent**: Security context tracking
- **Flexible Querying**: Rich query capabilities for audit data
- **Data Retention**: Configurable audit log cleanup

## 🛠️ Database Setup & Utilities

### Initialization

```typescript
import { initializeDatabase, validateDatabase } from '../db';

// Full initialization
const result = await initializeDatabase({
  runMigrations: true,
  seedData: true,
  validateHealth: true,
  logSetup: true
});

// Validation only
const isValid = await validateDatabase();
```

### Setup Features

- **Migration Execution**: Automatic pending migration execution
- **Health Validation**: Comprehensive health checks
- **
