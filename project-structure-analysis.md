# Comprehensive Project Structure Analysis

## Project Overview

This is a comprehensive enterprise-grade task management platform built with TypeScript, following Domain-Driven Design (DDD) principles and Clean Architecture patterns. The project implements a sophisticated multi-layered architecture with clear separation of concerns across domain, application, infrastructure, and presentation layers.

## Root Level Files

### Configuration Files

- `.env` - Environment variables for local development
- `.env.example` - Template for environment variables
- `.eslintrc.js` - ESLint configuration for code quality
- `.prettierrc` - Prettier configuration for code formatting
- `.gitignore` - Git ignore patterns
- `tsconfig.json` - TypeScript compiler configuration
- `vitest.config.ts` - Vitest testing framework configuration
- `package.json` - Node.js project dependencies and scripts
- `package-lock.json` - Locked dependency versions

### Docker Configuration

- `docker-compose.yml` - Development Docker services
- `docker-compose.production.yml` - Production Docker services
- `docker-compose.test.yml` - Testing environment Docker services
- `Dockerfile.dev` - Development Docker image
- `Dockerfile.test` - Testing Docker image

### Documentation

- `README.md` - Project documentation
- `database-domain-alignment-analysis.md` - Database and domain analysis

## Configuration Directory (`config/`)

### Environment-Specific Configurations

- `development.json` - Development environment settings
- `production.json` - Production environment settings
- `staging.json` - Staging environment settings
- `test.json` - Test environment settings

### Infrastructure Configurations

- `nginx-production.conf` - Nginx web server configuration for production
- `prometheus-production.yml` - Prometheus monitoring configuration
- `redis-production.conf` - Redis cache configuration for production

## Scripts Directory (`scripts/`)

### Database Management

- `setup-database.ts` - Database initialization script
- `migrate.ts` - Database migration runner
- `seed.ts` - Database seeding script
- `reset.ts` - Database reset utility
- `test-db.ts` - Test database utilities
- `init-extensions.sql` - SQL extensions initialization
- `init-test-db.sql` - Test database initialization

### Development Tools

- `dev-setup.ts` - Development environment setup
- `check-setup.ts` - Setup validation script
- `verify-setup.ts` - Environment verification
- `run-tests.ts` - Test execution script
- `setup-environment.ts` - Environment configuration
- `validate-configuration.ts` - Configuration validation

### Documentation

- `phase1-summary.md` - Phase 1 development summary

## Source Code Structure (`src/`)

### Entry Points

- `index.ts` - Application entry point
- `app.ts` - Express application configuration
- `server.ts` - HTTP server setup

## Application Layer (`src/application/`)

### Core Application Files

- `index.ts` - Application layer exports
- `README.md` - Application layer documentation

### CQRS Implementation (`src/application/cqrs/`)

#### Core CQRS Files

- `command-bus.ts` - Command bus implementation
- `command.ts` - Base command interface
- `query-bus.ts` - Query bus implementation
- `query.ts` - Base query interface
- `cqrs-factory.ts` - CQRS component factory
- `index.ts` - CQRS exports

#### Commands (`src/application/cqrs/commands/`)

- `task-commands.ts` - Task-related commands

#### Handlers (`src/application/cqrs/handlers/`)

- `task-command-handlers.ts` - Task command handlers
- `task-query-handlers.ts` - Task query handlers

#### Queries (`src/application/cqrs/queries/`)

- `task-queries.ts` - Task-related queries

#### Validation (`src/application/cqrs/validation/`)

- `command-validator.ts` - Command validation logic
- `query-validator.ts` - Query validation logic

### Decorators (`src/application/decorators/`)

- `injectable.ts` - Dependency injection decorators

### Event System (`src/application/events/`)

- `domain-event-bus.ts` - Domain event bus implementation
- `event-handler-registry.ts` - Event handler registration

#### Event Handlers (`src/application/events/handlers/`)

- `integration-event-handlers.ts` - Integration event handlers
- `task-event-handlers.ts` - Task-specific event handlers

### Application Services (`src/application/services/`)

- `index.ts` - Services exports
- `base.service.ts` - Base service class
- `calendar-event.application.service.ts` - Calendar event application service
- `calendar-integration.application.service.ts` - Calendar integration service
- `data-import-export.service.ts` - Data import/export functionality
- `email.service.ts` - Email service
- `feedback.service.ts` - Feedback management service
- `websocket.service.ts` - WebSocket service implementation
- `websocket.service!.ts` - WebSocket service backup/alternative

