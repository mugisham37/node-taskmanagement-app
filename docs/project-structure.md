Complete Task Management Application Project Structure
Root Directory
.env
.env.example
.eslintrc.js
.gitignore
.prettierrc
docker-compose.production.yml
docker-compose.test.yml
docker-compose.yml
Dockerfile.dev
Dockerfile.test
package-lock.json
package.json
tsconfig.json
vitest.config.ts
Configuration (/config)
config/
├── development.json
├── nginx-production.conf
├── production.json
├── prometheus-production.yml
├── redis-production.conf
├── staging.json
└── test.json
Documentation (/docs)
docs/
└── project-structure.md
Scripts (/scripts)
scripts/
├── check-setup.ts
├── dev-setup.ts
├── init-extensions.sql
├── init-test-db.sql
├── migrate.ts
├── phase1-summary.md
├── reset.ts
├── run-tests.ts
├── seed.ts
├── setup-database.ts
├── setup-environment.ts
├── test-db.ts
├── validate-configuration.ts
└── verify-setup.ts
Source Code (/src)
Main Application Files
src/
├── app.ts
├── index.ts
└── server.ts
Application Layer (/src/application)
src/application/
├── index.ts
├── README.md
├── coordination/                           (empty)
├── cqrs/
│   ├── command-bus.ts
│   ├── command.ts
│   ├── cqrs-factory.ts
│   ├── index.ts
│   ├── query-bus.ts
│   ├── query.ts
│   ├── commands/
│   │   └── task-commands.ts
│   ├── handlers/
│   │   ├── task-command-handlers.ts
│   │   └── task-query-handlers.ts
│   ├── queries/
│   │   └── task-queries.ts
│   └── validation/
│       ├── command-validator.ts
│       └── query-validator.ts
├── decorators/
│   └── injectable.ts
├── events/
│   ├── domain-event-bus.ts
│   ├── event-handler-registry.ts
│   └── handlers/
│       ├── integration-event-handlers.ts
│       └── task-event-handlers.ts
├── mappers/                                (empty)
├── policies/                               (empty)
├── services/
│   ├── auth                                (file, not directory)
│   ├── authentication.service.interface.ts
│   ├── base.application.service.ts
│   ├── index.ts
│   ├── rate-limit.service.interface.ts
│   ├── analytics/
│   │   ├── activity.service.ts
│   │   ├── ActivityTrackingService.ts
│   │   ├── analytics.service.ts
│   │   ├── dashboard.service.ts
│   │   ├── DataExportService.ts
│   │   ├── MetricsCollectionService.ts
│   │   └── ProductivityAnalyticsService.ts
│   ├── audit/
│   │   ├── activity-service.ts
│   │   ├── audit.service.ts
│   │   └── index.ts
│   ├── authentication/                     (empty)
│   ├── calendar/
│   │   ├── calendar-event-domain.service.ts
│   │   ├── calendar-event.application.service.ts
│   │   ├── calendar-event.service.ts
│   │   ├── calendar-integration.application.service.ts
│   │   ├── calendar.service.ts
│   │   ├── google-calendar-integration.service.ts
│   │   ├── index.ts
│   │   └── task-calendar-sync.service.ts
│   ├── collaboration/
│   │   ├── comment.service.ts
│   │   ├── file-collaboration.service.ts
│   │   └── presence.service.ts
│   ├── data-import-export/                 (empty)
│   ├── feedback/
│   │   └── feedback.service.ts
│   ├── file-management/                    (empty)
│   ├── import-export/
│   │   └── data-import-export.service.ts
│   ├── notification/
│   │   ├── email-preference.service.ts
│   │   ├── email-template.service.ts
│   │   ├── email.service.ts
│   │   ├── notification-analytics.service.ts
│   │   ├── notification-delivery.service.ts
│   │   ├── notification-queue.service.ts
│   │   ├── notification-template.service.ts
│   │   ├── notification.service.ts
│   │   ├── push-notification.service.ts
│   │   └── unified-notification.service.ts
│   ├── real-time/                          (empty)
│   ├── search/
│   │   ├── advanced-filtering.service.ts
│   │   ├── cross-entity-search.service.ts
│   │   ├── search-indexing.service.ts
│   │   ├── search-query.service.ts
│   │   └── search.service.ts
│   ├── system-monitoring/
│   │   ├── index.ts
│   │   ├── monitoring-bootstrap.service.ts
│   │   ├── monitoring-dashboard.service.ts
│   │   └── system-monitoring.service.ts
│   ├── task-management/
│   │   ├── invitation.service.ts
│   │   ├── ProjectDomainService.ts
│   │   ├── ProjectService.ts
│   │   ├── ProjectTemplateService.ts
│   │   ├── recurring-task.service.ts
│   │   ├── task-management.domain-service.ts
│   │   ├── task-template.service.ts
│   │   ├── TaskDomainService.ts
│   │   ├── TaskFilterService.ts
│   │   ├── TaskService.ts
│   │   ├── TeamCommunicationService.ts
│   │   ├── TeamService.ts
│   │   ├── WorkspaceBillingService.ts
│   │   ├── WorkspaceContextService.ts
│   │   ├── WorkspacePermissionService.ts
│   │   └── WorkspaceService.ts
│   ├── webhook/
│   │   ├── webhook-analytics.service.ts
│   │   ├── webhook-delivery.service.impl.ts
│   │   ├── webhook-delivery.service.ts
│   │   ├── webhook-event-dispatcher.service.impl.ts
│   │   ├── webhook-event-dispatcher.service.ts
│   │   ├── webhook-management.service.impl.ts
│   │   ├── webhook-management.service.ts
│   │   └── webhook-testing.service.ts
│   └── websocket/
│       ├── websocket.service!.ts
│       └── websocket.service.ts
├── use-cases/
│   ├── task-use-cases.ts
│   ├── analytics/                          (empty)
│   ├── audit/                              (empty)
│   ├── authentication/                     (empty)
│   ├── calendar/                           (empty)
│   ├── collaboration/                      (empty)
│   ├── data-import-export/                 (empty)
│   ├── feedback/                           (empty)
│   ├── file-management/                    (empty)
│   ├── notification/                       (empty)
│   ├── real-time/                          (empty)
│   ├── search/                             (empty)
│   ├── system-monitoring/                  (empty)
│   ├── task-management/                    (empty)
│   └── webhook/                            (empty)
└── validation/                             (empty)
Documentation (/src/docs)
src/docs/
├── openapi-generator.ts
└── task-api-docs.ts
Domain Layer (/src/domain)
src/domain/
├── index.ts
├── aggregates/
│   ├── base.aggregate.ts
│   ├── auth/                               (empty)
│   ├── calendar/                           (empty)
│   ├── notification/                       (empty)
│   └── task-management/                    (empty)
├── entities/
│   ├── analytics/
│   │   ├── ActivityTrackingEntity.ts
│   │   └── MetricsEntity.ts
│   ├── audit/
│   │   └── audit-log.entity.ts
│   ├── authentication/
│   │   ├── Account.ts
│   │   ├── Device.ts
│   │   ├── Permission.ts
│   │   ├── Role.ts
│   │   ├── Session.ts
│   │   ├── User.ts
│   │   └── WebAuthnCredential.ts
│   ├── calendar/
│   │   ├── calendar-event.entity.ts
│   │   └── calendar-integration.entity.ts
│   ├── file-management/
│   │   ├── attachment.entity.ts
│   │   └── file.entity.ts
│   ├── notification/
│   │   ├── notification-preferences.entity.ts
│   │   ├── notification-template.entity.ts
│   │   └── notification.entity.ts
│   ├── search/
│   │   ├── saved-search.entity.ts
│   │   └── search-index.entity.ts
│   ├── task-management/
│   │   ├── Project.ts
│   │   ├── RecurringTask.ts
│   │   ├── Task.ts
│   │   ├── TaskTemplate.ts
│   │   ├── Team.ts
│   │   └── Workspace.ts
│   └── webhook/
│       ├── webhook-delivery.entity.ts
│       └── webhook.entity.ts
├── events/
│   ├── auth/                               (empty)
│   ├── calender/
│   │   ├── calendar-event-created.event.ts
│   │   ├── calendar-event-deleted.event.ts
│   │   ├── calendar-event-updated.event.ts
│   │   ├── calendar-integration-created.event.ts
│   │   ├── calendar-integration-deleted.event.ts
│   │   └── calendar-integration-updated.event.ts
│   └── task-management/
│       ├── task-events.ts
│       └── TaskEventHandlers.ts
├── factories/                              (empty)
├── repositories/
│   ├── analytics/
│   │   ├── IActivityTrackingRepository.ts
│   │   └── IMetricsRepository.ts
│   ├── audit/
│   │   └── audit.repository.ts
│   ├── authentication/
│   │   ├── IUserRepository.ts
│   │   ├── session.repository.interface.ts
│   │   └── user.repository.interface.ts
│   ├── calender/
│   │   ├── calendar-event.repository.impl.ts
│   │   ├── calendar-event.repository.ts
│   │   └── calendar-integration.repository.ts
│   ├── collaboration/
│   │   └── comment.repository.ts
│   ├── file-management/
│   │   ├── file.repository.ts
│   │   └── prisma-file.repository.ts
│   ├── notification/
│   │   ├── notification-preferences.repository.ts
│   │   ├── notification-template.repository.ts
│   │   └── notification.repository.ts
│   ├── search/
│   │   ├── postgresql-saved-search.repository.ts
│   │   ├── postgresql-search-index.repository.ts
│   │   ├── saved-search.repository.ts
│   │   └── search-index.repository.ts
│   ├── task-management/
│   │   ├── IProjectRepository.ts
│   │   ├── ITaskRepository.ts
│   │   ├── IWorkspaceRepository.ts
│   │   ├── project.repository.impl.ts
│   │   ├── project.repository.interface.ts
│   │   ├── ProjectMemberRepository.ts
│   │   ├── ProjectRepository.ts
│   │   ├── task.repository.impl.ts
│   │   ├── task.repository.interface.ts
│   │   ├── TaskRepository.ts
│   │   ├── TeamRepository.ts
│   │   ├── WorkspaceMemberRepository.ts
│   │   └── WorkspaceRepository.ts
│   └── webhook/
│       ├── webhook-delivery-provider.ts
│       ├── webhook-delivery.repository.impl.ts
│       ├── webhook-delivery.repository.ts
│       ├── webhook-http-client.ts
│       ├── webhook.repository.impl.ts
│       └── webhook.repository.ts
├── schemas/
│   ├── analytics/
│   │   └── activities.ts
│   ├── audit/
│   │   └── audit-logs.ts
│   ├── authentication/
│   │   └── users.ts
│   ├── calender/
│   │   ├── calendar-events.ts
│   │   └── calendar-integrations.ts
│   ├── collaboration/
│   │   └── comments.ts
│   ├── notification/
│   │   └── notifications.ts
│   └── webhook/
│       └── webhooks.ts
├── specifications/
│   ├── auth/                               (empty)
│   └── task-management/
│       ├── ProjectSpecifications.ts
│       ├── task-specifications.ts
│       └── TaskSpecifications.ts
├── validators/
│   ├── analytics/
│   │   └── activity.validator.ts
│   ├── authentication/
│   │   ├── auth.validator.ts
│   │   └── unified-auth.validators.ts
│   ├── calender/
│   │   ├── calendar-event.validator.ts
│   │   ├── calendar.validator.ts
│   │   └── index.ts
│   ├── collaboration/
│   │   └── comment.validator.ts
│   ├── file-management/
│   │   ├── attachment.validator.ts
│   │   └── file-management.validator.ts
│   ├── notification/
│   │   └── notification.validator.ts
│   ├── search/
│   │   └── search.validator.ts
│   ├── task-management/
│   │   ├── invitation.validator.ts
│   │   ├── project.validator.ts
│   │   ├── recurring-task.validator.ts
│   │   ├── task-template.validator.ts
│   │   ├── task.validator.ts
│   │   ├── team.validator.ts
│   │   └── workspace.validator.ts
│   └── webhook/
│       └── webhook.validator.ts
└── value-objects/
    ├── analytics/
    │   ├── ActivityTypes.ts
    │   └── MetricTypes.ts
    ├── audit/
    │   ├── audit-context.ts
    │   └── entity-reference.ts
    ├── authentication/
    │   ├── AccountId.ts
    │   ├── DeviceId.ts
    │   ├── Email.ts
    │   ├── RoleId.ts
    │   ├── SessionId.ts
    │   ├── UserId.ts
    │   └── WebAuthnCredentialId.ts
    ├── calender/
    │   ├── access-token.vo.ts
    │   ├── calendar-event-id.vo.ts
    │   ├── calendar-integration-id.vo.ts
    │   ├── calendar-name.vo.ts
    │   ├── calendar-provider.vo.ts
    │   ├── event-color.vo.ts
    │   ├── event-datetime.vo.ts
    │   ├── event-description.vo.ts
    │   ├── event-location.vo.ts
    │   ├── event-title.vo.ts
    │   ├── recurrence-rule.vo.ts
    │   └── refresh-token.vo.ts
    ├── common/                             (empty)
    ├── file-management/
    │   ├── file-access-control.vo.ts
    │   ├── file-metadata.vo.ts
    │   └── file-version.vo.ts
    ├── notification/
    │   ├── notification-channel.ts
    │   ├── notification-id.ts
    │   ├── notification-preferences-id.ts
    │   ├── notification-priority.ts
    │   ├── notification-status.ts
    │   ├── notification-template-id.ts
    │   └── notification-type.ts
    ├── search/
    │   ├── search-query.vo.ts
    │   └── search-result.vo.ts
    ├── task-management/
    │   ├── Priority.ts
    │   ├── project-id.ts
    │   ├── ProjectId.ts
    │   ├── ProjectStatus.ts
    │   ├── task-id.ts
    │   ├── task-status.ts
    │   ├── TaskId.ts
    │   ├── TaskStatus.ts
    │   ├── TeamId.ts
    │   ├── workspace-id.ts
    │   └── WorkspaceId.ts
    └── webhook/
        ├── webhook-delivery-id.ts
        ├── webhook-delivery-status.ts
        ├── webhook-event.ts
        ├── webhook-id.ts
        ├── webhook-secret.ts
        ├── webhook-status.ts
        └── webhook-url.ts
