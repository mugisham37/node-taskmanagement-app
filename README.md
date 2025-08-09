# Task Management System

A production-ready task management system built with Clean Architecture principles, CQRS pattern, and Drizzle ORM.

## Architecture

This project follows a 4-layer Clean Architecture:

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
├── infrastructure/          # External concerns
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
└── shared/                  # Common utilities
    ├── errors/              # Error classes
    ├── utils/               # Utility functions
    └── constants/           # Application constants
```

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

3. Run database migrations:

   ```bash
   npm run db:migrate
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run db:generate` - Generate database schema
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Drizzle Studio

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Redis
- **Testing**: Vitest
- **Architecture**: Clean Architecture with CQRS
- **Validation**: Zod

## Project Status

This project has been completely rebuilt from an over-engineered system with 47+ empty directories to a clean, production-ready architecture. All Prisma dependencies have been removed in favor of Drizzle ORM for better type safety and performance.