### Use Cases (`src/application/use-cases/`)

- `task-use-cases.ts` - Task management use cases

## Domain Layer (`src/domain/`)

### Analytics Domain (`src/domain/analytics/`)

#### Entities

- `ActivityTrackingEntity.ts` - Activity tracking entity
- `MetricsEntity.ts` - Metrics entity

#### Repositories

- `IActivityTrackingRepository.ts` - Activity tracking repository interface
- `IMetricsRepository.ts` - Metrics repository interface

#### Services

- `activity.service.ts` - Activity service
- `ActivityTrackingService.ts` - Activity tracking service
- `analytics.service.ts` - Analytics service
- `dashboard.service.ts` - Dashboard service
- `DataExportService.ts` - Data export service
- `MetricsCollectionService.ts` - Metrics collection service
- `ProductivityAnalyticsService.ts` - Productivity analytics service

#### Value Objects

- `ActivityTypes.ts` - Activity type definitions
- `MetricTypes.ts` - Metric type definitions

### Audit Domain (`src/domain/audit/`)

#### Structure (Empty directories with .gitkeep placeholders)

- `entities/` - Audit entities (empty)
- `repositories/` - Audit repositories (empty)
- `services/` - Audit services (empty)
- `value-objects/` - Audit value objects (empty)

### Authentication Domain (`src/domain/authentication/`)

#### Entities

- `Account.ts` - Account entity
- `Device.ts` - Device entity
- `Permission.ts` - Permission entity
- `Role.ts` - Role entity
- `Session.ts` - Session entity
- `User.ts` - User entity
- `WebAuthnCredential.ts` - WebAuthn credential entity

#### Repositories

- `IUserRepository.ts` - User repository interface

#### Services

- `AuditLoggingService.ts` - Audit logging service
- `AuthenticationService.ts` - Authentication service
- `AuthorizationService.ts` - Authorization service
- `DataProtectionService.ts` - Data protection service
- `MfaEnhancedService.ts` - Enhanced MFA service
- `MfaService.ts` - Multi-factor authentication service
- `OAuthEnhancedService.ts` - Enhanced OAuth service
- `OAuthService.ts` - OAuth service
- `RiskAssessmentService.ts` - Risk assessment service
- `RoleBasedAccessControlService.ts` - RBAC service
- `SessionManagementService.ts` - Session management service
- `TokenManagementService.ts` - Token management service
- `user.service.ts` - User service

#### Value Objects

- `AccountId.ts` - Account identifier
- `DeviceId.ts` - Device identifier
- `Email.ts` - Email value object
- `RoleId.ts` - Role identifier
- `SessionId.ts` - Session identifier
- `UserId.ts` - User identifier
- `WebAuthnCredentialId.ts` - WebAuthn credential identifier

### Calendar Domain (`src/domain/calendar/`)

#### Entities

- `calendar-event.entity.ts` - Calendar event entity
- `calendar-integration.entity.ts` - Calendar integration entity

#### Events

- `calendar-event-created.event.ts` - Calendar event created event
- `calendar-event-deleted.event.ts` - Calendar event deleted event
- `calendar-event-updated.event.ts` - Calendar event updated event
- `calendar-integration-created.event.ts` - Calendar integration created event
- `calendar-integration-deleted.event.ts` - Calendar integration deleted event
- `calendar-integration-updated.event.ts` - Calendar integration updated event

#### Repositories

- `calendar-event.repository.ts` - Calendar event repository

#### Services

- `calendar-event-domain.service.ts` - Calendar event domain service
- `calendar-event.service.ts` - Calendar event service
- `calendar.service.ts` - Calendar service
- `google-calendar-integration.service.ts` - Google Calendar integration
- `task-calendar-sync.service.ts` - Task-calendar synchronization

#### Value Objects

- `access-token.vo.ts` - Access token value object
- `calendar-event-id.vo.ts` - Calendar event ID
- `calendar-integration-id.vo.ts` - Calendar integration ID
- `calendar-name.vo.ts` - Calendar name
- `calendar-provider.vo.ts` - Calendar provider
- `event-color.vo.ts` - Event color
- `event-datetime.vo.ts` - Event date/time
- `event-description.vo.ts` - Event description
- `event-location.vo.ts` - Event location
- `event-title.vo.ts` - Event title
- `recurrence-rule.vo.ts` - Recurrence rule
- `refresh-token.vo.ts` - Refresh token

### Collaboration Domain (`src/domain/collaboration/`)

#### Structure (Mostly empty with .gitkeep files)

