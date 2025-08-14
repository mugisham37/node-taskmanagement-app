# Task Management Full-Stack Application

A modern, scalable task management platform built with a monorepo architecture, featuring a Next.js frontend and Node.js backend with Clean Architecture principles.

## 🏗️ Architecture

This project uses a monorepo structure with the following organization:

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
└── tools/               # Development tools and configurations
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 8+
- Docker and Docker Compose (for database services)

### Development Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd taskmanagement-fullstack
   npm install
   ```

2. **Setup environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development services:**
   ```bash
   # Start database and Redis
   docker-compose -f docker-compose.dev.yml up -d
   
   # Start all applications in development mode
   npm run dev
   ```

4. **Access the applications:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Database Admin: http://localhost:8080
   - Redis Admin: http://localhost:8081

## 📦 Package Scripts

### Root Level Commands

- `npm run dev` - Start all applications in development mode
- `npm run build` - Build all packages and applications
- `npm run test` - Run tests across all packages
- `npm run lint` - Lint all packages
- `npm run type-check` - Type check all packages

### Database Commands

- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open database studio
- `npm run db:seed` - Seed database with sample data

### Docker Commands

- `npm run docker:build` - Build Docker images
- `npm run docker:up` - Start all services with Docker
- `npm run docker:down` - Stop all Docker services

## 🛠️ Technology Stack

### Frontend (apps/client)
- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **API Client:** tRPC
- **Real-time:** WebSocket

### Backend (apps/server)
- **Runtime:** Node.js
- **Framework:** Fastify
- **Language:** TypeScript
- **Architecture:** Clean Architecture + DDD + CQRS
- **Database:** PostgreSQL with Drizzle ORM
- **Cache:** Redis
- **Authentication:** JWT + OAuth + WebAuthn
- **Real-time:** WebSocket

### Shared Packages
- **shared:** Common types, utilities, validation schemas
- **database:** Database client, schemas, and queries
- **ui:** Reusable UI components
- **config:** Shared configuration modules

### Development Tools
- **Build System:** Turborepo
- **Package Manager:** npm workspaces
- **Code Quality:** ESLint, Prettier, TypeScript
- **Testing:** Vitest, React Testing Library
- **Containerization:** Docker & Docker Compose

## 🏛️ Architecture Principles

### Clean Architecture
The backend follows Clean Architecture principles with clear separation of concerns:
- **Domain Layer:** Business entities and rules
- **Application Layer:** Use cases and application services
- **Infrastructure Layer:** External concerns (database, cache, etc.)
- **Presentation Layer:** API controllers and WebSocket handlers

### CQRS Pattern
Command Query Responsibility Segregation for scalable data operations:
- **Commands:** Write operations with business logic validation
- **Queries:** Optimized read operations with caching
- **Events:** Domain events for loose coupling

### Type Safety
End-to-end type safety from database to frontend:
- Shared TypeScript types across all packages
- tRPC for type-safe API communication
- Zod schemas for runtime validation
- Drizzle ORM for type-safe database operations

## 🔧 Development Workflow

### Adding New Features

1. **Define types in shared package:**
   ```typescript
   // packages/shared/src/types/feature.ts
   export interface NewFeature {
     id: string;
     name: string;
   }
   ```

2. **Add database schema:**
   ```typescript
   // packages/database/src/schema/feature.ts
   export const features = pgTable('features', {
     id: uuid('id').primaryKey(),
     name: varchar('name', { length: 255 }),
   });
   ```

3. **Implement backend logic:**
   ```typescript
   // apps/server/src/api/features.ts
   export const featuresRouter = router({
     create: protectedProcedure
       .input(createFeatureSchema)
       .mutation(async ({ input, ctx }) => {
         // Implementation
       }),
   });
   ```

4. **Create frontend components:**
   ```typescript
   // apps/client/src/components/features/feature-list.tsx
   export function FeatureList() {
     const { data } = trpc.features.list.useQuery();
     // Component implementation
   }
   ```

### Testing Strategy

- **Unit Tests:** Individual functions and components
- **Integration Tests:** API endpoints and database operations
- **E2E Tests:** Complete user workflows
- **Component Tests:** React components with user interactions

### Code Quality

The project enforces code quality through:
- TypeScript strict mode
- ESLint with custom rules
- Prettier for consistent formatting
- Pre-commit hooks with lint-staged
- Automated testing in CI/CD

## 🚀 Deployment

### Production Deployment

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Deploy with Docker:**
   ```bash
   docker-compose up -d
   ```

### Environment Configuration

Configure different environments using environment variables:
- Development: `.env.development`
- Staging: `.env.staging`
- Production: `.env.production`

## 📚 Documentation

- [Architecture Guide](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/API.md)
- [Development Guide](./docs/DEVELOPMENT.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.