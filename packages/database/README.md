# @taskmanagement/database

Database access layer with migrations, repositories, and query builders for the Task Management application.

## Features

- **Connection Management**: Singleton database connection with health checks
- **Repository Pattern**: Type-safe repository implementations using Drizzle ORM
- **Transaction Management**: Comprehensive transaction support with savepoints
- **Schema Management**: Drizzle-based schema definitions and migrations
- **Backup & Recovery**: Automated backup, point-in-time recovery, and disaster recovery
- **Query Optimization**: Performance optimization and query analysis
- **Data Seeding**: Comprehensive data seeding for development and testing

## Installation

```bash
npm install @taskmanagement/database
```

## Usage

### Database Connection

```typescript
import { DatabaseConnection, createDatabaseConfig } from '@taskmanagement/database';

// Create configuration
const config = createDatabaseConfig('development');

// Get connection instance
const connection = DatabaseConnection.getInstance(config);

// Connect to database
await connection.connect();

// Health check
const health = await connection.healthCheck();
console.log('Database health:', health);
```

### Repository Usage

```typescript
import { UserRepository, TaskRepository } from '@taskmanagement/database';

// Initialize repositories
const userRepo = new UserRepository(connection);
const taskRepo = new TaskRepository(connection);

// Find user by ID
const user = await userRepo.findById('user-id');

// Find tasks with filters
const tasks = await taskRepo.findAll({
  filters: { status: 'active', assigneeId: 'user-id' },
  pagination: { page: 1, limit: 10 },
  sort: { field: 'createdAt', direction: 'desc' }
});

// Create new task
const newTask = Task.create({
  title: 'New Task',
  description: 'Task description',
  projectId: 'project-id'
});
await taskRepo.save(newTask);
```

### Transaction Management

```typescript
import { TransactionManager } from '@taskmanagement/database';

const transactionManager = new TransactionManager(connection);

// Execute in transaction
await transactionManager.executeInTransaction(async (tx) => {
  const user = await userRepo.findById('user-id');
  user.updateEmail('new@email.com');
  await userRepo.save(user);
  
  const task = await taskRepo.findById('task-id');
  task.assignTo(user.id);
  await taskRepo.save(task);
});

// Manual transaction control
await transactionManager.begin();
try {
  // Perform operations
  await transactionManager.commit();
} catch (error) {
  await transactionManager.rollback();
  throw error;
}
```

### Schema and Migrations

```typescript
import { migrate } from '@taskmanagement/database';

// Run migrations
await migrate(connection);
```

### Data Seeding

```typescript
import { DatabaseSeeder } from '@taskmanagement/database';

const seeder = new DatabaseSeeder(connection);

// Seed all data
await seeder.seedAll({
  environment: 'development',
  userCount: 50,
  workspaceCount: 10,
  clearExisting: true
});

// Seed specific data
await seeder.seedUsers(100);
await seeder.seedWorkspaces(20);
```

### Backup and Recovery

```typescript
import { 
  createBackupRecoveryStack,
  BackupRecoveryManager 
} from '@taskmanagement/database';

// Create backup and recovery services
const {
  backupManager,
  automatedBackupService,
  pitrService,
  disasterRecoveryService
} = createBackupRecoveryStack(connection, loggingService, metricsService);

// Create backup
await backupManager.createBackup({
  type: 'full',
  compression: true,
  encryption: true
});

// Restore from backup
await backupManager.restoreFromBackup({
  backupPath: '/path/to/backup.sql',
  targetDatabase: 'restored_db'
});

// Point-in-time recovery
await pitrService.recoverToPoint({
  targetTime: new Date('2023-12-01T10:30:00Z'),
  targetDatabase: 'recovered_db'
});
```

## Configuration

### Environment Variables

```bash
# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/taskmanagement
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=taskmanagement
DATABASE_USER=user
DATABASE_PASSWORD=password

# Connection pool
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_POOL_IDLE_TIMEOUT=30000

# SSL configuration
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false

# Backup configuration
BACKUP_STORAGE_PATH=/var/backups/taskmanagement
BACKUP_RETENTION_DAYS=30
BACKUP_COMPRESSION=true
BACKUP_ENCRYPTION_KEY=your-encryption-key
```

### Database Configuration

```typescript
import { createDatabaseConfig } from '@taskmanagement/database';

const config = createDatabaseConfig('production', {
  // Override default settings
  pool: {
    min: 5,
    max: 20,
    idleTimeoutMillis: 60000
  },
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-cert.pem')
  }
});
```

## Schema Structure

The database schema includes the following main entities:

- **Users**: User accounts and authentication
- **Workspaces**: Multi-tenant workspaces
- **Projects**: Project management within workspaces
- **Tasks**: Task management with dependencies
- **Notifications**: User notifications and preferences
- **Audit Logs**: System activity tracking
- **Webhooks**: External integrations
- **Calendar Events**: Calendar integration
- **File Attachments**: File management

## Repository Interfaces

All repositories implement standard interfaces:

```typescript
interface IRepository<T, ID> {
  findById(id: ID): Promise<T | null>;
  findAll(criteria?: QueryCriteria): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: ID): Promise<void>;
  exists(id: ID): Promise<boolean>;
}
```

## Performance Optimization

The package includes several performance optimization features:

- **Connection Pooling**: Efficient connection management
- **Query Optimization**: Automatic query analysis and optimization
- **Indexing**: Proper database indexing strategies
- **Caching**: Repository-level caching support
- **Batch Operations**: Efficient bulk operations

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

## Scripts

```bash
# Build the package
npm run build

# Generate database schema
npm run db:generate

# Run migrations
npm run db:migrate

# Open Drizzle Studio
npm run db:studio

# Seed database
npm run db:seed
```

## Dependencies

- **drizzle-orm**: Type-safe SQL query builder
- **postgres**: PostgreSQL client
- **pg**: Node.js PostgreSQL client
- **uuid**: UUID generation
- **zod**: Runtime type validation

## Development Dependencies

- **drizzle-kit**: Drizzle ORM toolkit
- **typescript**: TypeScript compiler
- **vitest**: Testing framework
- **tsx**: TypeScript execution

## License

MIT