- `entities/.gitkeep` - Collaboration entities placeholder
- `repositories/.gitkeep` - Collaboration repositories placeholder
- `value-objects/.gitkeep` - Collaboration value objects placeholder

#### Services

- `comment.service.ts` - Comment service
- `file-collaboration.service.ts` - File collaboration service
- `presence.service.ts` - Presence service

### File Management Domain (`src/domain/file-management/`)

#### Documentation

- `README.md` - File management domain documentation

#### Entities

- `attachment.entity.ts` - Attachment entity
- `file.entity.ts` - File entity

#### Repositories

- `file.repository.ts` - File repository

#### Services

- `attachment.service.ts` - Attachment service
- `file-audit.service.ts` - File audit service
- `file-management.service.ts` - File management service
- `file-storage.service.ts` - File storage service
- `virus-scanner.service.ts` - Virus scanning service

#### Value Objects

- `file-access-control.vo.ts` - File access control
- `file-metadata.vo.ts` - File metadata
- `file-version.vo.ts` - File version

### Notification Domain (`src/domain/notification/`)

#### Entities

- `notification-preferences.entity.ts` - Notification preferences entity
- `notification-template.entity.ts` - Notification template entity
- `notification.entity.ts` - Notification entity

#### Repositories

- `notification-preferences.repository.ts` - Notification preferences repository
- `notification-template.repository.ts` - Notification template repository
- `notification.repository.ts` - Notification repository

#### Services

- `email-preference.service.ts` - Email preference service
- `email-template.service.ts` - Email template service
- `notification-analytics.service.ts` - Notification analytics service
- `notification-delivery.service.ts` - Notification delivery service
- `notification-queue.service.ts` - Notification queue service
- `notification-template.service.ts` - Notification template service
- `notification.service.ts` - Notification service
- `push-notification.service.ts` - Push notification service
- `unified-notification.service.ts` - Unified notification service

#### Value Objects

- `notification-channel.ts` - Notification channel
- `notification-id.ts` - Notification identifier
- `notification-preferences-id.ts` - Notification preferences identifier
- `notification-priority.ts` - Notification priority
- `notification-status.ts` - Notification status
- `notification-template-id.ts` - Notification template identifier
- `notification-type.ts` - Notification type

### Search Domain (`src/domain/search/`)

#### Documentation

- `README.md` - Search domain documentation

#### Entities

- `saved-search.entity.ts` - Saved search entity
- `search-index.entity.ts` - Search index entity

#### Repositories

- `saved-search.repository.ts` - Saved search repository
- `search-index.repository.ts` - Search index repository

#### Services

- `advanced-filtering.service.ts` - Advanced filtering service
- `cross-entity-search.service.ts` - Cross-entity search service
- `search-indexing.service.ts` - Search indexing service
- `search-query.service.ts` - Search query service
- `search.service.ts` - Search service

#### Value Objects

- `search-query.vo.ts` - Search query value object
- `search-result.vo.ts` - Search result value object

### Shared Domain (`src/domain/shared/`)

#### Domain Core

- `base-entity.ts` - Base entity class
- `base-service.ts` - Base service class
- `domain-event.ts` - Domain event interface
- `event-bus.ts` - Event bus interface
- `index.ts` - Shared domain exports
- `optimistic-locking.ts` - Optimistic locking implementation
- `repository.ts` - Repository interface
- `value-object.ts` - Value object base class

#### Error Handling

- `app-errors.ts` - Application errors
- `domain-error.ts` - Domain error base class

#### Event System

- `domain-event-bus.ts` - Domain event bus
- `domain-event.ts` - Domain event interface
- `event-store.ts` - Event store implementation
- `index.ts` - Events exports
- `integration-event-bus.ts` - Integration event bus
- `integration-event.ts` - Integration event interface
- `README.md` - Events documentation
- `unified-event-system.ts` - Unified event system
- `webhook-delivery-service.ts` - Webhook delivery service
- `websocket-event-bus.ts` - WebSocket event bus

#### Interfaces

- `logger.interface.ts` - Logger interface

#### Validation

- `validation-engine.ts` - Validation engine

### System Monitoring Domain (`src/domain/system-monitoring/`)

#### Structure (Mostly empty with .gitkeep files)

- `entities/.gitkeep` - System monitoring entities placeholder
- `repositories/.gitkeep` - System monitoring repositories placeholder
- `value-objects/.gitkeep` - System monitoring value objects placeholder

#### Services

- `system-monitoring.service.ts` - System monitoring service

### Task Management Domain (`src/domain/task-management/`)

