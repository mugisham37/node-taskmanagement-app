# Development Guide

This guide covers the development workflow for the Task Management Full-Stack Application.

## Project Structure

```
taskmanagement-fullstack/
├── apps/
│   ├── client/          # Next.js frontend application
│   └── server/          # Node.js backend application
├── packages/
│   ├── shared/          # Shared types, utilities, and business logic
│   ├── database/        # Database schemas and queries
│   ├── ui/              # Shared UI components
│   └── config/          # Shared configuration
├── scripts/             # Development and build scripts
└── docs/                # Documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 8+
- Docker and Docker Compose (for database services)

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd taskmanagement-fullstack
   ```

2. **Run the setup script:**
   ```bash
   npm run setup
   ```

   This will:
   - Install all dependencies
   - Create a `.env` file from `.env.example`
   - Build all packages
   - Set up the development environment

3. **Update environment variables:**
   Edit the `.env` file with your configuration:
   ```bash
   # Database
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/taskmanagement"
   
   # Redis
   REDIS_URL="redis://localhost:6379"
   
   # JWT Secret
   JWT_SECRET="your-super-secret-jwt-key"
   
   # Other configurations...
   ```

4. **Start development services:**
   ```bash
   # Start database and Redis
   npm run docker:up
   
   # Start all applications
   npm run dev
   ```

## Development Workflow

### Package Development

Each package in the `packages/` directory is independently buildable:

```bash
# Build all packages
npm run build

# Build specific package
cd packages/shared
npm run build

# Watch mode for development
cd packages/shared
npm run dev
```

### Application Development

#### Frontend (Next.js)

```bash
cd apps/client
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Lint code
npm run type-check # Type check
```

#### Backend (Node.js)

```bash
cd apps/server
npm run dev        # Start development server with hot reload
npm run build      # Build TypeScript to JavaScript
npm run start      # Start production server
npm run test       # Run tests
npm run lint       # Lint code
```

### Database Operations

```bash
# Generate migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema changes
npm run db:push

# Open database studio
npm run db:studio

# Seed database
npm run db:seed
```

### Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:e2e
```

### Code Quality

```bash
# Lint all packages
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check

# Type check all packages
npm run type-check
```

## Adding New Features

### 1. Define Types (packages/shared)

```typescript
// packages/shared/src/types/feature.ts
export interface NewFeature {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum FeatureStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
```

### 2. Add Validation Schemas (packages/shared)

```typescript
// packages/shared/src/schemas/feature.schemas.ts
import { z } from 'zod';
import { FeatureStatus } from '../types/feature';

export const createFeatureSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.nativeEnum(FeatureStatus).default(FeatureStatus.ACTIVE),
});

export const updateFeatureSchema = createFeatureSchema.partial();
```

### 3. Create Database Schema (packages/database)

```typescript
// packages/database/src/schema/features.ts
import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const features = pgTable('features', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 4. Implement Backend Logic (apps/server)

```typescript
// apps/server/src/api/features.ts
import { router, protectedProcedure } from '../trpc/router';
import { createFeatureSchema, updateFeatureSchema } from '@taskmanagement/shared';

export const featuresRouter = router({
  create: protectedProcedure
    .input(createFeatureSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation using existing application services
      const featureService = ctx.container.resolve('FeatureApplicationService');
      return await featureService.createFeature(input, ctx.user.id);
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      const featureService = ctx.container.resolve('FeatureApplicationService');
      return await featureService.getFeatures(ctx.user.id);
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateFeatureSchema }))
    .mutation(async ({ input, ctx }) => {
      const featureService = ctx.container.resolve('FeatureApplicationService');
      return await featureService.updateFeature(input.id, input.data, ctx.user.id);
    }),
});
```

### 5. Create Frontend Components (apps/client)

```typescript
// apps/client/src/components/features/feature-list.tsx
'use client';

import { trpc } from '@/lib/trpc';
import { FeatureCard } from './feature-card';

export function FeatureList() {
  const { data: features, isLoading } = trpc.features.list.useQuery();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="grid gap-4">
      {features?.map((feature) => (
        <FeatureCard key={feature.id} feature={feature} />
      ))}
    </div>
  );
}
```

## Debugging

### Frontend Debugging

1. **Browser DevTools:** Use React DevTools and browser console
2. **Next.js Debugging:** Enable debug mode in `next.config.js`
3. **tRPC DevTools:** Use tRPC DevTools browser extension

### Backend Debugging

1. **VS Code Debugging:** Use the provided launch configuration
2. **Console Logging:** Use the Winston logger
3. **Database Queries:** Enable query logging in Drizzle

### Full-Stack Debugging

1. **Network Tab:** Monitor API calls and WebSocket connections
2. **Redux DevTools:** Monitor state changes (if using Redux)
3. **Performance Profiling:** Use browser and Node.js profiling tools

## Performance Optimization

### Frontend

- Use Next.js built-in optimizations (Image, Link, etc.)
- Implement code splitting and lazy loading
- Optimize bundle size with webpack-bundle-analyzer
- Use React.memo and useMemo for expensive computations

### Backend

- Implement caching strategies (Redis, in-memory)
- Optimize database queries with proper indexing
- Use connection pooling for database connections
- Implement request batching and deduplication

### Database

- Create proper indexes for frequently queried columns
- Use database query optimization tools
- Implement read replicas for scaling reads
- Monitor query performance with database tools

## Deployment

### Development

```bash
# Start development environment
npm run docker:up
npm run dev
```

### Production

```bash
# Build all packages
npm run build

# Start with Docker Compose
npm run docker:build
npm run docker:up
```

## Troubleshooting

### Common Issues

1. **Port conflicts:** Change ports in environment variables
2. **Database connection:** Ensure PostgreSQL is running
3. **Redis connection:** Ensure Redis is running
4. **Build errors:** Clear node_modules and reinstall
5. **Type errors:** Ensure all packages are built

### Getting Help

1. Check the logs in the terminal
2. Review the error messages carefully
3. Check the documentation for specific packages
4. Search for similar issues in the project repository
5. Ask for help in the development team chat

## Best Practices

### Code Organization

- Keep components small and focused
- Use TypeScript strictly
- Follow the established folder structure
- Write tests for new features

### Git Workflow

- Use conventional commit messages
- Create feature branches for new work
- Write descriptive pull request descriptions
- Ensure all tests pass before merging

### Performance

- Monitor bundle sizes
- Optimize images and assets
- Use proper caching strategies
- Profile performance regularly

### Security

- Never commit secrets to version control
- Use environment variables for configuration
- Validate all inputs
- Follow security best practices