Infrastructure Layer (/src/infrastructure)
src/infrastructure/
├── bootstrap.ts
├── index.ts
├── backup/
│   ├── backup-system.ts
│   └── comprehensive-backup-system.ts
├── cache/                                  (empty)
├── caching/
│   ├── cache-manager.ts
│   ├── consolidated-cache-manager.ts
│   ├── index.ts
│   └── redis-client.ts
├── config/                                 (empty)
├── database/                               (empty)
├── email/                                  (empty)
├── events/
│   ├── event-system-factory.ts
│   └── event-system-integration.test.ts
├── external-apis/
│   └── google-calendar-api.client.ts
├── external-services/
│   ├── circuit-breaker.ts
│   ├── consolidated-email-service.ts
│   ├── consolidated-file-storage-service.ts
│   ├── index.ts
│   ├── service-factory.ts
│   ├── analytics/                          (empty)
│   ├── audit/                              (empty)
│   ├── authentication/                     (empty)
│   ├── calendar/                           (empty)
│   ├── collaboration/                      (empty)
│   ├── data-import-export/                 (empty)
│   ├── email/
│   │   ├── email-delivery-provider.ts
│   │   └── email-service.ts
│   ├── feedback/                           (empty)
│   ├── file-management/                    (empty)
│   ├── notification/                       (empty)
│   ├── real-time/                          (empty)
│   ├── search/                             (empty)
│   ├── storage/
│   │   ├── azure-blob-storage.service.ts
│   │   ├── clamav-scanner.service.ts
│   │   ├── enhanced-clamav-scanner.service.ts
│   │   ├── enhanced-local-storage.service.ts
│   │   ├── local-storage.service.ts
│   │   ├── s3-storage.service.ts
│   │   └── storage-factory.service.ts
│   ├── system-monitoring/                  (empty)
│   ├── task-management/                    (empty)
│   └── webhook/                            (empty)
├── integration/
│   └── phase12-integration-service.ts
├── ioc/
│   ├── bootstrap.ts
│   ├── container.ts
│   ├── decorators.ts
│   ├── index.ts
│   ├── README.md
│   ├── service-factory.ts
│   ├── service-locator.ts
│   ├── service-registry.ts
│   └── examples/
│       └── usage-examples.ts
├── logging/
│   ├── consolidated-logger.ts
│   ├── index.ts
│   └── logger.ts
├── messaging/                              (empty)
├── monitoring/
│   ├── alerting.service.ts
│   ├── health-check.service.ts
│   ├── index.ts
│   ├── metrics.service.ts
│   ├── observability-dashboard.ts
│   ├── performance-monitor.ts
│   └── README.md
├── performance/
│   ├── api-optimizer.ts
│   ├── performance-integration.ts
│   └── performance-optimization-service.ts
├── persistence/
│   ├── database/
│   │   ├── base-repository.ts
│   │   ├── connection-pool-manager.ts
│   │   ├── data-consistency-manager.ts
│   │   ├── database-connection-manager.ts
│   │   ├── health-check.ts
│   │   ├── index.ts
│   │   ├── migration-system.ts
│   │   ├── migration-utils.ts
│   │   ├── prisma-client.ts
│   │   ├── query-optimizer.ts
│   │   ├── referential-integrity.ts
│   │   ├── transaction-manager.ts
│   │   ├── unit-of-work.ts
│   │   ├── drizzle/
│   │   │   ├── connection.ts
│   │   │   ├── health.ts
│   │   │   ├── index.ts
│   │   │   ├── README.md
│   │   │   ├── setup.ts
│   │   │   ├── migrations/
│   │   │   │   ├── 0000_glorious_scalphunter.sql
│   │   │   │   ├── 0001_add_project_status.sql
│   │   │   │   ├── migration-runner.ts
│   │   │   │   └── meta/
│   │   │   │       ├── 0000_snapshot.json
│   │   │   │       └── _journal.json
│   │   │   ├── repositories/
│   │   │   │   ├── index.ts
│   │   │   │   ├── README.md
│   │   │   │   └── base/
│   │   │   │       ├── base.repository.ts
│   │   │   │       ├── interfaces.ts
│   │   │   │       └── types.ts
│   │   │   └── schema/
│   │   │       └── index.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   │   ├── 001_add_search_tables.sql
│   │   │   │   ├── 001_add_webhook_tables.sql
│   │   │   │   ├── add_comprehensive_constraints.sql
│   │   │   │   └── add_comprehensive_indexes.sql
│   │   │   └── seeds/
│   │   │       └── comprehensive-seed.ts
│   │   ├── schemas/
│   │   │   └── common.schemas.ts
│   │   └── seeds/
│   │       └── index.ts
│   └── repositories/
│       └── task-management/
│           ├── IProjectRepository.ts
│           ├── ITaskRepository.ts
│           ├── IWorkspaceRepository.ts
│           ├── project.repository.impl.ts
│           ├── ProjectMemberRepository.ts
│           ├── ProjectRepository.ts
│           ├── task.repository.impl.ts
│           ├── TaskRepository.ts
│           ├── TeamRepository.ts
│           ├── WorkspaceMemberRepository.ts
│           └── WorkspaceRepository.ts
├── push/
│   └── push-delivery-provider.ts
├── repositories/
│   ├── index.ts
│   ├── analytics/                          (empty)
│   ├── audit/                              (empty)
│   ├── authentication/
│   │   ├── index.ts
│   │   └── user.repository.ts
│   ├── calendar/
│   │   ├── calendar-event.repository.ts
│   │   └── index.ts
│   ├── collaboration/                      (empty)
│   ├── data-import-export/                 (empty)
│   ├── feedback/                           (empty)
│   ├── file-management/                    (empty)
│   ├── notification/                       (empty)
│   ├── real-time/                          (empty)
│   ├── search/                             (empty)
│   ├── system-monitoring/                  (empty)
│   ├── task-management/
│   │   ├── index.ts
│   │   └── task.repository.ts
│   └── webhook/                            (empty)
├── resilience/
│   └── circuit-breaker.ts
├── scaling/
│   ├── horizontal-scaling-manager.ts
│   └── load-balancer.ts
├── search/                                 (empty)
├── security/
│   ├── index.ts
│   ├── jwt-service.ts
│   ├── mfa-service.ts
│   ├── password-service.ts
│   ├── rate-limiter.ts
│   └── security-monitor.ts
├── server/
│   └── fastify-server.ts
└── storage/                                (empty)
Jobs (/src/jobs)
src/jobs/
├── calendar-reminders.job.ts
├── index.ts
├── recurring-tasks.job.ts
├── task-notifications.job.ts
└── webhook-delivery.job.ts
Localization (/src/locales)
src/locales/
├── de/
│   └── translation.json
├── en/
│   └── translation.json
├── es/
│   └── translation.json
├── fr/
│   └── translation.json
└── zh/
    └── translation.json