#### Entities

- `Project.ts` - Project entity
- `RecurringTask.ts` - Recurring task entity
- `Task.ts` - Task entity
- `TaskTemplate.ts` - Task template entity
- `Team.ts` - Team entity
- `Workspace.ts` - Workspace entity

#### Events

- `task-events.ts` - Task events
- `TaskEventHandlers.ts` - Task event handlers

#### Repositories

- `IProjectRepository.ts` - Project repository interface
- `ITaskRepository.ts` - Task repository interface
- `IWorkspaceRepository.ts` - Workspace repository interface
- `ProjectMemberRepository.ts` - Project member repository
- `ProjectRepository.ts` - Project repository implementation
- `TaskRepository.ts` - Task repository implementation
- `TeamRepository.ts` - Team repository implementation
- `WorkspaceMemberRepository.ts` - Workspace member repository
- `WorkspaceRepository.ts` - Workspace repository implementation

#### Services

- `invitation.service.ts` - Invitation service
- `project.service.ts` - Project service
- `ProjectDomainService.ts` - Project domain service
- `ProjectService.ts` - Project service implementation
- `ProjectTemplateService.ts` - Project template service
- `recurring-task.service.ts` - Recurring task service
- `task-management.domain-service.ts` - Task management domain service
- `task-template.service.ts` - Task template service
- `task.service.ts` - Task service
- `TaskDomainService.ts` - Task domain service
- `TaskFilterService.ts` - Task filter service
- `TaskService.ts` - Task service implementation
- `team.service.ts` - Team service
- `TeamCommunicationService.ts` - Team communication service
- `TeamService.ts` - Team service implementation
- `workspace.service.ts` - Workspace service
- `WorkspaceBillingService.ts` - Workspace billing service
- `WorkspaceContextService.ts` - Workspace context service
- `WorkspacePermissionService.ts` - Workspace permission service
- `WorkspaceService.ts` - Workspace service implementation

#### Specifications

- `ProjectSpecifications.ts` - Project specifications
- `task-specifications.ts` - Task specifications
- `TaskSpecifications.ts` - Task specifications implementation

#### Value Objects

- `Priority.ts` - Priority value object
- `ProjectId.ts` - Project identifier
- `ProjectStatus.ts` - Project status
- `TaskId.ts` - Task identifier
- `TaskStatus.ts` - Task status
- `TeamId.ts` - Team identifier
- `WorkspaceId.ts` - Workspace identifier

### Webhook Domain (`src/domain/webhook/`)

#### Entities

- `webhook-delivery.entity.ts` - Webhook delivery entity
- `webhook.entity.ts` - Webhook entity

#### Repositories

- `webhook-delivery.repository.ts` - Webhook delivery repository
- `webhook.repository.ts` - Webhook repository

#### Services

- `webhook-analytics.service.ts` - Webhook analytics service
- `webhook-delivery.service.impl.ts` - Webhook delivery service implementation
- `webhook-delivery.service.ts` - Webhook delivery service interface
- `webhook-event-dispatcher.service.impl.ts` - Webhook event dispatcher implementation
- `webhook-event-dispatcher.service.ts` - Webhook event dispatcher interface
- `webhook-management.service.impl.ts` - Webhook management service implementation
- `webhook-management.service.ts` - Webhook management service interface
- `webhook-testing.service.ts` - Webhook testing service

#### Value Objects

- `webhook-delivery-id.ts` - Webhook delivery identifier
- `webhook-delivery-status.ts` - Webhook delivery status
- `webhook-event.ts` - Webhook event
- `webhook-id.ts` - Webhook identifier
- `webhook-secret.ts` - Webhook secret
- `webhook-status.ts` - Webhook status
- `webhook-url.ts` - Webhook URL

## Documentation (`src/docs/`)

- `openapi-generator.ts` - OpenAPI specification generator
- `task-api-docs.ts` - Task API documentation

## Infrastructure Layer (`src/infrastructure/`)

### Core Infrastructure

- `bootstrap.ts` - Infrastructure bootstrapping
- `index.ts` - Infrastructure exports

### Backup System (`src/infrastructure/backup/`)

- `backup-system.ts` - Backup system implementation
- `comprehensive-backup-system.ts` - Comprehensive backup system

### Cache Management (`src/infrastructure/cache/`)

- `cache-manager.ts` - Cache management
- `redis-client.ts` - Redis client implementation

### Configuration (`src/infrastructure/config/`)

