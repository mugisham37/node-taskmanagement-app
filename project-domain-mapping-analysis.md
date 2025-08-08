# Project Domain Mapping Analysis

## Current Project Structure Analysis

### Identified Business Domains

Based on the analysis of the current project structure, the following 11 business domains have been identified:

1. **Analytics** - Activity tracking, dashboard, and analytics functionality
2. **Authentication** - User authentication, authorization, and user management
3. **Calendar** - Calendar events and integrations
4. **Collaboration** - Comments and presence functionality
5. **File Management** - File uploads, attachments, and storage
6. **Notification** - User notifications and messaging
7. **Search** - Search functionality and saved searches
8. **Task Management** - Tasks, projects, workspaces, teams, templates, recurring tasks, invitations
9. **Webhook** - Webhook management and delivery
10. **System Monitoring** - Health checks, performance monitoring, metrics
11. **Audit** - Audit logging and compliance

### Current vs Target Structure Mapping

#### Shared Resources (Moving to `src/shared/`)

**From `src/domain/shared/`** → **To `src/shared/domain/`**

- Base domain classes and interfaces
- Domain events
- Shared validation utilities
- Common error classes

**From `src/presentation/middleware/`** → **To `src/shared/middleware/`**

- 26 middleware files including authentication, rate limiting, error handling, security, etc.

**From `src/infrastructure/config/`** → **To `src/shared/config/`**

- Configuration management files (9 files)
- Environment setup
- Feature flags
- Service discovery

**From `src/utils/`** → **To `src/shared/utils/`**

- 8 utility files including response formatters, performance monitors, loggers, etc.

#### Domain-Specific File Distribution

### 1. Analytics Domain

**Controllers (3 files):**

- `src/presentation/controllers/analytics.controller.ts`
- `src/presentation/controllers/activity.controller.ts`
- `src/presentation/controllers/dashboard.controller.ts`

**Routes (3 files):**

- `src/presentation/routes/analytics.routes.ts`
- `src/presentation/routes/activity.routes.ts`
- `src/presentation/routes/dashboard.routes.ts`

**Validators (1 file):**

- `src/presentation/validators/activity.validator.ts`

**Services:**

- `src/domain/analytics/services/` (existing)

**Entities:**

- `src/domain/analytics/entities/` (existing)

**Repositories:**

- `src/domain/analytics/repositories/` (existing)
- `src/infrastructure/database/drizzle/repositories/activity.repository.ts`

**Schemas:**

- `src/infrastructure/database/drizzle/schema/activities.ts`

**Value Objects:**

- `src/domain/analytics/value-objects/` (existing)

### 2. Authentication Domain

**Controllers (2 files):**

- `src/presentation/controllers/auth.controller.ts`
- `src/presentation/controllers/user.controller.ts`

**Routes (3 files):**

- `src/presentation/routes/auth.routes.ts`
- `src/presentation/routes/user.routes.ts`
- `src/presentation/routes/unified-auth.routes.ts`

**Validators (2 files):**

- `src/presentation/validators/auth.validator.ts`
- `src/presentation/validators/unified-auth.validators.ts`

**Services:**

- `src/domain/authentication/services/` (existing)

**Entities:**

- `src/domain/authentication/entities/` (existing)

**Repositories:**

- `src/domain/authentication/repositories/` (existing)
- `src/infrastructure/database/drizzle/repositories/user.repository.ts`

**Schemas:**

- `src/infrastructure/database/drizzle/schema/users.ts`

**Value Objects:**

- `src/domain/authentication/value-objects/` (existing)

### 3. Calendar Domain

**Controllers (1 file):**

- `src/presentation/controllers/calendar.controller.ts`

**Routes (1 file):**

- `src/presentation/routes/calendar.routes.ts`

**Validators (2 files):**

- `src/presentation/validators/calendar.validator.ts`
- `src/presentation/validators/calendar-event.validator.ts`

**Services:**

- `src/domain/calendar/services/` (existing)
- `src/application/services/calendar-event.application.service.ts`
- `src/application/services/calendar-integration.application.service.ts`

**Entities:**

- `src/domain/calendar/entities/` (existing)

**Repositories:**

- `src/domain/calendar/repositories/` (existing)
- `src/infrastructure/repositories/calendar-event.repository.impl.ts`
- `src/infrastructure/database/drizzle/repositories/calendar-event.repository.ts`
- `src/infrastructure/database/drizzle/repositories/calendar-integration.repository.ts`

**Schemas:**

- `src/infrastructure/database/drizzle/schema/calendar-events.ts`
- `src/infrastructure/database/drizzle/schema/calendar-integrations.ts`

**Events:**

- `src/domain/calendar/events/` (existing)

**Value Objects:**

- `src/domain/calendar/value-objects/` (existing)

### 4. Collaboration Domain

**Controllers (2 files):**

- `src/presentation/controllers/comment.controller.ts`
- `src/presentation/controllers/presence.controller.ts`

**Routes (2 files):**

- `src/presentation/routes/comment.routes.ts`
- `src/presentation/routes/presence.routes.ts`

**Validators (1 file):**

- `src/presentation/validators/comment.validator.ts`

