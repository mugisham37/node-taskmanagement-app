# Development Guide

This comprehensive guide will help you set up, develop, and contribute to the unified full-stack task management platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development Environment](#development-environment)
- [Available Scripts](#available-scripts)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Code Quality](#code-quality)
- [Debugging](#debugging)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Prerequisites

### System Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **Docker**: Latest stable version
- **Docker Compose**: Latest stable version
- **Git**: Latest stable version

### Recommended Tools

- **VS Code**: With recommended extensions
- **Postman**: For API testing
- **Docker Desktop**: For container management

### VS Code Extensions

Install these recommended extensions:

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-docker"
  ]
}
```

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd taskmanagement-fullstack
```

### 2. Run Setup Script

```bash
npm run setup
```

This script will:
- Install all dependencies
- Create environment files
- Build shared packages
- Setup development database
- Configure pre-commit hooks

### 3. Start Development Environment

```bash
# Start all services (recommended)
npm run dev

# Or start services individually
npm run dev:client    # Start only client
npm run dev:server    # Start only server
```

### 4. Access the Application

- **Client**: http://localhost:3000
- **Server**: http://localhost:3001
- **API Docs**: http://localhost:3001/docs
- **Database Studio**: `npm run db:studio`

## Project Structure

```
taskmanagement-fullstack/
├── apps/                           # Applications
│   ├── client/                     # Next.js Frontend
│   │   ├── src/
│   │   │   ├── app/               # App Router pages
│   │   │   ├── components/        # React components
│   │   │   ├── hooks/             # Custom hooks
│   │   │   ├── lib/               # Utilities and configurations
│   │   │   ├── store/             # State management
│   │   │   └── types/             # TypeScript types
│   │   ├── public/                # Static assets
│   │   └── package.json
│   │
│   └── server/                     # Node.js Backend
│       ├── src/
│       │   ├── api/               # tRPC routers
│       │   ├── application/       # Application services
│       │   ├── domain/            # Domain entities and logic
│       │   ├── infrastructure/    # External integrations
│       │   └── presentation/      # Controllers and middleware
│       └── package.json
│
├── packages/                       # Shared Packages
│   ├── shared/                     # Core shared logic
│   │   ├── src/
│   │   │   ├── types/             # Shared TypeScript types
│   │   │   ├── schemas/           # Zod validation schemas
│   │   │   ├── constants/         # Application constants
│   │   │   ├── utils/             # Utility functions
│   │   │   └── errors/            # Error classes
│   │   └── package.json
│   │
│   ├── database/                   # Database package
│   │   ├── src/
│   │   │   ├── client.ts          # Database client
│   │   │   ├── schema/            # Database schema
│   │   │   ├── migrations/        # Database migrations
│   │   │   └── queries/           # Reusable queries
│   │   └── drizzle.config.ts
│   │
│   ├── ui/                         # Shared UI components
│   │   ├── src/
│   │   │   ├── components/        # Reusable components
│   │   │   ├── hooks/             # UI-specific hooks
│   │   │   └── utils/             # UI utilities
│   │   └── tailwind.config.js
│   │
│   └── config/                     # Shared configuration
│       ├── eslint-config/         # ESLint configurations
│       ├── prettier-config/       # Prettier configuration
│       ├── typescript-config/     # TypeScript configurations
│       └── src/                   # Runtime configurations
│
├── scripts/                        # Development scripts
│   ├── dev-setup.js              # Environment setup
│   ├── health-check.js           # Health monitoring
│   ├── file-watcher.js           # File watching
│   └── pre-commit-setup.js       # Git hooks setup
│
├── docs/                          # Documentation
│   ├── ARCHITECTURE.md           # System architecture
│   ├── API.md                    # API documentation
│   └── DEVELOPMENT.md            # This file
│
├── .vscode/                       # VS Code configuration
│   ├── settings.json             # Editor settings
│   ├── launch.json               # Debug configurations
│   └── tasks.json                # Task definitions
│
├── package.json                   # Root package configuration
├── turbo.json                     # Turborepo configuration
├── tsconfig.json                  # Root TypeScript config
├── docker-compose.yml             # Docker services
└── README.md                      # Project overview
```

## Development Environment

### Environment Variables

The development environment uses multiple environment files:

#### Root `.env`
```bash
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskmanagement
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-jwt-secret-change-in-production
```

#### Client `.env.local`
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here
```

#### Server `.env`
```bash
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskmanagement
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-jwt-secret-change-in-production
CORS_ORIGIN=http://localhost:3000
```

### Database Setup

#### Using Docker (Recommended)

```bash
# Start database services
npm run docker:up

# Push database schema
npm run db:push

# Seed database with sample data
npm run db:seed

# Open database studio
npm run db:studio
```

#### Manual Setup

If you prefer to use a local PostgreSQL installation:

1. Create a database named `taskmanagement`
2. Update the `DATABASE_URL` in your environment files
3. Run migrations: `npm run db:migrate`

## Available Scripts

### Root Level Scripts

```bash
# Development
npm run dev                 # Start all development servers
npm run dev:full           # Start with database services
npm run dev:client         # Start only client
npm run dev:server         # Start only server
npm run dev:debug          # Start with verbose logging

# Building
npm run build              # Build all packages
npm run build:packages     # Build only shared packages
npm run build:apps         # Build only applications

# Testing
npm run test               # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage
npm run test:ci            # Run tests for CI

# Code Quality
npm run lint               # Lint all code
npm run lint:fix           # Fix linting issues
npm run format             # Format all code
npm run format:check       # Check code formatting
npm run type-check         # Type check all packages

# Database
npm run db:generate        # Generate database schema
npm run db:migrate         # Run database migrations
npm run db:push            # Push schema to database
npm run db:studio          # Open database studio
npm run db:seed            # Seed database with sample data
npm run db:reset           # Reset and seed database

# Docker
npm run docker:build       # Build Docker images
npm run docker:up          # Start Docker services
npm run docker:down        # Stop Docker services
npm run docker:logs        # View Docker logs
npm run docker:clean       # Clean Docker resources

# Utilities
npm run setup              # Setup development environment
npm run setup:quick        # Quick setup (install + build)
npm run setup:fresh        # Fresh setup (clean + setup)
npm run setup:hooks        # Setup git hooks
npm run health             # Check environment health
npm run clean              # Clean build artifacts
npm run clean:all          # Clean everything and reinstall
```

### Package-Specific Scripts

Each package has its own scripts. Run them with:

```bash
# For client
npm run dev --workspace=@taskmanagement/client

# For server
npm run dev --workspace=@taskmanagement/server

# For shared packages
npm run build --workspace=@taskmanagement/shared
```

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/task-management

# Make your changes
# ... code changes ...

# Run quality checks
npm run lint
npm run type-check
npm run test

# Commit changes (pre-commit hooks will run)
git add .
git commit -m "feat(tasks): add task creation functionality"

# Push changes
git push origin feature/task-management
```

### 2. Code Organization

#### Component Structure

```typescript
// apps/client/src/components/features/tasks/task-card.tsx
import type { Task } from '@taskmanagement/shared';

interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, updates: Partial<Task>) => void;
}

export function TaskCard({ task, onUpdate }: TaskCardProps) {
  // Component implementation
}
```

#### Service Structure

```typescript
// apps/server/src/application/services/task.service.ts
import type { CreateTaskRequest } from '@taskmanagement/shared';

export class TaskApplicationService {
  async createTask(request: CreateTaskRequest): Promise<Task> {
    // Service implementation
  }
}
```

### 3. Type Safety

The project enforces end-to-end type safety:

```typescript
// Shared types
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  // ... other properties
}

// Server usage
const task: Task = await taskService.createTask(request);

// Client usage
const { data: task } = trpc.tasks.getById.useQuery({ id: taskId });
```

## Testing Strategy

### Unit Tests

```typescript
// Example unit test
import { describe, it, expect } from 'vitest';
import { TaskService } from '../task.service';

describe('TaskService', () => {
  it('should create a task', async () => {
    const service = new TaskService();
    const task = await service.createTask({
      title: 'Test Task',
      projectId: 'project-1',
    });
    
    expect(task.title).toBe('Test Task');
  });
});
```

### Integration Tests

```typescript
// Example integration test
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from '../test-utils';

describe('Task API', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  it('should create task via API', async () => {
    const response = await app.request
      .post('/api/trpc/tasks.create')
      .send({ title: 'Test Task' });
    
    expect(response.status).toBe(200);
  });
});
```

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- task.test.ts

# Run tests for specific package
npm run test --workspace=@taskmanagement/server
```

## Code Quality

### ESLint Configuration

The project uses shared ESLint configurations:

- `@taskmanagement/eslint-config` - Base configuration
- `@taskmanagement/eslint-config/react` - React-specific rules
- `@taskmanagement/eslint-config/node` - Node.js-specific rules

### Prettier Configuration

Consistent code formatting with shared Prettier config:

```javascript
// .prettierrc
"@taskmanagement/prettier-config"
```

### Pre-commit Hooks

Automated quality checks before commits:

- Type checking
- Linting
- Formatting
- Testing
- Commit message validation

### Commit Message Format

Follow conventional commit format:

```
type(scope): description

feat(auth): add login functionality
fix(ui): resolve button styling issue
docs: update README
```

## Debugging

### VS Code Debugging

The project includes VS Code debug configurations:

1. **Debug Server**: Debug the Node.js server
2. **Debug Client**: Debug the Next.js client
3. **Debug Full Stack**: Debug both simultaneously
4. **Debug Tests**: Debug test files

### Browser Debugging

#### Client-side Debugging

- Use React Developer Tools
- Use browser DevTools
- Enable source maps for debugging

#### Network Debugging

- Use Network tab in DevTools
- Use tRPC DevTools for API calls
- Monitor WebSocket connections

### Server-side Debugging

```bash
# Start server with debugging
npm run dev:debug --workspace=@taskmanagement/server

# Or use VS Code debug configuration
# Press F5 and select "Debug Server"
```

### Database Debugging

```bash
# Open database studio
npm run db:studio

# View database logs
npm run docker:logs database

# Connect to database directly
psql postgresql://postgres:postgres@localhost:5432/taskmanagement
```

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port
lsof -i :3000  # or :3001

# Kill process
kill -9 <PID>
```

#### Database Connection Issues

```bash
# Check if database is running
npm run docker:logs database

# Restart database
npm run docker:down
npm run docker:up
```

#### Build Failures

```bash
# Clean and rebuild
npm run clean
npm run build

# Or fresh install
npm run setup:fresh
```

#### Type Errors

```bash
# Check TypeScript configuration
npm run type-check

# Restart TypeScript server in VS Code
Ctrl+Shift+P -> "TypeScript: Restart TS Server"
```

### Health Check

Run the health check script to diagnose issues:

```bash
npm run health
```

This will check:
- System requirements
- Dependencies
- Environment files
- Running services
- TypeScript compilation

### Getting Help

1. Check this documentation
2. Review error messages carefully
3. Check the project's issue tracker
4. Ask for help in team channels

## Contributing

### Before Contributing

1. Read the [Architecture Documentation](./ARCHITECTURE.md)
2. Understand the [API Documentation](./API.md)
3. Set up your development environment
4. Run the test suite to ensure everything works

### Contribution Process

1. **Fork the repository** (if external contributor)
2. **Create a feature branch** from `main`
3. **Make your changes** following the coding standards
4. **Write tests** for new functionality
5. **Update documentation** if needed
6. **Run quality checks** (`npm run lint`, `npm run test`)
7. **Submit a pull request** with a clear description

### Code Review Process

1. **Automated checks** must pass (CI/CD pipeline)
2. **Code review** by team members
3. **Testing** in staging environment
4. **Approval** and merge to main branch

### Release Process

1. **Version bump** using changesets
2. **Generate changelog** automatically
3. **Create release** with proper tags
4. **Deploy** to production environment

---

This development guide should help you get started with the project. For more specific information, refer to the individual package README files and the architecture documentation.