- `configuration-manager.ts` - Configuration management
- `database.ts` - Database configuration
- `environment.ts` - Environment configuration
- `feature-flags.ts` - Feature flags configuration
- `i18n.ts` - Internationalization configuration
- `index.ts` - Configuration exports
- `logger.ts` - Logger configuration
- `passport.ts` - Passport authentication configuration
- `service-discovery.ts` - Service discovery configuration
- `swagger.ts` - Swagger documentation configuration

### Database Infrastructure (`src/infrastructure/database/`)

#### Core Database Files

- `base-repository.ts` - Base repository implementation
- `connection-pool-manager.ts` - Connection pool management
- `data-consistency-manager.ts` - Data consistency management
- `health-check.ts` - Database health check
- `index.ts` - Database exports
- `migration-system.ts` - Migration system
- `migration-utils.ts` - Migration utilities
- `prisma-client.ts` - Prisma client configuration
- `query-optimizer.ts` - Query optimization
- `referential-integrity.ts` - Referential integrity management
- `transaction-manager.ts` - Transaction management
- `unit-of-work.ts` - Unit of work pattern

#### Drizzle ORM (`src/infrastructure/database/drizzle/`)

##### Core Drizzle Files

- `connection.ts` - Drizzle connection setup
- `health.ts` - Drizzle health checks
- `index.ts` - Drizzle exports
- `README.md` - Drizzle documentation
- `setup.ts` - Drizzle setup

##### Migrations (`src/infrastructure/database/drizzle/migrations/`)

- `0000_glorious_scalphunter.sql` - Initial migration
- `0001_add_project_status.sql` - Project status migration
- `migration-runner.ts` - Migration runner
- `meta/` - Migration metadata directory

##### Repositories (`src/infrastructure/database/drizzle/repositories/`)

- `activity.repository.ts` - Activity repository
- `audit.repository.ts` - Audit repository
- `calendar-event.repository.ts` - Calendar event repository
- `calendar-integration.repository.ts` - Calendar integration repository
- `comment.repository.ts` - Comment repository
- `feedback.repository.ts` - Feedback repository
- `index.ts` - Repositories exports
- `invitation.repository.ts` - Invitation repository
- `notification.repository.ts` - Notification repository
- `project.repository.ts` - Project repository
- `README.md` - Repositories documentation
- `recurring-task.repository.ts` - Recurring task repository
- `task-template.repository.ts` - Task template repository
- `task.repository.ts` - Task repository
- `team.repository.ts` - Team repository
- `user.repository.ts` - User repository
- `workspace.repository.ts` - Workspace repository
- `base/` - Base repository classes directory

##### Schema (`src/infrastructure/database/drizzle/schema/`)

- `activities.ts` - Activities schema
- `audit-logs.ts` - Audit logs schema
- `calendar-events.ts` - Calendar events schema
- `calendar-integrations.ts` - Calendar integrations schema
- `comments.ts` - Comments schema
- `feedback.ts` - Feedback schema
- `index.ts` - Schema exports
- `invitations.ts` - Invitations schema
- `notifications.ts` - Notifications schema
- `projects.ts` - Projects schema
- `recurring-tasks.ts` - Recurring tasks schema
- `task-templates.ts` - Task templates schema
- `tasks.ts` - Tasks schema
- `teams.ts` - Teams schema
- `users.ts` - Users schema
- `workspaces.ts` - Workspaces schema

#### Prisma ORM (`src/infrastructure/database/prisma/`)

- `schema.prisma` - Prisma schema definition

##### Migrations (`src/infrastructure/database/prisma/migrations/`)

- `001_add_search_tables.sql` - Search tables migration
- `001_add_webhook_tables.sql` - Webhook tables migration
- `add_comprehensive_constraints.sql` - Comprehensive constraints
- `add_comprehensive_indexes.sql` - Comprehensive indexes

##### Seeds (`src/infrastructure/database/prisma/seeds/`)

- (Empty directory for Prisma seeds)

#### Database Schemas (`src/infrastructure/database/schemas/`)

- `common.schemas.ts` - Common schemas
- `project.schemas.ts` - Project schemas
- `task.schemas.ts` - Task schemas
- `user.schemas.ts` - User schemas

#### Database Seeds (`src/infrastructure/database/seeds/`)

- `index.ts` - Seeds exports
- `projects.ts` - Project seeds
- `tasks.ts` - Task seeds
- `users.ts` - User seeds
- `workspaces.ts` - Workspace seeds

### Deployment (`src/infrastructure/deployment/`)

- `zero-downtime.ts` - Zero-downtime deployment

