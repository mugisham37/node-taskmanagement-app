# Unified Enterprise Platform - Project Structure Analysis

## Overview

This is a comprehensive TypeScript-based enterprise platform that combines authentication and task management capabilities. The project follows Clean Architecture principles with CQRS (Command Query Responsibility Segregation) pattern, Domain-Driven Design (DDD), and multi-tenant architecture.

## Technology Stack

- **Runtime**: Node.js (>=18.0.0)
- **Language**: TypeScript 5.2.2
- **Web Framework**: Fastify 4.24.3
- **Database**: PostgreSQL with Drizzle ORM 0.30.0
- **Caching**: Redis (ioredis 5.7.0)
- **Testing**: Vitest 1.0.0 with coverage
- **Authentication**: JWT, Argon2, WebAuthn, 2FA
- **Real-time**: WebSocket support
- **Monitoring**: Prometheus metrics, Winston logging
- **Security**: Helmet, CORS, Rate limiting
- **Documentation**: Swagger/OpenAPI
- **Containerization**: Docker with multi-environment support

## Project Structure

### Root Level Configuration Files

```
├── .env                           # Environment variables (local)
├── .env.example                   # Environment template
├── .env.production               # Production environment variables
├── .env.staging                  # Staging environment variables
├── .eslintrc.js                  # ESLint configuration
├── .gitignore                    # Git ignore rules
├── .prettierrc                   # Prettier formatting rules
├── package.json                  # Project dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── drizzle.config.ts            # Database ORM configuration
├── vitest.config.ts             # Testing framework configuration
├── Dockerfile                    # Production Docker image
├── Dockerfile.dev               # Development Docker image
├── docker-compose.yml           # Main Docker Compose
├── docker-compose.dev.yml       # Development Docker Compose
├── docker-compose.production.yml # Production Docker Compose
└── docker-compose.test.yml      # Testing Docker Compose
```

### Git Configuration

```
.git/
├── hooks/                        # Git hooks (samples)
├── info/
│   └── exclude                   # Local git ignore
├── logs/
│   ├── refs/                     # Reference logs
│   └── HEAD                      # HEAD log
├── objects/                      # Git objects (00-ff directories)
├── refs/
│   ├── heads/                    # Branch references
│   ├── remotes/                  # Remote references
│   └── tags/                     # Tag references
├── COMMIT_EDITMSG               # Last commit message
├── config                       # Git configuration
├── description                  # Repository description
├── FETCH_HEAD                   # Last fetch information
├── HEAD                         # Current branch pointer
├── index                        # Staging area
└── ORIG_HEAD                    # Previous HEAD
```

### Husky Git Hooks

```
.husky/
└── _/
    ├── .gitignore               # Husky ignore rules
    └── husky.sh                 # Husky shell script
```

### Kiro Specifications

```
.kiro/
└── specs/
    └── project-finalization/    # Project finalization spec
```

### Configuration Directory

```
config/
├── development.json             # Development configuration
├── production.json              # Production configuration
├── staging.json                 # Staging configuration
├── test.json                    # Test configuration
├── nginx-production.conf        # Nginx production config
├── prometheus-production.yml    # Prometheus monitoring config
└── redis-production.conf        # Redis production config
```

### Build Output

```
dist/
├── app.d.ts                     # App type definitions
├── app.d.ts.map                 # App type definition source map
├── app.js                       # Compiled app
├── app.js.map                   # App source map
├── index.d.ts                   # Index type definitions
├── index.d.ts.map               # Index type definition source map
├── index.js                     # Compiled entry point
├── index.js.map                 # Index source map
├── server.d.ts                  # Server type definitions
├── server.d.ts.map              # Server type definition source map
├── server.js                    # Compiled server
└── server.js.map                # Server source map
```

### Documentation

```
docs/
└── api-documentation.md         # API documentation
```

### Scripts Directory

