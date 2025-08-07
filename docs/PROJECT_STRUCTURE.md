# Project Structure

This document outlines the directory structure and organization of the Unified Enterprise Platform.

## Root Directory

```
unified-enterprise-platform/
├── .husky/                    # Git hooks configuration
├── .kiro/                     # Kiro IDE configuration
├── docs/                      # Project documentation
├── node_modules/              # Dependencies (auto-generated)
├── prisma/                    # Database schema and migrations
├── scripts/                   # Utility scripts
├── src/                       # Source code
├── tests/                     # Test files
├── .env.example              # Environment variables template
├── .eslintrc.js              # ESLint configuration
├── .gitignore                # Git ignore rules
├── .prettierrc               # Prettier configuration
├── docker-compose.yml        # Docker services configuration
├── Dockerfile.dev            # Development Docker image
├── package.json              # Project dependencies and scripts
├── README.md                 # Project overview
├── tsconfig.json             # TypeScript configuration
└── vitest.config.ts          # Test configuration
```

## Source Code Structure (`src/`)

### Application Layer (`src/application/`)

Orchestrates business operations and use cases.

```
application/
├── events/                   # Application-level events
├── factories/                # Object creation factories
├── interfaces/               # Application service interfaces
├── services/                 # Application services
└── use-cases/                # Business use cases
```

### Domain Layer (`src/domain/`)

Contains business logic and domain models.

```
domain/
├── analytics/                # Analytics domain
│   ├── entities/            # Analytics entities
│   ├── repositories/        # Analytics repository interfaces
│   ├── services/            # Analytics domain services
│   └── value-objects/       # Analytics value objects
├── audit/                   # Audit and compliance domain
├── authentication/          # User authentication domain
├── calendar/                # Calendar and scheduling domain
├── collaboration/           # Real-time collaboration domain
├── file-management/         # File storage and management domain
├── integration/             # External integrations domain
├── notification/            # Notification system domain
└── task-management/         # Task and project management domain
```

### Infrastructure Layer (`src/infrastructure/`)

Handles external concerns and technical implementations.

```
infrastructure/
├── cache/                   # Caching implementations (Redis)
├── config/                  # Configuration management
├── database/                # Database implementations (Prisma)
├── email/                   # Email service implementations
├── logging/                 # Logging implementations (Winston)
├── monitoring/              # Monitoring and metrics (Prometheus)
├── security/                # Security implementations
├── server/                  # Server implementations (Fastify)
├── storage/                 # File storage implementations
└── websocket/               # WebSocket implementations
```

### Presentation Layer (`src/presentation/`)

Handles HTTP requests and responses.

```
presentation/
├── controllers/             # HTTP request controllers
├── middleware/              # HTTP middleware
├── routes/                  # Route definitions
├── schemas/                 # Request/response validation schemas
└── websocket/               # WebSocket handlers
```

### Shared Kernel (`src/shared/`)

Common utilities and types used across domains.

```
shared/
├── constants/               # Application constants
├── errors/                  # Error definitions and handling
├── events/                  # Domain event definitions
├── types/                   # Shared TypeScript types
└── utils/                   # Utility functions
```

### Legacy Directories (To be refactored)

These directories contain existing code that will be gradually migrated to the DDD structure:

```
src/
├── config/                  # Legacy configuration (to be moved to infrastructure/config)
├── controllers/             # Legacy controllers (to be moved to presentation/controllers)
├── db/                      # Legacy database code (to be moved to infrastructure/database)
├── jobs/                    # Background jobs (to be moved to infrastructure/jobs)
├── middleware/              # Legacy middleware (to be moved to presentation/middleware)
├── routes/                  # Legacy routes (to be moved to presentation/routes)
├── services/                # Legacy services (to be moved to application/services)
├── types/                   # Legacy types (to be moved to shared/types)
├── utils/                   # Legacy utilities (to be moved to shared/utils)
└── validators/              # Legacy validators (to be replaced with Zod schemas)
```

## Test Structure (`tests/`)

```
tests/
├── e2e/                     # End-to-end tests
├── fixtures/                # Test data fixtures
├── integration/             # Integration tests
├── mocks/                   # Mock implementations
├── unit/                    # Unit tests
│   ├── application/         # Application layer tests
│   ├── domain/              # Domain layer tests
│   ├── infrastructure/      # Infrastructure layer tests
│   └── presentation/        # Presentation layer tests
└── setup.ts                 # Global test setup
```

## Scripts Directory (`scripts/`)

```
scripts/
├── check-setup.ts           # Project setup verification
├── dev-setup.ts             # Development environment setup
├── init-test-db.sql         # Test database initialization
└── [other utility scripts]
```

## Documentation (`docs/`)

```
docs/
├── ARCHITECTURE.md          # System architecture overview
├── PROJECT_STRUCTURE.md     # This file
└── [other documentation]
```

## Configuration Files

- **`.env.example`**: Template for environment variables
- **`.eslintrc.js`**: ESLint configuration for code quality
- **`.prettierrc`**: Code formatting configuration
- **`tsconfig.json`**: TypeScript compiler configuration
- **`vitest.config.ts`**: Test runner configuration
- **`docker-compose.yml`**: Local development services
- **`package.json`**: Project metadata and dependencies

## Key Design Principles

1. **Domain-Driven Design**: Clear separation of business logic from technical concerns
2. **Clean Architecture**: Dependencies point inward toward the domain
3. **SOLID Principles**: Single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion
4. **Test-Driven Development**: Comprehensive test coverage at all layers
5. **Configuration Management**: Environment-based configuration with validation
6. **Security First**: Security considerations at every layer
7. **Performance**: Caching, connection pooling, and optimization strategies
8. **Observability**: Logging, monitoring, and tracing throughout the system

## Migration Strategy

The project is currently in transition from a traditional layered architecture to Domain-Driven Design. The migration follows these phases:

1. **Foundation Setup** (Current): Establish DDD structure and tooling
2. **Domain Migration**: Move business logic to domain layer
3. **Service Migration**: Refactor services to application layer
4. **Infrastructure Migration**: Move technical concerns to infrastructure layer
5. **Presentation Migration**: Standardize API layer
6. **Legacy Cleanup**: Remove old structure and unused code

This structure supports the enterprise requirements while maintaining clean separation of concerns and enabling future scalability.