### Email Infrastructure (`src/infrastructure/email/`)

- `email-delivery-provider.ts` - Email delivery provider

### Event Infrastructure (`src/infrastructure/events/`)

- `event-system-factory.ts` - Event system factory
- `event-system-integration.test.ts` - Event system integration tests

### External APIs (`src/infrastructure/external-apis/`)

- `google-calendar-api.client.ts` - Google Calendar API client

### External Services (`src/infrastructure/external-services/`)

- `circuit-breaker.ts` - Circuit breaker implementation
- `service-factory.ts` - Service factory

#### Email Services (`src/infrastructure/external-services/email/`)

- `email-service.ts` - Email service implementation

### Integration (`src/infrastructure/integration/`)

- `phase12-integration-service.ts` - Phase 1-2 integration service

### IoC Container (`src/infrastructure/ioc/`)

- `bootstrap.ts` - IoC bootstrapping
- `container.ts` - IoC container implementation
- `decorators.ts` - IoC decorators
- `index.ts` - IoC exports
- `README.md` - IoC documentation
- `service-factory.ts` - Service factory
- `service-locator.ts` - Service locator
- `service-registry.ts` - Service registry

#### IoC Examples (`src/infrastructure/ioc/examples/`)

- `usage-examples.ts` - IoC usage examples

### Logging (`src/infrastructure/logging/`)

- `logger.ts` - Logger implementation

### Monitoring (`src/infrastructure/monitoring/`)

- `alerting.service.ts` - Alerting service
- `health-check.service.ts` - Health check service
- `index.ts` - Monitoring exports
- `metrics.service.ts` - Metrics service
- `monitoring-bootstrap.service.ts` - Monitoring bootstrap service
- `monitoring-dashboard.service.ts` - Monitoring dashboard service
- `performance-monitor.ts` - Performance monitoring
- `README.md` - Monitoring documentation

### Performance (`src/infrastructure/performance/`)

- `api-optimizer.ts` - API optimization
- `performance-integration.ts` - Performance integration
- `performance-optimization-service.ts` - Performance optimization service

### Push Notifications (`src/infrastructure/push/`)

- `push-delivery-provider.ts` - Push notification delivery provider

### Repository Implementations (`src/infrastructure/repositories/`)

- `calendar-event.repository.impl.ts` - Calendar event repository implementation
- `prisma-file.repository.ts` - Prisma file repository
- `project.repository.impl.ts` - Project repository implementation
- `task.repository.impl.ts` - Task repository implementation

### Resilience (`src/infrastructure/resilience/`)

- `circuit-breaker.ts` - Circuit breaker implementation

### Scaling (`src/infrastructure/scaling/`)

- `horizontal-scaling-manager.ts` - Horizontal scaling manager
- `load-balancer.ts` - Load balancer

### Search Infrastructure (`src/infrastructure/search/`)

- `postgresql-saved-search.repository.ts` - PostgreSQL saved search repository
- `postgresql-search-index.repository.ts` - PostgreSQL search index repository

#### Search Entity Adapters (`src/infrastructure/search/entity-adapters/`)

- `comment-search.adapter.ts` - Comment search adapter
- `project-search.adapter.ts` - Project search adapter
- `task-search.adapter.ts` - Task search adapter

### Security (`src/infrastructure/security/`)

- (Empty directory for security implementations)

### Server (`src/infrastructure/server/`)

- `fastify-server.ts` - Fastify server implementation

### Storage (`src/infrastructure/storage/`)

- `azure-blob-storage.service.ts` - Azure Blob Storage service
- `clamav-scanner.service.ts` - ClamAV virus scanner service
- `enhanced-clamav-scanner.service.ts` - Enhanced ClamAV scanner service
- `enhanced-local-storage.service.ts` - Enhanced local storage service
- `local-storage.service.ts` - Local storage service
- `s3-storage.service.ts` - AWS S3 storage service
- `storage-factory.service.ts` - Storage factory service

### Webhook Infrastructure (`src/infrastructure/webhook/`)

- `webhook-delivery-provider.ts` - Webhook delivery provider
- `webhook-delivery.repository.impl.ts` - Webhook delivery repository implementation
- `webhook-http-client.ts` - Webhook HTTP client
- `webhook.repository.impl.ts` - Webhook repository implementation

### WebSocket Infrastructure (`src/infrastructure/websocket/`)