```
scripts/
├── check-setup.ts               # Setup verification
├── deploy.sh                    # Deployment script
├── dev-setup.ts                 # Development setup
├── generate-docs.ts             # Documentation generation
├── health-check.js              # Health check script
├── init-extensions.sql          # Database extensions initialization
├── init-test-db.sql             # Test database initialization
├── migrate.ts                   # Database migration runner
├── migration-cli.ts             # Migration CLI tool
├── phase1-summary.md            # Phase 1 project summary
├── reset.ts                     # Database reset
├── run-tests.ts                 # Test runner
├── security-audit.ts            # Security audit
├── seed.ts                      # Database seeding
├── setup-database.ts            # Database setup
├── setup-environment.ts         # Environment setup
├── system-validation.ts         # System validation
├── test-db.ts                   # Test database utilities
├── validate-configuration.ts    # Configuration validation
└── verify-setup.ts              # Setup verification
```

## Source Code Structure (src/)

### Main Entry Points

```
src/
├── index.ts                     # Application entry point
├── app.ts                       # Application setup
└── server.ts                    # Server configuration
```

### Application Layer (CQRS & Use Cases)

```
src/application/
├── index.ts                     # Application layer exports
├── commands/                    # Command definitions
│   ├── index.ts
│   ├── base-command.ts          # Base command interface
│   ├── project-commands.ts      # Project-related commands
│   ├── task-commands.ts         # Task-related commands
│   ├── user-commands.ts         # User-related commands
│   └── workspace-commands.ts    # Workspace-related commands
├── cqrs/                        # CQRS infrastructure
│   ├── index.ts
│   ├── command-bus.ts           # Command bus implementation
│   ├── command.ts               # Command interface
│   ├── cqrs-factory.ts          # CQRS factory
│   ├── query-bus.ts             # Query bus implementation
│   ├── query.ts                 # Query interface
│   └── validation/              # CQRS validation
│       ├── command-validator.ts # Command validation
│       └── query-validator.ts   # Query validation
├── events/                      # Event handling
│   ├── index.ts
│   ├── application-event-handlers.ts # Application event handlers
│   ├── domain-event-bus.ts      # Domain event bus
│   ├── event-bus.ts             # Event bus implementation
│   ├── event-handler-lifecycle-manager.ts # Event handler lifecycle
│   └── event-handler-registry.ts # Event handler registry
├── handlers/                    # Command & Query handlers
│   ├── index.ts
│   ├── base-handler.ts          # Base handler
│   ├── audit-log-command-handlers.ts # Audit log handlers
│   ├── calendar-command-handlers.ts # Calendar handlers
│   ├── notification-command-handlers.ts # Notification command handlers
│   ├── notification-query-handlers.ts # Notification query handlers
│   ├── project-command-handlers.ts # Project command handlers
│   ├── project-query-handlers.ts # Project query handlers
│   ├── task-command-handlers.ts # Task command handlers
│   ├── task-query-handlers.ts   # Task query handlers
│   ├── user-command-handlers.ts # User command handlers
│   ├── user-query-handlers.ts   # User query handlers
│   ├── webhook-command-handlers.ts # Webhook command handlers
│   ├── webhook-query-handlers.ts # Webhook query handlers
│   ├── workspace-command-handlers.ts # Workspace command handlers
│   └── workspace-query-handlers.ts # Workspace query handlers
├── queries/                     # Query definitions
│   ├── index.ts
│   ├── base-query.ts            # Base query interface
│   ├── project-queries.ts       # Project queries
│   ├── task-queries.ts          # Task queries
│   ├── user-queries.ts          # User queries
│   └── workspace-queries.ts     # Workspace queries
├── services/                    # Application services
│   ├── index.ts
│   ├── base-application-service.ts # Base application service
│   ├── auth-application-service.ts # Authentication service
│   ├── calendar-application-service.ts # Calendar service
│   ├── notification-application-service.ts # Notification service
│   ├── project-application-service.ts # Project service
│   ├── task-application-service.ts # Task service
│   ├── webhook-application-service.ts # Webhook service
│   └── workspace-application-service.ts # Workspace service
└── use-cases/                   # Use case implementations
    ├── index.ts
    └── task-use-cases.ts        # Task use cases
```