Presentation Layer (/src/presentation)
src/presentation/
├── index.ts
├── README.md
├── api/
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── enhanced-task.controller.ts
│   │   ├── invitation.controller.ts
│   │   ├── project.controller.ts
│   │   ├── recurring-task.controller.ts
│   │   ├── task-template.controller.ts
│   │   ├── task.controller.ts
│   │   ├── team.controller.ts
│   │   ├── user.controller.ts
│   │   └── workspace.controller.ts
│   ├── dto/
│   │   └── request/
│   │       ├── audit-logs.ts
│   │       ├── auth.validator.ts
│   │       ├── calendar-event.validator.ts
│   │       ├── calendar-events.ts
│   │       ├── calendar-integrations.ts
│   │       ├── calendar.validator.ts
│   │       ├── comment.validator.ts
│   │       ├── comments.ts
│   │       ├── index.ts
│   │       ├── invitation.validator.ts
│   │       ├── notification.validator.ts
│   │       ├── notifications.ts
│   │       ├── project.validator.ts
│   │       ├── recurring-task.validator.ts
│   │       ├── search.validator.ts
│   │       ├── task-template.validator.ts
│   │       ├── task.validator.ts
│   │       ├── team.validator.ts
│   │       ├── unified-auth.validators.ts
│   │       ├── users.ts
│   │       ├── webhook.validator.ts
│   │       ├── webhooks.ts
│   │       └── workspace.validator.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── rate-limiter.middleware.ts
│   │   └── validation.middleware.ts
│   └── routes/
│       ├── auth.routes.ts
│       ├── enhanced-task.routes.ts
│       ├── invitation.routes.ts
│       ├── project.routes.ts
│       ├── recurring-task.routes.ts
│       ├── task-template.routes.ts
│       ├── task.routes.ts
│       ├── team.routes.ts
│       ├── unified-auth.routes.ts
│       ├── user.routes.ts
│       └── workspace.routes.ts
├── controllers/
│   ├── base.controller.ts
│   ├── index.ts
│   ├── analytics/
│   │   ├── activity.controller.ts
│   │   ├── analytics.controller.ts
│   │   └── dashboard.controller.ts
│   ├── audit/                              (empty)
│   ├── authentication/
│   │   ├── auth.controller.ts
│   │   └── user.controller.ts
│   ├── calendar/
│   │   └── calendar.controller.ts
│   ├── collaboration/
│   │   ├── comment.controller.ts
│   │   └── presence.controller.ts
│   ├── data-import-export/                 (empty)
│   ├── feedback/                           (empty)
│   ├── file-management/
│   │   ├── attachment.controller.ts
│   │   └── file-management.controller.ts
│   ├── notification/
│   │   └── notification.controller.ts
│   ├── real-time/                          (empty)
│   ├── search/
│   │   └── search.controller.ts
│   ├── system-monitoring/
│   │   ├── health.controller.ts
│   │   ├── monitoring.controller.ts
│   │   └── performance.controller.ts
│   ├── task-management/
│   │   ├── enhanced-task.controller.ts
│   │   ├── invitation.controller.ts
│   │   ├── project.controller.ts
│   │   ├── recurring-task.controller.ts
│   │   ├── task-template.controller.ts
│   │   ├── task.controller.ts
│   │   ├── team.controller.ts
│   │   └── workspace.controller.ts
│   └── webhook/
│       └── webhook.controller.ts
├── dtos/
│   ├── base.dto.ts
│   ├── common.dto.ts
│   ├── index.ts
│   ├── analytics/                          (empty)
│   ├── audit/                              (empty)
│   ├── authentication/                     (empty)
│   ├── calendar/                           (empty)
│   ├── collaboration/                      (empty)
│   ├── data-import-export/                 (empty)
│   ├── feedback/                           (empty)
│   ├── file-management/                    (empty)
│   ├── notification/                       (empty)
│   ├── real-time/                          (empty)
│   ├── search/                             (empty)
│   ├── system-monitoring/                  (empty)
│   ├── task-management/                    (empty)
│   └── webhook/                            (empty)
├── middleware/
│   ├── api-version.middleware.ts
│   ├── audit-log.middleware.ts
│   ├── auth.middleware.ts
│   ├── auth.ts
│   ├── authentication.ts
│   ├── comprehensive-audit.middleware.ts
│   ├── comprehensive-logging.middleware.ts
│   ├── comprehensive-security.middleware.ts
│   ├── enhanced-authentication.middleware.ts
│   ├── enhanced-error.middleware.ts
│   ├── enhanced-rate-limiter.middleware.ts
│   ├── error-handler.ts
│   ├── error.middleware.ts
│   ├── errorHandler.ts
│   ├── i18n.middleware.ts
│   ├── index.ts
│   ├── intelligent-rate-limiter.middleware.ts
│   ├── ioc-scope.middleware.ts
│   ├── metrics.middleware.ts
│   ├── middleware-stack.ts
│   ├── notFoundHandler.ts
│   ├── rate-limit.middleware.ts
│   ├── rate-limiter.middleware.ts
│   ├── README.md
│   ├── security.middleware.ts
│   ├── unified-auth.middleware.ts
│   ├── unified-authentication.middleware.ts
│   ├── upload.middleware.ts
│   ├── validate.middleware.ts
│   ├── validation.middleware.ts
│   └── zod-validation.middleware.ts
├── routes/
│   ├── index.ts
│   ├── route.types.ts
│   ├── analytics/
│   │   ├── activity.routes.ts
│   │   ├── analytics.routes.ts
│   │   └── dashboard.routes.ts
│   ├── audit/                              (empty)
│   ├── authentication/
│   │   ├── auth.routes.ts
│   │   ├── unified-auth.routes.ts
│   │   └── user.routes.ts
│   ├── calendar/
│   │   └── calendar.routes.ts
│   ├── collaboration/
│   │   ├── comment.routes.ts
│   │   └── presence.routes.ts
│   ├── data-import-export/                 (empty)
│   ├── feedback/                           (empty)
│   ├── file-management/                    (empty)
│   ├── notification/
│   │   └── notification.routes.ts
│   ├── real-time/                          (empty)
│   ├── search/
│   │   └── search.routes.ts
│   ├── system-monitoring/
│   │   ├── health.routes.ts
│   │   ├── metrics.routes.ts
│   │   ├── monitoring.routes.ts
│   │   └── performance.routes.ts
│   ├── task-management/
│   │   ├── enhanced-task.routes.ts
│   │   ├── invitation.routes.ts
│   │   ├── project.routes.ts
│   │   ├── recurring-task.routes.ts
│   │   ├── task-template.routes.ts
│   │   ├── task.routes.ts
│   │   ├── team.routes.ts
│   │   └── workspace.routes.ts
│   └── webhook/
│       └── webhook.routes.ts
└── websocket/
    ├── base.gateway.ts
    ├── collaborative-editor.ts
    ├── event-aggregator.ts
    ├── event-broadcaster.ts
    ├── index.ts
    ├── presence-tracker.ts
    ├── version-control.ts
    ├── websocket-authenticator.ts
    ├── websocket-connection-manager.ts
    ├── websocket-connection.ts
    ├── websocket-health-monitor.ts
    ├── websocket-message-handler.ts
    ├── websocket-metrics.ts
    ├── websocket-server.ts
    └── websocket.types.ts