- `collaborative-editor.ts` - Collaborative editor
- `event-aggregator.ts` - Event aggregator
- `event-broadcaster.ts` - Event broadcaster
- `index.ts` - WebSocket exports
- `presence-tracker.ts` - Presence tracker
- `version-control.ts` - Version control
- `websocket-authenticator.ts` - WebSocket authenticator
- `websocket-connection-manager.ts` - WebSocket connection manager
- `websocket-connection.ts` - WebSocket connection
- `websocket-health-monitor.ts` - WebSocket health monitor
- `websocket-message-handler.ts` - WebSocket message handler
- `websocket-metrics.ts` - WebSocket metrics
- `websocket-server.ts` - WebSocket server

## Jobs (`src/jobs/`)

- `index.ts` - Jobs exports
- `calendar-reminders.job.ts` - Calendar reminders job
- `recurring-tasks.job.ts` - Recurring tasks job
- `task-notifications.job.ts` - Task notifications job
- `webhook-delivery.job.ts` - Webhook delivery job

## Localization (`src/locales/`)

### Language Files

- `de/translation.json` - German translations
- `en/translation.json` - English translations
- `es/translation.json` - Spanish translations
- `fr/translation.json` - French translations
- `zh/translation.json` - Chinese translations

## Presentation Layer (`src/presentation/`)

### Controllers (`src/presentation/controllers/`)

- `index.ts` - Controllers exports
- `base.controller.ts` - Base controller class
- `activity.controller.ts` - Activity controller
- `analytics.controller.ts` - Analytics controller
- `attachment.controller.ts` - Attachment controller
- `auth.controller.ts` - Authentication controller
- `calendar.controller.ts` - Calendar controller
- `comment.controller.ts` - Comment controller
- `dashboard.controller.ts` - Dashboard controller
- `enhanced-task.controller.ts` - Enhanced task controller
- `export-import.controller.ts` - Export/import controller
- `feedback.controller.ts` - Feedback controller
- `file-management.controller.ts` - File management controller
- `health.controller.ts` - Health check controller
- `invitation.controller.ts` - Invitation controller
- `monitoring.controller.ts` - Monitoring controller
- `notification.controller.ts` - Notification controller
- `performance.controller.ts` - Performance controller
- `presence.controller.ts` - Presence controller
- `project.controller.ts` - Project controller
- `recurring-task.controller.ts` - Recurring task controller
- `search.controller.ts` - Search controller
- `task-template.controller.ts` - Task template controller
- `task.controller.ts` - Task controller
- `team.controller.ts` - Team controller
- `user.controller.ts` - User controller
- `webhook.controller.ts` - Webhook controller
- `workspace.controller.ts` - Workspace controller

### Middleware (`src/presentation/middleware/`)

- `index.ts` - Middleware exports
- `README.md` - Middleware documentation
- `api-version.middleware.ts` - API versioning middleware
- `audit-log.middleware.ts` - Audit logging middleware
- `auth.middleware.ts` - Authentication middleware
- `auth.ts` - Authentication utilities
- `authentication.ts` - Authentication implementation
- `comprehensive-audit.middleware.ts` - Comprehensive audit middleware
- `comprehensive-logging.middleware.ts` - Comprehensive logging middleware
- `comprehensive-security.middleware.ts` - Comprehensive security middleware
- `enhanced-authentication.middleware.ts` - Enhanced authentication middleware
- `enhanced-error.middleware.ts` - Enhanced error handling middleware
- `enhanced-rate-limiter.middleware.ts` - Enhanced rate limiting middleware
- `error-handler.ts` - Error handler
- `error.middleware.ts` - Error middleware
- `errorHandler.ts` - Error handler implementation
- `i18n.middleware.ts` - Internationalization middleware
- `intelligent-rate-limiter.middleware.ts` - Intelligent rate limiter middleware
- `ioc-scope.middleware.ts` - IoC scope middleware
- `metrics.middleware.ts` - Metrics middleware
- `middleware-stack.ts` - Middleware stack
- `notFoundHandler.ts` - Not found handler
- `rate-limiter.middleware.ts` - Rate limiter middleware
- `security.middleware.ts` - Security middleware
- `unified-auth.middleware.ts` - Unified authentication middleware
- `unified-authentication.middleware.ts` - Unified authentication implementation
- `upload.middleware.ts` - File upload middleware
- `validate.middleware.ts` - Validation middleware
- `zod-validation.middleware.ts` - Zod validation middleware

### Routes (`src/presentation/routes/`)