### Domain Layer (Business Logic)

```
src/domain/
├── index.ts                     # Domain layer exports
├── aggregates/                  # Domain aggregates
│   ├── .gitkeep
│   ├── index.ts
│   ├── aggregate-root.ts        # Base aggregate root
│   ├── enhanced-aggregate-root.ts # Enhanced aggregate root
│   ├── notification-aggregate.ts # Notification aggregate
│   ├── project-aggregate.ts     # Project aggregate
│   ├── task-aggregate.ts        # Task aggregate
│   ├── webhook-aggregate.ts     # Webhook aggregate
│   └── workspace-aggregate.ts   # Workspace aggregate
├── entities/                    # Domain entities
│   ├── .gitkeep
│   ├── index.ts
│   ├── base-entity.ts           # Base entity
│   ├── account.ts               # Account entity
│   ├── activity-tracking.ts     # Activity tracking entity
│   ├── audit-log.ts             # Audit log entity
│   ├── calendar-event.ts        # Calendar event entity
│   ├── device.ts                # Device entity
│   ├── file-attachment.ts       # File attachment entity
│   ├── metrics.ts               # Metrics entity
│   ├── notification.ts          # Notification entity
│   ├── project.ts               # Project entity
│   ├── task.ts                  # Task entity
│   ├── user.ts                  # User entity
│   ├── webhook.ts               # Webhook entity
│   └── workspace.ts             # Workspace entity
├── events/                      # Domain events
│   ├── .gitkeep
│   ├── index.ts
│   ├── domain-event.ts          # Base domain event
│   ├── domain-event-publisher.ts # Domain event publisher
│   ├── audit-events.ts          # Audit events
│   ├── calendar-events.ts       # Calendar events
│   ├── notification-events.ts   # Notification events
│   ├── project-events.ts        # Project events
│   ├── task-events.ts           # Task events
│   ├── user-events.ts           # User events
│   ├── webhook-events.ts        # Webhook events
│   └── workspace-events.ts      # Workspace events
├── repositories/                # Repository interfaces
│   ├── .gitkeep
│   ├── index.ts
│   ├── account-repository.ts    # Account repository interface
│   ├── activity-tracking-repository.ts # Activity tracking repository
│   ├── audit-log-repository.ts  # Audit log repository interface
│   ├── calendar-event-repository.ts # Calendar event repository
│   ├── device-repository.ts     # Device repository interface
│   ├── file-attachment-repository.ts # File attachment repository
│   ├── metrics-repository.ts    # Metrics repository interface
│   ├── notification-repository.ts # Notification repository interface
│   ├── project-repository.ts    # Project repository interface
│   ├── task-repository.ts       # Task repository interface
│   ├── user-repository.ts       # User repository interface
│   ├── webhook-repository.ts    # Webhook repository interface
│   └── workspace-repository.ts  # Workspace repository interface
├── services/                    # Domain services
│   ├── .gitkeep
│   ├── index.ts
│   ├── audit-domain-service.ts  # Audit domain service
│   ├── calendar-domain-service.ts # Calendar domain service
│   ├── notification-domain-service.ts # Notification domain service
│   ├── project-domain-service.ts # Project domain service
│   ├── task-domain-service.ts   # Task domain service
│   ├── webhook-domain-service.ts # Webhook domain service
│   └── workspace-domain-service.ts # Workspace domain service
├── specifications/              # Domain specifications
│   ├── .gitkeep
│   ├── index.ts
│   ├── calendar-specifications.ts # Calendar specifications
│   ├── notification-specifications.ts # Notification specifications
│   ├── project-specifications.ts # Project specifications
│   ├── task-specifications.ts   # Task specifications
│   ├── webhook-specifications.ts # Webhook specifications
│   └── workspace-specifications.ts # Workspace specifications
└── value-objects/               # Value objects
    ├── .gitkeep
    ├── index.ts
    ├── value-object.ts          # Base value object
    ├── account-id.ts            # Account ID value object
    ├── device-id.ts             # Device ID value object
    ├── email.ts                 # Email value object
    ├── notification-id.ts       # Notification ID value object
    ├── priority.ts              # Priority value object
    ├── project-id.ts            # Project ID value object
    ├── project-role.ts          # Project role value object
    ├── project-status.ts        # Project status value object
    ├── task-id.ts               # Task ID value object
    ├── task-status.ts           # Task status value object
    ├── user-id.ts               # User ID value object
    ├── user-status.ts           # User status value object
    └── workspace-id.ts          # Workspace ID value object
```

