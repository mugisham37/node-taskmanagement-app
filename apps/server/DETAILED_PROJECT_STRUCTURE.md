# Node Task Management App - Complete Project Structure

This document provides a comprehensive file-level structure of the entire Node.js Task Management Application project.

## Project Overview

This is a sophisticated enterprise-level task management system built with Node.js, TypeScript, and follows Domain-Driven Design (DDD) and Clean Architecture principles. The project includes comprehensive features for task management, user authentication, real-time updates, monitoring, and more.

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Redis
- **Testing**: Vitest
- **Architecture**: Clean Architecture, DDD, CQRS
- **Authentication**: JWT, OAuth, WebAuthn, Two-Factor Authentication
- **Real-time**: WebSocket integration
- **Monitoring**: Prometheus, comprehensive logging and metrics
- **Documentation**: OpenAPI/Swagger
- **Deployment**: Docker with multi-environment support

## Complete Project Structure

```
node-taskmanagement-app/
├── .env                                      # Environment variables
├── .env.example                              # Environment variables template
├── .env.production                           # Production environment variables
├── .eslintrc.js                             # ESLint configuration
├── .gitignore                               # Git ignore rules
├── .prettierrc                              # Prettier configuration
├── constants-integration-final-status.md    # Integration status documentation
├── constants-integration-report.md          # Integration report
├── docker-compose.dev.yml                   # Development Docker Compose
├── docker-compose.production.yml            # Production Docker Compose
├── docker-compose.test.yml                  # Test Docker Compose
├── docker-compose.yml                       # Main Docker Compose
├── Dockerfile                               # Production Dockerfile
├── Dockerfile.dev                           # Development Dockerfile
├── drizzle.config.ts                        # Drizzle ORM configuration
├── package.json                             # NPM package configuration
├── package-lock.json                        # NPM dependency lock file
├── project-structure-analysis.md            # Project structure analysis
├── tsconfig.json                            # TypeScript configuration
├── vitest.config.ts                         # Vitest testing configuration
│
├── .kiro/                                   # Kiro specifications
│   └── specs/
│       ├── project-finalization/
│       │   ├── design.md
│       │   ├── requirements.md
│       │   └── tasks.md
│       └── typescript-error-resolution/
│           ├── design.md
│           ├── requirements.md
│           └── tasks.md
│
├── config/                                  # Configuration files
│   ├── development.json                     # Development configuration
│   ├── nginx-production.conf                # Nginx production configuration
│   ├── production.json                      # Production configuration
│   ├── prometheus-production.yml            # Prometheus production configuration
│   ├── redis-production.conf                # Redis production configuration
│   ├── staging.json                         # Staging configuration
│   └── test.json                           # Test configuration
│
├── docs/                                    # Documentation
│   ├── api-documentation.md                 # API documentation
│   ├── config-integration-analysis.md       # Configuration integration analysis
│   ├── infrastructure-integration-fixes.md  # Infrastructure integration fixes
│   └── typescript-errors-resolution.md      # TypeScript errors resolution
│
├── scripts/                                 # Utility scripts
│   ├── check-setup.ts                       # Setup validation script
│   ├── debug-notification-service.ts        # Notification service debugging
│   ├── deploy.sh                           # Deployment script
│   ├── dev-setup.ts                        # Development setup script
│   ├── generate-docs.ts                    # Documentation generation
│   ├── health-check.js                     # Health check script
│   ├── init-extensions.sql                 # Database extensions initialization
│   ├── init-test-db.sql                    # Test database initialization
│   ├── migrate.ts                          # Database migration script
│   ├── migration-cli.ts                    # Migration CLI tool
│   ├── phase1-summary.md                   # Phase 1 summary
│   ├── reset.ts                           # Database reset script
│   ├── run-tests.ts                       # Test runner script
│   ├── security-audit.ts                  # Security audit script
│   ├── seed.ts                            # Database seeding script
│   ├── setup-database.ts                  # Database setup script
│   ├── setup-environment.ts               # Environment setup script
│   ├── system-validation.ts               # System validation script
│   ├── test-config-only.ts               # Configuration testing
│   ├── test-container-integration.ts      # Container integration testing
│   ├── test-db.ts                        # Database testing script
│   ├── validate-config-integration.ts     # Configuration validation
│   ├── validate-configuration.ts          # Configuration validation
│   └── verify-setup.ts                   # Setup verification script
│
├── src/                                     # Source code
│   ├── app.ts                              # Application setup
│   ├── index.ts                            # Application entry point
│   ├── server.ts                           # Server configuration
│   │
│   ├── application/                         # Application layer
│   │   ├── index.ts                        # Application layer exports
│   │   │
│   │   ├── commands/                       # Command definitions
│   │   │   ├── base-command.ts             # Base command interface
│   │   │   ├── index.ts                    # Commands exports
│   │   │   ├── project-commands.ts         # Project commands
│   │   │   ├── task-commands.ts            # Task commands
│   │   │   ├── user-commands.ts            # User commands
│   │   │   └── workspace-commands.ts       # Workspace commands
│   │   │
│   │   ├── cqrs/                           # CQRS implementation
│   │   │   ├── command-bus.ts              # Command bus
│   │   │   ├── command.ts                  # Command interface
│   │   │   ├── cqrs-factory.ts             # CQRS factory
│   │   │   ├── index.ts                    # CQRS exports
│   │   │   ├── query-bus.ts                # Query bus
│   │   │   ├── query.ts                    # Query interface
│   │   │   └── validation/                 # CQRS validation
│   │   │       ├── command-validator.ts    # Command validation
│   │   │       └── query-validator.ts      # Query validation
│   │   │
│   │   ├── events/                         # Event handling
│   │   │   ├── application-event-handlers.ts # Application event handlers
│   │   │   ├── domain-event-bus.ts         # Domain event bus
│   │   │   ├── event-bus.ts                # Event bus
│   │   │   ├── event-handler-lifecycle-manager.ts # Event handler lifecycle
│   │   │   ├── event-handler-registry.ts   # Event handler registry
│   │   │   └── index.ts                    # Events exports
│   │   │
│   │   ├── handlers/                       # Command and query handlers
│   │   │   ├── audit-log-command-handlers.ts # Audit log command handlers
│   │   │   ├── base-handler.ts             # Base handler
│   │   │   ├── calendar-command-handlers-fixed.ts # Fixed calendar handlers
│   │   │   ├── calendar-command-handlers.ts # Calendar command handlers
│   │   │   ├── index.ts                    # Handlers exports
│   │   │   ├── notification-command-handlers.ts # Notification commands
│   │   │   ├── notification-query-handlers.ts # Notification queries
│   │   │   ├── project-command-handlers.ts # Project command handlers
│   │   │   ├── project-query-handlers.ts   # Project query handlers
│   │   │   ├── task-command-handlers.ts    # Task command handlers
│   │   │   ├── task-query-handlers.ts      # Task query handlers
│   │   │   ├── user-command-handlers.ts    # User command handlers
│   │   │   ├── user-query-handlers.ts      # User query handlers
│   │   │   ├── webhook-command-handlers.ts # Webhook command handlers
│   │   │   ├── webhook-query-handlers.ts   # Webhook query handlers
│   │   │   ├── workspace-command-handlers.ts # Workspace command handlers
│   │   │   └── workspace-query-handlers.ts # Workspace query handlers
│   │   │
│   │   ├── queries/                        # Query definitions
│   │   │   ├── base-query.ts               # Base query interface
│   │   │   ├── index.ts                    # Queries exports
│   │   │   ├── project-queries.ts          # Project queries
│   │   │   ├── task-queries.ts             # Task queries
│   │   │   ├── user-queries.ts             # User queries
│   │   │   └── workspace-queries.ts        # Workspace queries
│   │   │
│   │   ├── services/                       # Application services
│   │   │   ├── auth-application-service.ts # Authentication service
│   │   │   ├── base-application-service.ts # Base application service
│   │   │   ├── calendar-application-service.ts # Calendar service
│   │   │   ├── index.ts                    # Services exports
│   │   │   ├── notification-application-service.ts # Notification service
│   │   │   ├── project-application-service.ts # Project service
│   │   │   ├── task-application-service.ts # Task service
│   │   │   ├── user-application-service.ts # User service
│   │   │   ├── webhook-application-service.ts # Webhook service
│   │   │   └── workspace-application-service.ts # Workspace service
│   │   │
│   │   └── use-cases/                      # Use cases
│   │       ├── enhanced-task-use-cases.ts  # Enhanced task use cases
│   │       ├── index.ts                    # Use cases exports
│   │       └── task-use-cases.ts           # Task use cases
│   │
│   ├── domain/                             # Domain layer
│   │   ├── index.ts                        # Domain layer exports
│   │   │
│   │   ├── aggregates/                     # Domain aggregates
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── aggregate-root.ts           # Aggregate root base
│   │   │   ├── enhanced-aggregate-root.ts  # Enhanced aggregate root
│   │   │   ├── index.ts                    # Aggregates exports
│   │   │   ├── notification-aggregate.ts   # Notification aggregate
│   │   │   ├── project-aggregate.ts        # Project aggregate
│   │   │   ├── task-aggregate.ts           # Task aggregate
│   │   │   ├── webhook-aggregate.ts        # Webhook aggregate
│   │   │   └── workspace-aggregate.ts      # Workspace aggregate
│   │   │
│   │   ├── base/                           # Domain base classes
│   │   │   ├── entity.ts                   # Base entity
│   │   │   └── repository.interface.ts     # Repository interface
│   │   │
│   │   ├── entities/                       # Domain entities
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── account.ts                  # Account entity
│   │   │   ├── activity-tracking.ts        # Activity tracking entity
│   │   │   ├── audit-log.ts                # Audit log entity
│   │   │   ├── base-entity.ts              # Base entity
│   │   │   ├── calendar-event-old.ts       # Old calendar event entity
│   │   │   ├── calendar-event.ts           # Calendar event entity
│   │   │   ├── device.ts                   # Device entity
│   │   │   ├── file-attachment.ts          # File attachment entity
│   │   │   ├── index.ts                    # Entities exports
│   │   │   ├── metrics.ts                  # Metrics entity
│   │   │   ├── notification.ts             # Notification entity
│   │   │   ├── project-member.ts           # Project member entity
│   │   │   ├── project.ts                  # Project entity
│   │   │   ├── task-new.ts                 # New task entity
│   │   │   ├── task.ts                     # Task entity
│   │   │   ├── user.ts                     # User entity
│   │   │   ├── webhook-delivery.ts         # Webhook delivery entity
│   │   │   ├── webhook.ts                  # Webhook entity
│   │   │   ├── workspace-member.ts         # Workspace member entity
│   │   │   └── workspace.ts                # Workspace entity
│   │   │
│   │   ├── enums/                          # Domain enumerations
│   │   │   ├── audit-action.ts             # Audit action enum
│   │   │   ├── event-type.ts               # Event type enum
│   │   │   ├── index.ts                    # Enums exports
│   │   │   ├── status-enums.ts             # Status enumerations
│   │   │   ├── webhook-event.ts            # Webhook event enum
│   │   │   └── workspace-role.ts           # Workspace role enum
│   │   │
│   │   ├── events/                         # Domain events
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── audit-events.ts             # Audit events
│   │   │   ├── calendar-events.ts          # Calendar events
│   │   │   ├── domain-event-publisher.ts   # Domain event publisher
│   │   │   ├── domain-event.ts             # Domain event base
│   │   │   ├── index.ts                    # Events exports
│   │   │   ├── notification-events.ts      # Notification events
│   │   │   ├── project-events.ts           # Project events
│   │   │   ├── task-events.ts              # Task events
│   │   │   ├── user-events.ts              # User events
│   │   │   ├── webhook-events.ts           # Webhook events
│   │   │   └── workspace-events.ts         # Workspace events
│   │   │
│   │   ├── repositories/                   # Domain repository interfaces
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── account-repository.ts       # Account repository interface
│   │   │   ├── activity-tracking-repository.ts # Activity tracking repository
│   │   │   ├── audit-log-repository.ts     # Audit log repository interface
│   │   │   ├── base-repository.interface.ts # Base repository interface
│   │   │   ├── calendar-event-repository.ts # Calendar event repository
│   │   │   ├── device-repository.ts        # Device repository interface
│   │   │   ├── file-attachment-repository.ts # File attachment repository
│   │   │   ├── index.ts                    # Repositories exports
│   │   │   ├── metrics-repository.ts       # Metrics repository interface
│   │   │   ├── notification-repository.ts  # Notification repository interface
│   │   │   ├── project-repository.ts       # Project repository interface
│   │   │   ├── task-repository.ts          # Task repository interface
│   │   │   ├── user-repository.ts          # User repository interface
│   │   │   ├── webhook-repository.ts       # Webhook repository interface
│   │   │   └── workspace-repository.ts     # Workspace repository interface
│   │   │
│   │   ├── services/                       # Domain services
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── audit-domain-service.ts     # Audit domain service
│   │   │   ├── calendar-domain-service.ts  # Calendar domain service
│   │   │   ├── index.ts                    # Services exports
│   │   │   ├── notification-domain-service.ts # Notification domain service
│   │   │   ├── project-domain-service.ts   # Project domain service
│   │   │   ├── task-domain-service.ts      # Task domain service
│   │   │   ├── webhook-domain-service.ts   # Webhook domain service
│   │   │   └── workspace-domain-service.ts # Workspace domain service
│   │   │
│   │   ├── specifications/                 # Domain specifications
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── calendar-specifications.ts  # Calendar specifications
│   │   │   ├── index.ts                    # Specifications exports
│   │   │   ├── notification-specifications.ts # Notification specifications
│   │   │   ├── project-specifications.ts   # Project specifications
│   │   │   ├── task-specifications.ts      # Task specifications
│   │   │   ├── webhook-specifications.ts   # Webhook specifications
│   │   │   └── workspace-specifications.ts # Workspace specifications
│   │   │
│   │   └── value-objects/                  # Domain value objects
│   │       ├── .gitkeep                    # Git keep file
│   │       ├── account-id.ts               # Account ID value object
│   │       ├── activity-tracking-id.ts     # Activity tracking ID
│   │       ├── audit-log-id.ts             # Audit log ID value object
│   │       ├── calendar-event-id.ts        # Calendar event ID
│   │       ├── device-id.ts                # Device ID value object
│   │       ├── email.ts                    # Email value object
│   │       ├── index.ts                    # Value objects exports
│   │       ├── metrics-id.ts               # Metrics ID value object
│   │       ├── notification-id.ts          # Notification ID value object
│   │       ├── priority.ts                 # Priority value object
│   │       ├── project-id.ts               # Project ID value object
│   │       ├── project-role.ts             # Project role value object
│   │       ├── project-status.ts           # Project status value object
│   │       ├── recurrence-rule.ts          # Recurrence rule value object
│   │       ├── task-id.ts                  # Task ID value object
│   │       ├── task-status.ts              # Task status value object
│   │       ├── user-id.ts                  # User ID value object
│   │       ├── user-status.ts              # User status value object
│   │       ├── value-object.ts             # Base value object
│   │       ├── webhook-delivery-id.ts      # Webhook delivery ID
│   │       ├── webhook-id.ts               # Webhook ID value object
│   │       ├── workspace-id.ts             # Workspace ID value object
│   │       ├── workspace-plan.ts           # Workspace plan value object
│   │       └── workspace-role.ts           # Workspace role value object
│   │
│   ├── infrastructure/                     # Infrastructure layer
│   │   ├── index.ts                        # Infrastructure exports
│   │   ├── performance-optimization-service.ts # Performance optimization
│   │   │
│   │   ├── caching/                        # Caching infrastructure
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── cache-keys.ts               # Cache key definitions
│   │   │   ├── cache-service-interface.ts  # Cache service interface
│   │   │   ├── cache-service.ts            # Cache service implementation
│   │   │   ├── cache-warmer.ts             # Cache warming service
│   │   │   ├── index.ts                    # Caching exports
│   │   │   ├── performance-cache-strategies.ts # Cache strategies
│   │   │   └── redis-client.ts             # Redis client
│   │   │
│   │   ├── database/                       # Database infrastructure
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── automated-backup-service.ts # Automated backup service
│   │   │   ├── backup-recovery.ts          # Backup and recovery
│   │   │   ├── config.ts                   # Database configuration
│   │   │   ├── connection.ts               # Database connection
│   │   │   ├── database-connection-interface.ts # Connection interface
│   │   │   ├── disaster-recovery.ts        # Disaster recovery
│   │   │   ├── drizzle-query-optimizer.ts  # Drizzle query optimizer
│   │   │   ├── drizzle-transaction-manager.ts # Drizzle transaction manager
│   │   │   ├── health-check.ts             # Database health check
│   │   │   ├── index.ts                    # Database exports
│   │   │   ├── performance-optimizer.ts    # Performance optimizer
│   │   │   ├── point-in-time-recovery.ts   # Point-in-time recovery
│   │   │   ├── query-optimizer.ts          # Query optimizer
│   │   │   ├── transaction-integration-service.ts # Transaction integration
│   │   │   ├── transaction-manager.ts      # Transaction manager
│   │   │   ├── unit-of-work.ts             # Unit of work pattern
│   │   │   │
│   │   │   ├── backup-recovery/            # Backup and recovery services
│   │   │   │   ├── automated-backup-service.ts # Automated backup
│   │   │   │   ├── backup-recovery.ts      # Backup recovery
│   │   │   │   ├── disaster-recovery.ts    # Disaster recovery
│   │   │   │   ├── index.ts                # Backup exports
│   │   │   │   └── point-in-time-recovery.ts # Point-in-time recovery
│   │   │   │
│   │   │   ├── mappers/                    # Data mappers
│   │   │   │   └── project-mapper.ts       # Project data mapper
│   │   │   │
│   │   │   ├── migrations/                 # Database migrations
│   │   │   │   ├── 0000_cheerful_natasha_romanoff.sql # Initial migration
│   │   │   │   ├── migrate.ts              # Migration runner
│   │   │   │   └── meta/                   # Migration metadata
│   │   │   │       ├── 0000_snapshot.json  # Migration snapshot
│   │   │   │       └── _journal.json       # Migration journal
│   │   │   │
│   │   │   ├── repositories/               # Repository implementations
│   │   │   │   ├── audit-log-repository.ts # Audit log repository
│   │   │   │   ├── base-drizzle-repository.ts # Base Drizzle repository
│   │   │   │   ├── calendar-event-repository.ts # Calendar event repository
│   │   │   │   ├── file-attachment-repository.ts # File attachment repository
│   │   │   │   ├── index.ts                # Repositories exports
│   │   │   │   ├── notification-repository.ts # Notification repository
│   │   │   │   ├── project-repository.ts   # Project repository
│   │   │   │   ├── task-repository.ts      # Task repository
│   │   │   │   ├── user-repository.ts      # User repository
│   │   │   │   ├── webhook-repository.ts   # Webhook repository
│   │   │   │   ├── workspace-repository.ts # Workspace repository
│   │   │   │   └── entity-adapters/        # Entity adapters
│   │   │   │       └── notification-entity-adapter.ts # Notification adapter
│   │   │   │
│   │   │   ├── schema/                     # Database schema definitions
│   │   │   │   ├── audit-logs.ts           # Audit logs schema
│   │   │   │   ├── calendar-events.ts      # Calendar events schema
│   │   │   │   ├── file-attachments.ts     # File attachments schema
│   │   │   │   ├── index.ts                # Schema exports
│   │   │   │   ├── notifications.ts        # Notifications schema
│   │   │   │   ├── project-members.ts      # Project members schema
│   │   │   │   ├── projects.ts             # Projects schema
│   │   │   │   ├── task-dependencies.ts    # Task dependencies schema
│   │   │   │   ├── tasks.ts                # Tasks schema
│   │   │   │   ├── users.ts                # Users schema
│   │   │   │   ├── webhooks.ts             # Webhooks schema
│   │   │   │   └── workspaces.ts           # Workspaces schema
│   │   │   │
│   │   │   ├── seeds/                      # Database seeders
│   │   │   │   ├── audit-log-seeder.ts     # Audit log seeder
│   │   │   │   ├── calendar-event-seeder.ts # Calendar event seeder
│   │   │   │   ├── file-attachment-seeder.ts # File attachment seeder
│   │   │   │   ├── index.ts                # Seeders exports
│   │   │   │   ├── notification-seeder.ts  # Notification seeder
│   │   │   │   ├── project-seeder.ts       # Project seeder
│   │   │   │   ├── task-seeder.ts          # Task seeder
│   │   │   │   ├── user-seeder.ts          # User seeder
│   │   │   │   ├── webhook-seeder.ts       # Webhook seeder
│   │   │   │   └── workspace-seeder.ts     # Workspace seeder
│   │   │   │
│   │   │   └── types/                      # Database type definitions
│   │   │       └── index.ts                # Database types exports
│   │   │
│   │   ├── events/                         # Event infrastructure
│   │   │   └── event-integration-service.ts # Event integration service
│   │   │
│   │   ├── external-services/              # External service integrations
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── circuit-breaker.ts          # Circuit breaker pattern
│   │   │   ├── collaboration-service.ts    # Collaboration service
│   │   │   ├── email-service.ts            # Email service
│   │   │   ├── email-types.ts              # Email type definitions
│   │   │   ├── index.ts                    # External services exports
│   │   │   ├── realtime-dashboard-service.ts # Real-time dashboard
│   │   │   ├── realtime-event-service.ts   # Real-time event service
│   │   │   └── websocket-service.ts        # WebSocket service
│   │   │
│   │   ├── integration/                    # Integration services
│   │   │   └── infrastructure-integration.ts # Infrastructure integration
│   │   │
│   │   ├── jobs/                           # Background job system
│   │   │   ├── calendar-reminder-job.ts    # Calendar reminder job
│   │   │   ├── index.ts                    # Jobs exports
│   │   │   ├── job-factory.ts              # Job factory
│   │   │   ├── job-integration.ts          # Job integration
│   │   │   ├── job-manager.ts              # Job manager
│   │   │   ├── job-monitoring.ts           # Job monitoring
│   │   │   ├── job-processor.ts            # Job processor
│   │   │   ├── job-queue.ts                # Job queue
│   │   │   ├── job-registry.ts             # Job registry
│   │   │   ├── job-scheduler.ts            # Job scheduler
│   │   │   ├── job-service.ts              # Job service
│   │   │   ├── job-types.ts                # Job type definitions
│   │   │   ├── notification-job.ts         # Notification job
│   │   │   ├── README.md                   # Jobs documentation
│   │   │   ├── recurring-task-job.ts       # Recurring task job
│   │   │   └── webhook-delivery-job.ts     # Webhook delivery job
│   │   │
│   │   ├── migration/                      # Migration infrastructure
│   │   │   ├── fastify-migration.controller.ts # Fastify migration controller
│   │   │   ├── migration-routes.ts         # Migration routes
│   │   │   ├── migration-service-registration.ts # Migration service registration
│   │   │   ├── migration.module.ts         # Migration module
│   │   │   ├── README.md                   # Migration documentation
│   │   │   │
│   │   │   ├── cli/                        # Migration CLI
│   │   │   │   └── migration.cli.ts        # Migration CLI tool
│   │   │   │
│   │   │   ├── services/                   # Migration services
│   │   │   │   ├── backup.service.ts       # Backup service
│   │   │   │   ├── current-system-mapper.service.ts # System mapper
│   │   │   │   ├── error-recovery.service.ts # Error recovery service
│   │   │   │   ├── file-analysis.service.ts # File analysis service
│   │   │   │   ├── migration-tracker.service.ts # Migration tracker
│   │   │   │   └── verification.service.ts # Verification service
│   │   │   │
│   │   │   └── types/                      # Migration types
│   │   │       └── migration.types.ts      # Migration type definitions
│   │   │
│   │   ├── monitoring/                     # Monitoring infrastructure
│   │   │   ├── alerting-service.ts         # Alerting service
│   │   │   ├── api-performance-monitor.ts  # API performance monitoring
│   │   │   ├── comprehensive-monitoring.ts # Comprehensive monitoring
│   │   │   ├── correlation-id-service.ts   # Correlation ID service
│   │   │   ├── distributed-tracing-service.ts # Distributed tracing
│   │   │   ├── enhanced-monitoring-service.ts # Enhanced monitoring
│   │   │   ├── error-tracking.ts           # Error tracking
│   │   │   ├── health-check-service.ts     # Health check service
│   │   │   ├── health-service.ts           # Health service
│   │   │   ├── index.ts                    # Monitoring exports
│   │   │   ├── logging-service.ts          # Logging service
│   │   │   └── metrics-service.ts          # Metrics service
│   │   │
│   │   ├── performance/                    # Performance optimization
│   │   │   ├── api-optimization.ts         # API optimization
│   │   │   ├── index.ts                    # Performance exports
│   │   │   ├── request-batching.ts         # Request batching
│   │   │   └── response-compression.ts     # Response compression
│   │   │
│   │   └── security/                       # Security infrastructure
│   │       ├── .gitkeep                    # Git keep file
│   │       ├── audit-logger.ts             # Audit logger
│   │       ├── auth-middleware.ts          # Authentication middleware
│   │       ├── comprehensive-security-middleware.ts # Comprehensive security
│   │       ├── index.ts                    # Security exports
│   │       ├── input-sanitizer.ts          # Input sanitizer
│   │       ├── jwt-service.ts              # JWT service
│   │       ├── oauth-service.ts            # OAuth service
│   │       ├── password-service.ts         # Password service
│   │       ├── rate-limit-service.ts       # Rate limiting service
│   │       ├── rbac-service.ts             # Role-based access control
│   │       ├── session-manager.ts          # Session manager
│   │       └── two-factor-auth-service.ts  # Two-factor authentication
│   │
│   ├── presentation/                       # Presentation layer
│   │   ├── index.ts                        # Presentation exports
│   │   ├── server-setup.ts                 # Server setup
│   │   ├── setup-phase7-api.ts             # Phase 7 API setup
│   │   │
│   │   ├── controllers/                    # API controllers
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── analytics-controller.ts     # Analytics controller
│   │   │   ├── auth-controller.ts          # Authentication controller
│   │   │   ├── base-controller.ts          # Base controller
│   │   │   ├── calendar-controller.ts      # Calendar controller
│   │   │   ├── collaboration-controller.ts # Collaboration controller
│   │   │   ├── file-management-controller.ts # File management controller
│   │   │   ├── index.ts                    # Controllers exports
│   │   │   ├── monitoring-controller.ts    # Monitoring controller
│   │   │   ├── notification-controller.ts  # Notification controller
│   │   │   ├── project-controller.ts       # Project controller
│   │   │   ├── search-controller.ts        # Search controller
│   │   │   ├── task-controller.ts          # Task controller
│   │   │   ├── user-controller.ts          # User controller
│   │   │   ├── webhook-controller.ts       # Webhook controller
│   │   │   └── workspace-controller.ts     # Workspace controller
│   │   │
│   │   ├── documentation/                  # API documentation
│   │   │   ├── api-documentation-generator.ts # API documentation generator
│   │   │   └── setup-api-docs.ts           # API documentation setup
│   │   │
│   │   ├── dto/                            # Data Transfer Objects
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── analytics-dto.ts            # Analytics DTOs
│   │   │   ├── base-dto.ts                 # Base DTO
│   │   │   ├── error-dto.ts                # Error DTOs
│   │   │   ├── index.ts                    # DTOs exports
│   │   │   ├── notification-dto.ts         # Notification DTOs
│   │   │   ├── project-dto.ts              # Project DTOs
│   │   │   ├── task-dto.ts                 # Task DTOs
│   │   │   ├── user-dto.ts                 # User DTOs
│   │   │   ├── webhook-dto.ts              # Webhook DTOs
│   │   │   └── workspace-dto.ts            # Workspace DTOs
│   │   │
│   │   ├── middleware/                     # Express middleware
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── auth-middleware.ts          # Authentication middleware
│   │   │   ├── comprehensive-security-middleware.ts # Comprehensive security
│   │   │   ├── comprehensive-validation-middleware.ts # Comprehensive validation
│   │   │   ├── cors-middleware.ts          # CORS middleware
│   │   │   ├── error-handler-middleware.ts # Error handler middleware
│   │   │   ├── index.ts                    # Middleware exports
│   │   │   ├── rate-limit-middleware.ts    # Rate limiting middleware
│   │   │   ├── security-middleware.ts      # Security middleware
│   │   │   ├── setup.ts                    # Middleware setup
│   │   │   ├── standardized-response-middleware.ts # Standardized response
│   │   │   └── validation-middleware.ts    # Validation middleware
│   │   │
│   │   ├── routes/                         # API routes
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── analytics-routes.ts         # Analytics routes
│   │   │   ├── auth-routes.ts              # Authentication routes
│   │   │   ├── bulk-operations-routes.ts   # Bulk operations routes
│   │   │   ├── calendar-routes.ts          # Calendar routes
│   │   │   ├── collaboration-routes.ts     # Collaboration routes
│   │   │   ├── file-management-routes.ts   # File management routes
│   │   │   ├── health-routes.ts            # Health check routes
│   │   │   ├── index-old.ts                # Old routes index
│   │   │   ├── index.ts                    # Routes exports
│   │   │   ├── monitoring-routes.ts        # Monitoring routes
│   │   │   ├── notification-routes.ts      # Notification routes
│   │   │   ├── project-routes.ts           # Project routes
│   │   │   ├── search-routes.ts            # Search routes
│   │   │   ├── task-routes.ts              # Task routes
│   │   │   ├── user-routes.ts              # User routes
│   │   │   ├── webhook-routes.ts           # Webhook routes
│   │   │   └── workspace-routes.ts         # Workspace routes
│   │   │
│   │   └── websocket/                      # WebSocket implementation
│   │       ├── .gitkeep                    # Git keep file
│   │       ├── index.ts                    # WebSocket exports
│   │       ├── setup-old.ts                # Old WebSocket setup
│   │       ├── setup.ts                    # WebSocket setup
│   │       ├── websocket-gateway-old.ts    # Old WebSocket gateway
│   │       ├── websocket-gateway.ts        # WebSocket gateway
│   │       ├── websocket-handler.ts        # WebSocket handler
│   │       └── websocket-routes.ts         # WebSocket routes
│   │
│   ├── shared/                             # Shared utilities and services
│   │   ├── index.ts                        # Shared exports
│   │   │
│   │   ├── config/                         # Configuration management
│   │   │   ├── app-config.ts               # Application configuration
│   │   │   ├── config-integration-validator.ts # Configuration validator
│   │   │   └── index.ts                    # Config exports
│   │   │
│   │   ├── constants/                      # Application constants
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── application-constants.ts    # Application constants
│   │   │   ├── error-constants.ts          # Error constants
│   │   │   ├── index.ts                    # Constants exports
│   │   │   ├── project-constants.ts        # Project constants
│   │   │   ├── task-constants.ts           # Task constants
│   │   │   ├── user-constants.ts           # User constants
│   │   │   └── workspace-constants.ts      # Workspace constants
│   │   │
│   │   ├── container/                      # Dependency injection container
│   │   │   ├── container-initialization-service.ts # Container initialization
│   │   │   ├── container-integration-test.ts # Container integration test
│   │   │   ├── container.ts                # Container implementation
│   │   │   ├── dependency-validation-service.ts # Dependency validation
│   │   │   ├── health-checker.ts           # Health checker
│   │   │   ├── index.ts                    # Container exports
│   │   │   ├── service-descriptor.ts       # Service descriptor
│   │   │   ├── service-factory.ts          # Service factory
│   │   │   ├── service-registration.ts     # Service registration
│   │   │   └── types.ts                    # Container types
│   │   │
│   │   ├── decorators/                     # TypeScript decorators
│   │   │   ├── index.ts                    # Decorators exports
│   │   │   ├── injectable.decorator.ts     # Injectable decorator
│   │   │   ├── logging.decorator.ts        # Logging decorator
│   │   │   └── validation.decorator.ts     # Validation decorator
│   │   │
│   │   ├── documentation/                  # Documentation utilities
│   │   │   ├── api-documentation-generator.ts # API documentation generator
│   │   │   ├── documentation-integration.ts # Documentation integration
│   │   │   └── openapi-generator.ts        # OpenAPI generator
│   │   │
│   │   ├── enums/                          # Shared enumerations
│   │   │   ├── common.enums.ts             # Common enumerations
│   │   │   └── index.ts                    # Enums exports
│   │   │
│   │   ├── errors/                         # Custom error classes
│   │   │   ├── .gitkeep                    # Git keep file
│   │   │   ├── app-error.ts                # Application error
│   │   │   ├── authorization-error.ts      # Authorization error
│   │   │   ├── business-rule-violation-error.ts # Business rule violation
│   │   │   ├── domain-error.ts             # Domain error
│   │   │   ├── index.ts                    # Errors exports
│   │   │   ├── infrastructure-error.ts     # Infrastructure error
│   │   │   ├── not-found-error.ts          # Not found error
│   │   │   └── validation-error.ts         # Validation error
│   │   │
│   │   ├── guards/                         # Validation guards
│   │   │   ├── index.ts                    # Guards exports
│   │   │   └── validation.guards.ts        # Validation guards
│   │   │
│   │   ├── localization/                   # Internationalization
│   │   │   ├── i18n-manager.ts             # Internationalization manager
│   │   │   ├── index.ts                    # Localization exports
│   │   │   ├── test-i18n.ts                # Internationalization testing
│   │   │   ├── translation-loader.ts       # Translation loader
│   │   │   └── locales/                    # Locale files
│   │   │       ├── de/                     # German translations
│   │   │       │   └── translation.json    # German translation file
│   │   │       ├── en/                     # English translations
│   │   │       │   ├── common.json         # English common translations
│   │   │       │   └── translation.json    # English translation file
│   │   │       ├── es/                     # Spanish translations
│   │   │       │   ├── common.json         # Spanish common translations
│   │   │       │   └── translation.json    # Spanish translation file
│   │   │       ├── fr/                     # French translations
│   │   │       │   └── translation.json    # French translation file
│   │   │       └── zh/                     # Chinese translations
│   │   │           └── translation.json    # Chinese translation file
│   │   │
│   │   ├── services/                       # Shared services
│   │   │   ├── business-rules-service.ts   # Business rules service
│   │   │   ├── index.ts                    # Services exports
│   │   │   └── validation-service.ts       # Validation service
│   │   │
│   │   ├── types/                          # Shared type definitions
│   │   │   ├── auth-types.ts               # Authentication types
│   │   │   ├── common.types.ts             # Common types
│   │   │   ├── documentation.ts            # Documentation types
│   │   │   ├── environment.ts              # Environment types
│   │   │   ├── event.interface.ts          # Event interface
│   │   │   ├── index.ts                    # Types exports
│   │   │   ├── logger.interface.ts         # Logger interface
│   │   │   ├── task-filters.ts             # Task filter types
│   │   │   └── validator.interface.ts      # Validator interface
│   │   │
│   │   └── utils/                          # Utility functions
│   │       ├── .gitkeep                    # Git keep file
│   │       ├── api-features.ts             # API feature utilities
│   │       ├── app-error.ts                # Application error utilities
│   │       ├── async-handler.ts            # Async handler utilities
│   │       ├── cache.ts                    # Cache utilities
│   │       ├── date-utils.ts               # Date utilities
│   │       ├── id-generator.ts             # ID generator utilities
│   │       ├── index.ts                    # Utils exports
│   │       ├── performance-monitor.ts      # Performance monitoring
│   │       ├── response-formatter.ts       # Response formatter
│   │       ├── validation-utils.ts         # Validation utilities
│   │       └── __tests__/                  # Utility tests
│   │           └── id-generator.test.ts    # ID generator tests
│   │
│   └── tests/                              # Source code tests
│       └── integration/                    # Integration tests
│
└── tests/                                  # Test suite
    ├── README.md                           # Testing documentation
    ├── setup.ts                           # Test setup
    │
    ├── config/                             # Test configuration
    │   ├── test-config.ts                  # Test configuration
    │   └── vitest-setup.ts                 # Vitest setup
    │
    ├── e2e/                                # End-to-end tests
    │   ├── api/                            # API E2E tests
    │   │   └── task-api.test.ts            # Task API E2E tests
    │   ├── performance/                    # Performance tests
    │   │   └── api-performance.test.ts     # API performance tests
    │   └── security/                       # Security tests
    │       └── security.test.ts            # Security tests
    │
    ├── helpers/                            # Test helpers
    │   ├── api-helpers.ts                  # API test helpers
    │   ├── database-helpers.ts             # Database test helpers
    │   ├── mock-helpers.ts                 # Mock helpers
    │   └── test-helpers.ts                 # General test helpers
    │
    ├── integration/                        # Integration tests
    │   └── database/                       # Database integration tests
    │       └── task-repository-integration.test.ts # Task repository integration
    │
    └── unit/                               # Unit tests
        ├── application/                    # Application layer tests
        │   └── services/                   # Application service tests
        │       └── task-application-service.test.ts # Task application service tests
        ├── domain/                         # Domain layer tests
        │   ├── entities/                   # Entity tests
        │   │   ├── project.test.ts         # Project entity tests
        │   │   ├── task.test.ts            # Task entity tests
        │   │   └── user.test.ts            # User entity tests
        │   └── services/                   # Domain service tests
        │       └── task-domain-service.test.ts # Task domain service tests
        └── infrastructure/                 # Infrastructure layer tests
            └── database/                   # Database tests
                └── repositories/           # Repository tests
                    └── task-repository.test.ts # Task repository tests
```