**Services:**

- `src/domain/collaboration/services/` (existing)

**Entities:**

- `src/domain/collaboration/entities/` (existing)

**Repositories:**

- `src/domain/collaboration/repositories/` (existing)
- `src/infrastructure/database/drizzle/repositories/comment.repository.ts`

**Schemas:**

- `src/infrastructure/database/drizzle/schema/comments.ts`

**Value Objects:**

- `src/domain/collaboration/value-objects/` (existing)

### 5. File Management Domain

**Controllers (2 files):**

- `src/presentation/controllers/file-management.controller.ts`
- `src/presentation/controllers/attachment.controller.ts`

**Routes (1 file):**

- `src/presentation/routes/file-management.routes.ts`

**Services:**

- `src/domain/file-management/services/` (existing)

**Entities:**

- `src/domain/file-management/entities/` (existing)

**Repositories:**

- `src/domain/file-management/repositories/` (existing)
- `src/infrastructure/repositories/prisma-file.repository.ts`

**Value Objects:**

- `src/domain/file-management/value-objects/` (existing)

### 6. Notification Domain

**Controllers (1 file):**

- `src/presentation/controllers/notification.controller.ts`

**Routes (1 file):**

- `src/presentation/routes/notification.routes.ts`

**Validators (1 file):**

- `src/presentation/validators/notification.validator.ts`

**Services:**

- `src/domain/notification/services/` (existing)
- `src/application/services/email.service.ts`

**Entities:**

- `src/domain/notification/entities/` (existing)

**Repositories:**

- `src/domain/notification/repositories/` (existing)
- `src/infrastructure/database/drizzle/repositories/notification.repository.ts`

**Schemas:**

- `src/infrastructure/database/drizzle/schema/notifications.ts`

**Value Objects:**

- `src/domain/notification/value-objects/` (existing)

### 7. Search Domain

**Controllers (1 file):**

- `src/presentation/controllers/search.controller.ts`

**Routes (1 file):**

- `src/presentation/routes/search.routes.ts`

**Validators (1 file):**

- `src/presentation/validators/search.validator.ts`

**Services:**

- `src/domain/search/services/` (existing)

**Entities:**

- `src/domain/search/entities/` (existing)

**Repositories:**

- `src/domain/search/repositories/` (existing)
- `src/infrastructure/search/postgresql-saved-search.repository.ts`
- `src/infrastructure/search/postgresql-search-index.repository.ts`

**Value Objects:**

- `src/domain/search/value-objects/` (existing)

### 8. Task Management Domain (Largest Domain)

**Controllers (8 files):**

- `src/presentation/controllers/task.controller.ts`
- `src/presentation/controllers/enhanced-task.controller.ts`
- `src/presentation/controllers/project.controller.ts`
- `src/presentation/controllers/workspace.controller.ts`
- `src/presentation/controllers/team.controller.ts`
- `src/presentation/controllers/task-template.controller.ts`
- `src/presentation/controllers/recurring-task.controller.ts`
- `src/presentation/controllers/invitation.controller.ts`

**Routes (8 files):**

- `src/presentation/routes/task.routes.ts`
- `src/presentation/routes/enhanced-task.routes.ts`
- `src/presentation/routes/project.routes.ts`
- `src/presentation/routes/workspace.routes.ts`
- `src/presentation/routes/team.routes.ts`
- `src/presentation/routes/task-template.routes.ts`
- `src/presentation/routes/recurring-task.routes.ts`
- `src/presentation/routes/invitation.routes.ts`

**Validators (7 files):**

- `src/presentation/validators/task.validator.ts`
- `src/presentation/validators/project.validator.ts`
- `src/presentation/validators/workspace.validator.ts`
- `src/presentation/validators/team.validator.ts`
- `src/presentation/validators/task-template.validator.ts`
- `src/presentation/validators/recurring-task.validator.ts`
- `src/presentation/validators/invitation.validator.ts`

**Services:**

- `src/domain/task-management/services/` (existing)
- Potential duplicates in `src/application/services/` to be consolidated

**Entities:**

- `src/domain/task-management/entities/` (existing)

**Repositories:**

- `src/domain/task-management/repositories/` (existing)
- `src/infrastructure/repositories/task.repository.impl.ts`
- `src/infrastructure/repositories/project.repository.impl.ts`
- `src/infrastructure/database/drizzle/repositories/task.repository.ts`
- `src/infrastructure/database/drizzle/repositories/project.repository.ts`
- `src/infrastructure/database/drizzle/repositories/workspace.repository.ts`
- `src/infrastructure/database/drizzle/repositories/team.repository.ts`
- `src/infrastructure/database/drizzle/repositories/task-template.repository.ts`
- `src/infrastructure/database/drizzle/repositories/recurring-task.repository.ts`
- `src/infrastructure/database/drizzle/repositories/invitation.repository.ts`

**Schemas:**