### Infrastructure Layer (External Concerns)

```
src/infrastructure/
├── index.ts                     # Infrastructure layer exports
├── performance-optimization-service.ts # Performance optimization
├── caching/                     # Caching infrastructure
│   ├── .gitkeep
│   ├── index.ts
│   ├── cache-keys.ts            # Cache key definitions
│   ├── cache-service.ts         # Cache service implementation
│   ├── cache-warmer.ts          # Cache warming service
│   ├── performance-cache-strategies.ts # Cache strategies
│   └── redis-client.ts          # Redis client configuration
├── database/                    # Database infrastructure
│   ├── .gitkeep
│   ├── index.ts
│   ├── config.ts                # Database configuration
│   ├── connection.ts            # Database connection
│   ├── health-check.ts          # Database health check
│   ├── automated-backup-service.ts # Automated backup service
│   ├── backup-recovery.ts       # Backup and recovery
│   ├── disaster-recovery.ts     # Disaster recovery
│   ├── drizzle-query-optimizer.ts # Query optimizer
│   ├── drizzle-transaction-manager.ts # Transaction manager
│   ├── performance-optimizer.ts # Performance optimizer
│   ├── point-in-time-recovery.ts # Point-in-time recovery
│   ├── query-optimizer.ts       # Query optimization
│   ├── transaction-integration-service.ts # Transaction integration
│   ├── transaction-manager.ts   # Transaction management
│   ├── unit-of-work.ts          # Unit of work pattern
│   ├── backup-recovery/         # Backup recovery services
│   │   └── index.ts
│   ├── migrations/              # Database migrations
│   │   ├── meta/                # Migration metadata
│   │   ├── 0000_cheerful_natasha_romanoff.sql # Initial migration
│   │   └── migrate.ts           # Migration runner
│   ├── repositories/            # Repository implementations
│   │   ├── index.ts
│   │   ├── base-drizzle-repository.ts # Base repository
│   │   ├── audit-log-repository.ts # Audit log repository
│   │   ├── calendar-event-repository.ts # Calendar event repository
│   │   ├── file-attachment-repository.ts # File attachment repository
│   │   ├── notification-repository.ts # Notification repository
│   │   ├── project-repository.ts # Project repository
│   │   ├── task-repository.ts   # Task repository
│   │   ├── user-repository.ts   # User repository
│   │   ├── webhook-repository.ts # Webhook repository
│   │   └── workspace-repository.ts # Workspace repository
│   ├── schema/                  # Database schema definitions
│   │   ├── index.ts
│   │   ├── audit-logs.ts        # Audit logs schema
│   │   ├── calendar-events.ts   # Calendar events schema
│   │   ├── file-attachments.ts  # File attachments schema
│   │   ├── notifications.ts     # Notifications schema
│   │   ├── project-members.ts   # Project members schema
│   │   ├── projects.ts          # Projects schema
│   │   ├── task-dependencies.ts # Task dependencies schema
│   │   ├── tasks.ts             # Tasks schema
│   │   ├── users.ts             # Users schema
│   │   ├── webhooks.ts          # Webhooks schema
│   │   └── workspaces.ts        # Workspaces schema
│   └── seeds/                   # Database seeders
│       ├── index.ts
│       ├── audit-log-seeder.ts  # Audit log seeder
│       ├── calendar-event-seeder.ts # Calendar event seeder
│       ├── file-attachment-seeder.ts # File attachment seeder
│       ├── notification-seeder.ts # Notification seeder
│       ├── project-seeder.ts    # Project seeder
│       ├── task-seeder.ts       # Task seeder
│       ├── user-seeder.ts       # User seeder
│       ├── webhook-seeder.ts    # Webhook seeder
│       └── workspace-seeder.ts  # Workspace seeder
├── events/                      # Event infrastructure
│   └── event-integration-service.ts # Event integration
├── external-services/           # External service integrations
│   ├── .gitkeep
│   ├── index.ts
│   ├── circuit-breaker.ts       # Circuit breaker pattern
│   ├── collaboration-service.ts # Collaboration service
│   ├── email-service.ts         # Email service
│   ├── realtime-dashboard-service.ts # Real-time dashboard
│   ├── realtime-event-service.ts # Real-time events
│   └── websocket-service.ts     # WebSocket service
├── jobs/                        # Background job processing
│   ├── index.ts
│   ├── README.md                # Job system documentation
│   ├── job-factory.ts           # Job factory
│   ├── job-integration.ts       # Job integration
│   ├── job-manager.ts           # Job manager
│   ├── job-monitoring.ts        # Job monitoring
│   ├── job-processor.ts         # Job processor
│   ├── job-queue.ts             # Job queue
│   ├── job-registry.ts          # Job registry
│   ├── job-scheduler.ts         # Job scheduler
│   ├── job-service.ts           # Job service
│   ├── job-types.ts             # Job type definitions
│   ├── calendar-reminder-job.ts # Calendar reminder job
│   ├── notification-job.ts      # Notification job
│   ├── recurring-task-job.ts    # Recurring task job
│   └── webhook-delivery-job.ts  # Webhook delivery job
├── migration/                   # Data migration system
│   ├── README.md                # Migration documentation
│   ├── migration-routes.ts      # Migration routes
│   ├── migration-service-registration.ts # Service registration
│   ├── migration.controller.ts  # Migration controller
│   ├── migration.module.ts      # Migration module
│   ├── cli/                     # Migration CLI
│   │   └── migration.cli.ts     # CLI implementation
│   ├── services/                # Migration services
│   │   ├── backup.service.ts    # Backup service
│   │   ├── current-system-mapper.service.ts # System mapper
│   │   ├── error-recovery.service.ts # Error recovery
│   │   ├── file-analysis.service.ts # File analysis
│   │   ├── migration-tracker.service.ts # Migration tracker
│   │   └── verification.service.ts # Verification service
│   └── types/                   # Migration types
│       └── migration.types.ts   # Type definitions
├── monitoring/                  # Monitoring and observability
│   ├── index.ts
│   ├── alerting-service.ts      # Alerting service
│   ├── api-performance-monitor.ts # API performance monitoring
│   ├── comprehensive-monitoring.ts # Comprehensive monitoring
│   ├── correlation-id-service.ts # Correlation ID service
│   ├── distributed-tracing-service.ts # Distributed tracing
│   ├── enhanced-monitoring-service.ts # Enhanced monitoring
│   ├── error-tracking.ts        # Error tracking
│   ├── health-service.ts        # Health service
│   ├── logging-service.ts       # Logging service
│   └── metrics-service.ts       # Metrics service
├── performance/                 # Performance optimization
│   ├── index.ts
│   ├── api-optimization.ts      # API optimization
│   ├── request-batching.ts      # Request batching
│   └── response-compression.ts  # Response compression
└── security/                    # Security infrastructure
    ├── .gitkeep
    ├── index.ts
    ├── audit-logger.ts          # Audit logging
    ├── auth-middleware.ts       # Authentication middleware
    ├── comprehensive-security-middleware.ts # Security middleware
    ├── input-sanitizer.ts       # Input sanitization
    ├── jwt-service.ts           # JWT service
    ├── oauth-service.ts         # OAuth service
    ├── password-service.ts      # Password service
    ├── rate-limit-service.ts    # Rate limiting service
    ├── rbac-service.ts          # Role-based access control
    ├── session-manager.ts       # Session management
    └── two-factor-auth-service.ts # Two-factor authentication
```