## Key Features

### 🏗️ Architecture
- **Clean Architecture**: Separation of concerns with distinct layers
- **Domain-Driven Design (DDD)**: Rich domain models and business logic
- **CQRS Pattern**: Command Query Responsibility Segregation
- **Event-Driven Architecture**: Domain events and event handlers
- **Dependency Injection**: IoC container for service management

### 🔐 Security
- **Multi-Factor Authentication**: JWT, OAuth, WebAuthn, 2FA
- **Role-Based Access Control (RBAC)**: Fine-grained permissions
- **Input Sanitization**: XSS and injection prevention
- **Rate Limiting**: API protection against abuse
- **Audit Logging**: Comprehensive audit trail

### 📊 Data & Persistence
- **PostgreSQL**: Primary database with Drizzle ORM
- **Redis**: Caching and session management
- **Database Migrations**: Version-controlled schema changes
- **Backup & Recovery**: Automated backup and disaster recovery
- **Performance Optimization**: Query optimization and caching strategies

### 🔄 Real-time & Background Processing
- **WebSocket Support**: Real-time updates and notifications
- **Background Jobs**: Scheduled tasks and queue processing
- **Event System**: Domain events and application events
- **Webhook Integration**: External system notifications

### 📈 Monitoring & Observability
- **Health Checks**: System health monitoring
- **Metrics Collection**: Performance and business metrics
- **Error Tracking**: Comprehensive error monitoring
- **Distributed Tracing**: Request tracing across services
- **Alerting**: Automated alert system