Shared (/src/shared)
src/shared/
├── index.ts
├── config/
│   ├── configuration-manager.ts
│   ├── database.ts
│   ├── environment.ts
│   ├── feature-flags.ts
│   ├── i18n.ts
│   ├── index.ts
│   ├── logger.ts
│   ├── passport.ts
│   ├── service-discovery.ts
│   └── swagger.ts
├── constants/
│   ├── app.constants.ts
│   ├── error.constants.ts
│   └── index.ts
├── decorators/
│   ├── index.ts
│   ├── logging.decorator.ts
│   └── validation.decorator.ts
├── domain/
│   ├── aggregate-root.ts
│   ├── base-entity.ts
│   ├── domain-event-publisher.ts
│   ├── domain-event.ts
│   ├── domain-service.ts
│   ├── entity.ts
│   ├── index.ts
│   ├── repository.ts
│   ├── specification.ts
│   ├── value-object.ts
│   ├── domain/
│   │   ├── base-entity.ts
│   │   ├── base-service.ts
│   │   ├── domain-event.ts
│   │   ├── event-bus.ts
│   │   ├── index.ts
│   │   ├── optimistic-locking.ts
│   │   ├── repository.ts
│   │   └── value-object.ts
│   ├── entities/
│   │   ├── base.entity.ts
│   │   └── BaseEntity.ts
│   ├── errors/
│   │   ├── app-error.ts
│   │   ├── app-errors.ts
│   │   ├── base.error.ts
│   │   ├── domain-error.ts
│   │   ├── DomainError.ts
│   │   └── index.ts
│   ├── events/
│   │   ├── domain-event-bus.ts
│   │   ├── domain-event.interface.ts
│   │   ├── domain-event.ts
│   │   ├── DomainEvent.ts
│   │   ├── DomainEventBus.ts
│   │   ├── event-store.ts
│   │   ├── index.ts
│   │   ├── integration-event-bus.ts
│   │   ├── integration-event.ts
│   │   ├── README.md
│   │   ├── unified-event-system.ts
│   │   ├── webhook-delivery-service.ts
│   │   └── websocket-event-bus.ts
│   ├── interfaces/
│   │   └── logger.interface.ts
│   ├── repositories/
│   │   └── IRepository.ts
│   ├── services/
│   │   ├── BaseService.ts
│   │   └── domain-service.ts
│   ├── validation/
│   │   ├── validation-engine.ts
│   │   └── validator.ts
│   └── value-objects/
│       ├── Email.ts
│       ├── Phone.ts
│       ├── project-id.vo.ts
│       ├── task-id.vo.ts
│       ├── team-id.vo.ts
│       ├── user-id.vo.ts
│       ├── value-object.ts
│       ├── ValueObject.ts
│       └── workspace-id.vo.ts
├── enums/
│   ├── common.enums.ts
│   ├── index.ts
│   └── status.enum.ts
├── errors/                                 (empty)
├── guards/
│   ├── index.ts
│   └── validation.guards.ts
├── interfaces/
│   ├── event.interface.ts
│   ├── logger.interface.ts
│   └── repository.interface.ts
├── services/
│   └── base.service.ts
├── types/
│   ├── common.types.ts
│   ├── index.ts
│   ├── logger.interface.ts
│   └── validator.interface.ts
├── utils/
│   ├── api-features.ts
│   ├── app-error.ts
│   ├── async-handler.ts
│   ├── cache.ts
│   ├── date.utils.ts
│   ├── id.utils.ts
│   ├── index.ts
│   ├── logger.ts
│   ├── performance-monitor.ts
│   ├── response-formatter.ts
│   ├── swagger.ts
│   └── validation.utils.ts
└── validators/
    └── common.validator.ts
Summary
This is a comprehensive Node.js task management application with 486 files (excluding node_modules and .git), built using Clean Architecture principles with TypeScript. The project includes:

Clean Architecture layers: Application, Domain, Infrastructure, and Presentation
CQRS pattern implementation
Event-driven architecture with domain events
Multi-database support (Prisma and Drizzle)
Comprehensive testing setup with Vitest
Docker containerization for different environments
Internationalization support (5 languages)
WebSocket real-time features
Monitoring and observability systems
Security implementations (JWT, MFA, rate limiting)
File management and storage systems
Webhook delivery system
Calendar integration capabilities
Search and analytics features
The structure follows domain-driven design with clear separation of concerns and extensive feature coverage for a production-ready task management system.