### Presentation Layer (API & Controllers)

```
src/presentation/
├── index.ts                     # Presentation layer exports
├── server-setup.ts              # Server setup
├── setup-phase7-api.ts          # Phase 7 API setup
├── controllers/                 # API controllers
│   ├── .gitkeep
│   ├── index.ts
│   ├── base-controller.ts       # Base controller
│   ├── analytics-controller.ts  # Analytics controller
│   ├── auth-controller.ts       # Authentication controller
│   ├── calendar-controller.ts   # Calendar controller
│   ├── collaboration-controller.ts # Collaboration controller
│   ├── file-management-controller.ts # File management controller
│   ├── monitoring-controller.ts # Monitoring controller
│   ├── notification-controller.ts # Notification controller
│   ├── project-controller.ts    # Project controller
│   ├── search-controller.ts     # Search controller
│   ├── task-controller.ts       # Task controller
│   ├── user-controller.ts       # User controller
│   ├── webhook-controller.ts    # Webhook controller
│   └── workspace-controller.ts  # Workspace controller
├── documentation/               # API documentation
│   ├── api-documentation-generator.ts # Documentation generator
│   └── setup-api-docs.ts        # Documentation setup
├── dto/                         # Data Transfer Objects
│   ├── .gitkeep
│   ├── index.ts
│   ├── base-dto.ts              # Base DTO
│   ├── error-dto.ts             # Error DTO
│   ├── analytics-dto.ts         # Analytics DTO
│   ├── notification-dto.ts      # Notification DTO
│   ├── project-dto.ts           # Project DTO
│   ├── task-dto.ts              # Task DTO
│   ├── user-dto.ts              # User DTO
│   ├── webhook-dto.ts           # Webhook DTO
│   └── workspace-dto.ts         # Workspace DTO
├── middleware/                  # HTTP middleware
│   ├── .gitkeep
│   ├── index.ts
│   ├── setup.ts                 # Middleware setup
│   ├── auth-middleware.ts       # Authentication middleware
│   ├── comprehensive-security-middleware.ts # Security middleware
│   ├── comprehensive-validation-middleware.ts # Validation middleware
│   ├── cors-middleware.ts       # CORS middleware
│   ├── error-handler-middleware.ts # Error handling middleware
│   ├── rate-limit-middleware.ts # Rate limiting middleware
│   ├── security-middleware.ts   # Security middleware
│   ├── standardized-response-middleware.ts # Response middleware
│   └── validation-middleware.ts # Validation middleware
├── routes/                      # API routes
│   ├── .gitkeep
│   ├── index.ts
│   ├── analytics-routes.ts      # Analytics routes
│   ├── auth-routes.ts           # Authentication routes
│   ├── bulk-operations-routes.ts # Bulk operations routes
│   ├── calendar-routes.ts       # Calendar routes
│   ├── collaboration-routes.ts  # Collaboration routes
│   ├── file-management-routes.ts # File management routes
│   ├── health-routes.ts         # Health check routes
│   ├── monitoring-routes.ts     # Monitoring routes
│   ├── notification-routes.ts   # Notification routes
│   ├── project-routes.ts        # Project routes
│   ├── search-routes.ts         # Search routes
│   ├── task-routes.ts           # Task routes
│   ├── user-routes.ts           # User routes
│   ├── webhook-routes.ts        # Webhook routes
│   └── workspace-routes.ts      # Workspace routes
└── websocket/                   # WebSocket handling
    ├── .gitkeep
    ├── index.ts
    ├── setup.ts                 # WebSocket setup
    ├── websocket-gateway.ts     # WebSocket gateway
    ├── websocket-handler.ts     # WebSocket handler
    └── websocket-routes.ts      # WebSocket routes
```