- `src/infrastructure/database/drizzle/schema/tasks.ts`
- `src/infrastructure/database/drizzle/schema/projects.ts`
- `src/infrastructure/database/drizzle/schema/workspaces.ts`
- `src/infrastructure/database/drizzle/schema/teams.ts`
- `src/infrastructure/database/drizzle/schema/task-templates.ts`
- `src/infrastructure/database/drizzle/schema/recurring-tasks.ts`
- `src/infrastructure/database/drizzle/schema/invitations.ts`

**Events:**

- `src/domain/task-management/events/` (existing)

**Specifications:**

- `src/domain/task-management/specifications/` (existing)

**Value Objects:**

- `src/domain/task-management/value-objects/` (existing)

### 9. Webhook Domain

**Controllers (1 file):**

- `src/presentation/controllers/webhook.controller.ts`

**Routes (1 file):**

- `src/presentation/routes/webhook.routes.ts`

**Validators (1 file):**

- `src/presentation/validators/webhook.validator.ts`

**Services:**

- `src/domain/webhook/services/` (existing)

**Entities:**

- `src/domain/webhook/entities/` (existing)

**Repositories:**

- `src/domain/webhook/repositories/` (existing)
- `src/infrastructure/webhook/webhook.repository.impl.ts`
- `src/infrastructure/webhook/webhook-delivery.repository.impl.ts`

**Value Objects:**

- `src/domain/webhook/value-objects/` (existing)

### 10. System Monitoring Domain

**Controllers (3 files):**

- `src/presentation/controllers/monitoring.controller.ts`
- `src/presentation/controllers/health.controller.ts`
- `src/presentation/controllers/performance.controller.ts`

**Routes (4 files):**

- `src/presentation/routes/monitoring.routes.ts`
- `src/presentation/routes/health.routes.ts`
- `src/presentation/routes/performance.routes.ts`
- `src/presentation/routes/metrics.routes.ts`

**Services:**

- `src/domain/system-monitoring/services/` (existing)

**Entities:**

- `src/domain/system-monitoring/entities/` (existing)

**Repositories:**

- `src/domain/system-monitoring/repositories/` (existing)

**Value Objects:**

- `src/domain/system-monitoring/value-objects/` (existing)

### 11. Audit Domain

**Services:**

- `src/domain/audit/services/` (existing)

**Entities:**

- `src/domain/audit/entities/` (existing)

**Repositories:**

- `src/domain/audit/repositories/` (existing)
- `src/infrastructure/database/drizzle/repositories/audit.repository.ts`

**Schemas:**

- `src/infrastructure/database/drizzle/schema/audit-logs.ts`

**Value Objects:**

- `src/domain/audit/value-objects/` (existing)

### Additional Files to Consider

**Export/Import Functionality:**

- `src/presentation/controllers/export-import.controller.ts`
- `src/presentation/routes/export-import.routes.ts`
- `src/application/services/data-import-export.service.ts`
- Could be part of Task Management or separate utility

**Feedback System:**

- `src/presentation/controllers/feedback.controller.ts`
- `src/presentation/routes/feedback.routes.ts`
- `src/presentation/validators/feedback.validator.ts`
- `src/application/services/feedback.service.ts`
- `src/infrastructure/database/drizzle/repositories/feedback.repository.ts`
- `src/infrastructure/database/drizzle/schema/feedback.ts`
- Could be separate domain or part of System Monitoring

### Infrastructure Files to Preserve

**Technical Infrastructure Only:**

- `src/infrastructure/database/` (connection, health, migration, transaction management)
- `src/infrastructure/cache/`
- `src/infrastructure/external-services/`
- `src/infrastructure/monitoring/`
- `src/infrastructure/storage/`
- `src/infrastructure/websocket/`
- `src/infrastructure/logging/`
- `src/infrastructure/security/`
- `src/infrastructure/server/`

### Service Duplication Analysis

**Potential Duplicates to Consolidate:**

1. Calendar services exist in both `src/application/services/` and `src/domain/calendar/services/`
2. Email service in `src/application/services/` should move to notification domain
3. Data import/export service needs domain assignment
4. Feedback service needs domain assignment
5. WebSocket service needs evaluation for domain assignment

### File Count Summary

**Total Files to Migrate:**

- Controllers: 25 files
- Routes: 27 files
- Validators: 17 files
- Schemas: 16 files
- Repository implementations: 15+ files
- Middleware: 26 files
- Configuration: 9 files
- Utilities: 8 files

**Estimated Total Migration:** ~150+ files across all domains

### Migration Complexity Assessment

**High Complexity Domains:**

1. **Task Management** - 23+ files, largest domain with most interconnections
2. **Authentication** - Critical system component with many dependencies
3. **Calendar** - Multiple service duplications to resolve

**Medium Complexity Domains:** 4. **Analytics** - 7 files, straightforward migration 5. **System Monitoring** - 7 files, some infrastructure overlap 6. **Collaboration** - 5 files, moderate complexity

**Low Complexity Domains:** 7. **Notification** - 4 files, clear boundaries 8. **Search** - 4 files, well-defined scope 9. **Webhook** - 4 files, isolated functionality 10. **File Management** - 3 files, clear domain boundaries 11. **Audit** - 3 files, minimal presentation layer

This analysis provides the foundation for the automated migration scripts and ensures no files are missed during the restructuring process.