- `index.ts` - Routes exports
- `activity.routes.ts` - Activity routes
- `analytics.routes.ts` - Analytics routes
- `auth.routes.ts` - Authentication routes
- `calendar.routes.ts` - Calendar routes
- `comment.routes.ts` - Comment routes
- `dashboard.routes.ts` - Dashboard routes
- `enhanced-task.routes.ts` - Enhanced task routes
- `export-import.routes.ts` - Export/import routes
- `feedback.routes.ts` - Feedback routes
- `file-management.routes.ts` - File management routes
- `health.routes.ts` - Health check routes
- `invitation.routes.ts` - Invitation routes
- `metrics.routes.ts` - Metrics routes
- `monitoring.routes.ts` - Monitoring routes
- `notification.routes.ts` - Notification routes
- `performance.routes.ts` - Performance routes
- `presence.routes.ts` - Presence routes
- `project.routes.ts` - Project routes
- `recurring-task.routes.ts` - Recurring task routes
- `search.routes.ts` - Search routes
- `task-template.routes.ts` - Task template routes
- `task.routes.ts` - Task routes
- `team.routes.ts` - Team routes
- `unified-auth.routes.ts` - Unified authentication routes
- `user.routes.ts` - User routes
- `webhook.routes.ts` - Webhook routes
- `workspace.routes.ts` - Workspace routes

### Validators (`src/presentation/validators/`)

- `index.ts` - Validators exports
- `activity.validator.ts` - Activity validator
- `auth.validator.ts` - Authentication validator
- `calendar-event.validator.ts` - Calendar event validator
- `calendar.validator.ts` - Calendar validator
- `comment.validator.ts` - Comment validator
- `common.validator.ts` - Common validators
- `feedback.validator.ts` - Feedback validator
- `invitation.validator.ts` - Invitation validator
- `notification.validator.ts` - Notification validator
- `project.validator.ts` - Project validator
- `recurring-task.validator.ts` - Recurring task validator
- `search.validator.ts` - Search validator
- `task-template.validator.ts` - Task template validator
- `task.validator.ts` - Task validator
- `team.validator.ts` - Team validator
- `unified-auth.validators.ts` - Unified authentication validators
- `webhook.validator.ts` - Webhook validator
- `workspace.validator.ts` - Workspace validator

## Utilities (`src/utils/`)

- `api-features.ts` - API feature utilities
- `app-error.ts` - Application error utilities
- `async-handler.ts` - Async handler utilities
- `cache.ts` - Cache utilities
- `logger.ts` - Logger utilities
- `performance-monitor.ts` - Performance monitoring utilities
- `response-formatter.ts` - Response formatting utilities
- `swagger.ts` - Swagger utilities

## Kiro Configuration (`.kiro/`)

### Specifications (`.kiro/specs/`)

#### Enterprise Platform Unification Spec

- `enterprise-platform-unification/design.md` - Design document
- `enterprise-platform-unification/requirements.md` - Requirements document
- `enterprise-platform-unification/tasks.md` - Task list

## Architecture Summary

This project demonstrates a sophisticated enterprise-grade architecture with:

### Key Architectural Patterns

1. **Domain-Driven Design (DDD)** - Clear domain boundaries and rich domain models
2. **Clean Architecture** - Separation of concerns across layers
3. **CQRS (Command Query Responsibility Segregation)** - Separate read and write operations
4. **Event-Driven Architecture** - Domain events and integration events
5. **Repository Pattern** - Data access abstraction
6. **Dependency Injection** - IoC container for loose coupling
7. **Microservices-Ready** - Modular structure supporting distributed architecture

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Database**: PostgreSQL with Prisma and Drizzle ORM
- **Caching**: Redis
- **Authentication**: Passport.js with OAuth and WebAuthn support
- **API Documentation**: Swagger/OpenAPI
- **Testing**: Vitest
- **Containerization**: Docker with multi-environment support
- **Monitoring**: Prometheus integration
- **Internationalization**: Multi-language support (EN, DE, ES, FR, ZH)

### Domain Capabilities

- **Task Management**: Comprehensive task, project, and workspace management
- **Authentication & Authorization**: Multi-factor authentication, RBAC, OAuth
- **Calendar Integration**: Google Calendar and other provider integrations
- **File Management**: File storage, virus scanning, version control
- **Search**: Advanced search with indexing and filtering
- **Notifications**: Multi-channel notification system
- **Analytics**: Activity tracking and productivity analytics
- **Webhooks**: Event-driven integrations
- **Real-time Features**: WebSocket support for collaboration
- **Monitoring**: Health checks, metrics, and alerting

This architecture provides a solid foundation for a scalable, maintainable enterprise task management platform with extensive integration capabilities and modern development practices.