### Shared Layer (Common Utilities)

```
src/shared/
├── index.ts                     # Shared layer exports
├── config/                      # Configuration management
│   ├── index.ts
│   └── app-config.ts            # Application configuration
├── constants/                   # Application constants
│   ├── .gitkeep
│   ├── index.ts
│   ├── application-constants.ts # Application constants
│   ├── error-constants.ts       # Error constants
│   ├── project-constants.ts     # Project constants
│   ├── task-constants.ts        # Task constants
│   ├── user-constants.ts        # User constants
│   └── workspace-constants.ts   # Workspace constants
├── container/                   # Dependency injection
│   ├── index.ts
│   ├── types.ts                 # Container types
│   ├── container.ts             # DI container
│   ├── container-initialization-service.ts # Container initialization
│   ├── dependency-validation-service.ts # Dependency validation
│   ├── health-checker.ts        # Health checker
│   ├── service-descriptor.ts    # Service descriptor
│   ├── service-factory.ts       # Service factory
│   └── service-registration.ts  # Service registration
├── decorators/                  # Decorators
│   ├── index.ts
│   ├── logging.decorator.ts     # Logging decorator
│   └── validation.decorator.ts  # Validation decorator
├── documentation/               # Documentation utilities
│   ├── api-documentation-generator.ts # API doc generator
│   ├── documentation-integration.ts # Documentation integration
│   └── openapi-generator.ts     # OpenAPI generator
├── enums/                       # Enumerations
│   ├── index.ts
│   └── common.enums.ts          # Common enumerations
├── errors/                      # Error handling
│   ├── .gitkeep
│   ├── index.ts
│   ├── app-error.ts             # Application error
│   ├── authorization-error.ts   # Authorization error
│   ├── domain-error.ts          # Domain error
│   ├── infrastructure-error.ts  # Infrastructure error
│   ├── not-found-error.ts       # Not found error
│   └── validation-error.ts      # Validation error
├── guards/                      # Guards
│   ├── index.ts
│   └── validation.guards.ts     # Validation guards
├── localization/                # Internationalization
│   ├── index.ts
│   ├── i18n-manager.ts          # I18n manager
│   ├── translation-loader.ts    # Translation loader
│   └── locales/                 # Locale files
│       ├── de/                  # German translations
│       ├── en/                  # English translations
│       ├── es/                  # Spanish translations
│       ├── fr/                  # French translations
│       └── zh/                  # Chinese translations
├── types/                       # Type definitions
│   ├── index.ts
│   ├── common.types.ts          # Common types
│   ├── event.interface.ts       # Event interface
│   ├── logger.interface.ts      # Logger interface
│   └── validator.interface.ts   # Validator interface
└── utils/                       # Utility functions
    ├── .gitkeep
    ├── index.ts
    ├── api-features.ts          # API features
    ├── app-error.ts             # Application error utilities
    ├── async-handler.ts         # Async handler
    ├── cache.ts                 # Cache utilities
    ├── date-utils.ts            # Date utilities
    ├── id-generator.ts          # ID generation
    ├── performance-monitor.ts   # Performance monitoring
    ├── response-formatter.ts    # Response formatting
    ├── validation-utils.ts      # Validation utilities
    └── __tests__/               # Utility tests
        └── id-generator.test.ts # ID generator tests
```