### 🧪 Testing
- **Unit Tests**: Domain and application logic testing
- **Integration Tests**: Database and service integration testing
- **E2E Tests**: Full application flow testing
- **Performance Tests**: Load and stress testing
- **Security Tests**: Security vulnerability testing

### 🌐 Internationalization
- **Multi-language Support**: English, Spanish, French, German, Chinese
- **Translation Management**: Dynamic translation loading
- **Locale-specific Formatting**: Date, number, and currency formatting

### 📦 Deployment & DevOps
- **Docker Support**: Containerized deployment
- **Multi-environment**: Development, staging, production configurations
- **CI/CD Ready**: Automated testing and deployment scripts
- **Configuration Management**: Environment-specific configurations

## File Count Summary

- **Total TypeScript Files**: ~500+ files
- **Test Files**: ~20+ test files
- **Configuration Files**: ~15+ configuration files
- **Documentation Files**: ~10+ documentation files
- **Database Files**: ~25+ schema and migration files
- **Localization Files**: ~5+ translation files

## Getting Started

1. **Environment Setup**: Copy `.env.example` to `.env` and configure
2. **Database Setup**: Run `npm run db:setup` to initialize the database
3. **Dependencies**: Run `npm install` to install dependencies
4. **Development**: Run `npm run dev` to start the development server
5. **Testing**: Run `npm test` to execute the test suite

## Scripts Available

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run all tests
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed the database
- `npm run docker:dev` - Start development with Docker
- `npm run docker:prod` - Start production with Docker

This project demonstrates enterprise-level Node.js application development with comprehensive features for task management, security, monitoring, and scalability.