## Testing Structure

```
tests/
├── README.md                    # Testing documentation
├── setup.ts                     # Test setup
├── config/                      # Test configuration
│   ├── test-config.ts           # Test configuration
│   └── vitest-setup.ts          # Vitest setup
├── helpers/                     # Test helpers
│   ├── api-helpers.ts           # API test helpers
│   ├── database-helpers.ts      # Database test helpers
│   ├── mock-helpers.ts          # Mock helpers
│   └── test-helpers.ts          # General test helpers
├── e2e/                         # End-to-end tests
│   ├── api/                     # API E2E tests
│   │   └── task-api.test.ts     # Task API E2E tests
│   ├── performance/             # Performance tests
│   │   └── api-performance.test.ts # API performance tests
│   └── security/                # Security tests
│       └── security.test.ts     # Security tests
├── integration/                 # Integration tests
│   └── database/                # Database integration tests
│       └── task-repository-integration.test.ts # Task repository tests
└── unit/                        # Unit tests
    ├── application/             # Application layer tests
    │   └── services/            # Service tests
    ├── domain/                  # Domain layer tests
    │   ├── entities/            # Entity tests
    │   └── services/            # Domain service tests
    └── infrastructure/          # Infrastructure layer tests
        └── database/            # Database tests
```

## Key Features & Capabilities

### Architecture Patterns

- **Clean Architecture**: Separation of concerns with distinct layers
- **CQRS**: Command Query Responsibility Segregation
- **Domain-Driven Design**: Rich domain models and aggregates
- **Event-Driven Architecture**: Domain events and event handlers
- **Repository Pattern**: Data access abstraction
- **Unit of Work**: Transaction management
- **Dependency Injection**: IoC container for service management

### Security Features

- **Authentication**: JWT, OAuth, WebAuthn support
- **Authorization**: Role-based access control (RBAC)
- **Password Security**: Argon2 hashing
- **Two-Factor Authentication**: TOTP support
- **Input Sanitization**: XSS protection
- **Rate Limiting**: API protection
- **Audit Logging**: Security event tracking
- **Session Management**: Secure session handling

### Performance & Scalability

- **Caching**: Redis-based caching strategies
- **Database Optimization**: Query optimization and indexing
- **Request Batching**: Efficient API request handling
- **Response Compression**: Bandwidth optimization
- **Connection Pooling**: Database connection management
- **Performance Monitoring**: Real-time performance tracking

### Monitoring & Observability

- **Metrics**: Prometheus metrics collection
- **Logging**: Structured logging with Winston
- **Health Checks**: Application health monitoring
- **Error Tracking**: Comprehensive error handling
- **Distributed Tracing**: Request tracing across services
- **Alerting**: Automated alert system

### Development & Operations

- **Multi-Environment**: Development, staging, production configs
- **Docker Support**: Containerized deployment
- **Database Migrations**: Automated schema management
- **Testing**: Comprehensive test suite (unit, integration, e2e)
- **Code Quality**: ESLint, Prettier, TypeScript strict mode
- **Git Hooks**: Pre-commit validation with Husky
- **API Documentation**: Swagger/OpenAPI integration

### Business Features

- **Multi-Tenant**: Workspace-based organization
- **Project Management**: Project creation and management
- **Task Management**: Task lifecycle management
- **User Management**: User registration and profile management
- **Notifications**: Real-time notification system
- **Calendar Integration**: Calendar event management
- **File Attachments**: File upload and management
- **Webhooks**: External system integration
- **Real-time Updates**: WebSocket-based real-time features
- **Collaboration**: Team collaboration features
- **Analytics**: Usage analytics and reporting
- **Search**: Full-text search capabilities
- **Bulk Operations**: Batch processing support

This project represents a comprehensive enterprise-grade platform with modern architecture patterns, extensive security measures, and robust operational capabilities.
