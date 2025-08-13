import { Container, SERVICE_TOKENS, ServiceLifetime } from './types';
import { ConfigLoader } from '../config';

// Domain Services
import { TaskDomainService } from '../../domain/services/task-domain-service';
import { ProjectDomainService } from '../../domain/services/project-domain-service';
import { WorkspaceDomainService } from '../../domain/services/workspace-domain-service';
import { NotificationDomainService } from '../../domain/services/notification-domain-service';
import { AuditDomainService } from '../../domain/services/audit-domain-service';
import { WebhookDomainService } from '../../domain/services/webhook-domain-service';
import { CalendarDomainService } from '../../domain/services/calendar-domain-service';

// Application Services
import { TaskApplicationService } from '../../application/services/task-application-service';
import { ProjectApplicationService } from '../../application/services/project-application-service';
import { WorkspaceApplicationService } from '../../application/services/workspace-application-service';
import { NotificationApplicationService } from '../../application/services/notification-application-service';
import { AuthApplicationService } from '../../application/services/auth-application-service';
import { WebhookApplicationService } from '../../application/services/webhook-application-service';
import { CalendarApplicationService } from '../../application/services/calendar-application-service';

// Command Handlers
import {
  CreateTaskHandler,
  UpdateTaskHandler,
  AssignTaskHandler,
  CompleteTaskHandler,
} from '../../application/handlers/task-command-handlers';

import {
  CreateProjectHandler,
  UpdateProjectHandler,
  AddProjectMemberHandler,
  RemoveProjectMemberHandler,
} from '../../application/handlers/project-command-handlers';

import {
  CreateWorkspaceHandler,
  InviteUserHandler,
} from '../../application/handlers/workspace-command-handlers';

import {
  RegisterUserHandler,
  UpdateUserProfileHandler,
} from '../../application/handlers/user-command-handlers';

import {
  CreateNotificationHandler,
  UpdateNotificationHandler,
  MarkNotificationReadHandler,
} from '../../application/handlers/notification-command-handlers';

import {
  CreateAuditLogHandler,
  CleanupAuditLogsHandler,
} from '../../application/handlers/audit-log-command-handlers';

import {
  CreateWebhookHandler,
  UpdateWebhookHandler,
  TriggerWebhookHandler,
} from '../../application/handlers/webhook-command-handlers';

import {
  CreateCalendarEventHandler,
  UpdateCalendarEventHandler,
  ScheduleCalendarEventHandler,
} from '../../application/handlers/calendar-command-handlers';

// Query Handlers
import {
  GetTaskHandler,
  ListTasksHandler,
} from '../../application/handlers/task-query-handlers';

import {
  GetProjectHandler,
  ListProjectsHandler,
  GetProjectMembersHandler,
} from '../../application/handlers/project-query-handlers';

import {
  GetWorkspaceHandler,
  ListWorkspacesHandler,
  GetWorkspaceStatsHandler,
} from '../../application/handlers/workspace-query-handlers';

import {
  GetUserHandler,
  ListUsersHandler,
  GetUserPreferencesHandler,
} from '../../application/handlers/user-query-handlers';

import {
  GetNotificationsHandler,
  GetNotificationPreferencesHandler,
} from '../../application/handlers/notification-query-handlers';

import {
  GetWebhooksHandler,
  GetWebhookDeliveriesHandler,
} from '../../application/handlers/webhook-query-handlers';

// Infrastructure Services
import { DatabaseConnection } from '../../infrastructure/database/connection';
import { TransactionManager } from '../../infrastructure/database/transaction-manager';
import { TransactionIntegrationService } from '../../infrastructure/database/transaction-integration-service';
import { EventIntegrationService } from '../../infrastructure/events/event-integration-service';
import { UnitOfWorkFactory } from '../../infrastructure/database/unit-of-work';
import { EventHandlerLifecycleManager } from '../../application/events/event-handler-lifecycle-manager';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { RedisClient } from '../../infrastructure/caching/redis-client';
import { EmailService } from '../../infrastructure/external-services/email-service';
import { JWTService } from '../../infrastructure/security/jwt-service';
import { PasswordService } from '../../infrastructure/security/password-service';
import { RateLimitService } from '../../infrastructure/security/rate-limit-service';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { MetricsService } from '../../infrastructure/monitoring/metrics-service';
import { HealthService } from '../../infrastructure/monitoring/health-service';
import { WebSocketService } from '../../infrastructure/external-services/websocket-service';

// Repositories
import { TaskRepository } from '../../infrastructure/database/repositories/task-repository';
import { ProjectRepository } from '../../infrastructure/database/repositories/project-repository';
import { UserRepository } from '../../infrastructure/database/repositories/user-repository';
import { WorkspaceRepository } from '../../infrastructure/database/repositories/workspace-repository';
import {
  NotificationRepository,
  NotificationPreferencesRepository,
} from '../../infrastructure/database/repositories/notification-repository';
import { AuditLogRepository } from '../../infrastructure/database/repositories/audit-log-repository';
import { WebhookRepository } from '../../infrastructure/database/repositories/webhook-repository';
import { CalendarEventRepository } from '../../infrastructure/database/repositories/calendar-event-repository';
import { FileAttachmentRepository } from '../../infrastructure/database/repositories/file-attachment-repository';

// Controllers
import { TaskController } from '../../presentation/controllers/task-controller';
import { ProjectController } from '../../presentation/controllers/project-controller';
import { WorkspaceController } from '../../presentation/controllers/workspace-controller';
import { UserController } from '../../presentation/controllers/user-controller';
import { AuthController } from '../../presentation/controllers/auth-controller';
import { NotificationController } from '../../presentation/controllers/notification-controller';
import { WebhookController } from '../../presentation/controllers/webhook-controller';
import { CalendarController } from '../../presentation/controllers/calendar-controller';

// Event Handling
import { EventBus } from '../../application/events/event-bus';
import { DomainEventBus } from '../../application/events/domain-event-bus';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { ApplicationEventHandlers } from '../../application/events/application-event-handlers';

// Migration Services
import { registerMigrationServices } from '../../infrastructure/migration/migration-service-registration';

/**
 * Register all services with the container
 */
export function registerServices(container: Container): void {
  // Register configuration services first
  registerConfiguration(container);

  // Register infrastructure services
  registerInfrastructure(container);

  // Register repositories
  registerRepositories(container);

  // Register domain services
  registerDomainServices(container);

  // Register application services
  registerApplicationServices(container);

  // Register command handlers
  registerCommandHandlers(container);

  // Register query handlers
  registerQueryHandlers(container);

  // Register controllers
  registerControllers(container);

  // Register event handling
  registerEventHandling(container);

  // Register migration services
  registerMigrationServices(container);

  // Validate all dependencies
  container.validateDependencies();
}

function registerConfiguration(container: Container): void {
  // Configuration services will be registered as factories using ConfigLoader
  container.registerFactory(
    SERVICE_TOKENS.APP_CONFIG,
    () => ConfigLoader.loadAppConfig(),
    ServiceLifetime.Singleton
  );

  container.registerFactory(
    SERVICE_TOKENS.DATABASE_CONFIG,
    () => ConfigLoader.loadDatabaseConfig(),
    ServiceLifetime.Singleton
  );

  container.registerFactory(
    SERVICE_TOKENS.REDIS_CONFIG,
    () => ConfigLoader.loadRedisConfig(),
    ServiceLifetime.Singleton
  );

  container.registerFactory(
    SERVICE_TOKENS.JWT_CONFIG,
    () => ConfigLoader.loadJwtConfig(),
    ServiceLifetime.Singleton
  );

  container.registerFactory(
    SERVICE_TOKENS.EMAIL_CONFIG,
    () => ConfigLoader.loadEmailConfig(),
    ServiceLifetime.Singleton
  );
}

function registerInfrastructure(container: Container): void {
  // Database
  container.registerFactory(
    SERVICE_TOKENS.DATABASE_CONNECTION,
    (container) => {
      const config = container.resolve<any>(SERVICE_TOKENS.DATABASE_CONFIG);
      return DatabaseConnection.getInstance(config);
    },
    ServiceLifetime.Singleton
  );

  container.registerScoped(
    SERVICE_TOKENS.TRANSACTION_MANAGER,
    TransactionManager,
    [SERVICE_TOKENS.DATABASE_CONNECTION]
  );

  container.registerScoped(
    SERVICE_TOKENS.TRANSACTION_INTEGRATION_SERVICE,
    TransactionIntegrationService,
    [
      SERVICE_TOKENS.TRANSACTION_MANAGER,
      SERVICE_TOKENS.LOGGING_SERVICE,
      SERVICE_TOKENS.METRICS_SERVICE,
    ]
  );

  container.registerScoped(
    SERVICE_TOKENS.UNIT_OF_WORK_FACTORY,
    UnitOfWorkFactory,
    [
      SERVICE_TOKENS.TRANSACTION_MANAGER,
      SERVICE_TOKENS.EVENT_INTEGRATION_SERVICE,
      SERVICE_TOKENS.LOGGING_SERVICE,
      SERVICE_TOKENS.METRICS_SERVICE,
    ]
  );

  // Caching
  container.registerFactory(
    SERVICE_TOKENS.CACHE_SERVICE,
    (container) => {
      const redisConfig = container.resolve<any>(SERVICE_TOKENS.REDIS_CONFIG);
      const redisClient = new RedisClient(redisConfig);
      return new CacheService(redisClient, redisConfig);
    },
    ServiceLifetime.Singleton
  );

  // External Services
  container.registerSingleton(SERVICE_TOKENS.EMAIL_SERVICE, EmailService, [
    SERVICE_TOKENS.EMAIL_CONFIG,
  ]);

  container.registerSingleton(
    SERVICE_TOKENS.WEBSOCKET_SERVICE,
    WebSocketService
  );

  // Security Services
  container.registerSingleton(SERVICE_TOKENS.JWT_SERVICE, JWTService, [
    SERVICE_TOKENS.JWT_CONFIG,
  ]);

  container.registerSingleton(SERVICE_TOKENS.PASSWORD_SERVICE, PasswordService);

  container.registerSingleton(
    SERVICE_TOKENS.RATE_LIMIT_SERVICE,
    RateLimitService,
    [SERVICE_TOKENS.CACHE_SERVICE]
  );

  // Monitoring Services
  container.registerFactory(
    SERVICE_TOKENS.LOGGING_SERVICE,
    (container) => {
      const appConfig = container.resolve<any>(SERVICE_TOKENS.APP_CONFIG);
      return LoggingService.fromAppConfig(appConfig);
    },
    ServiceLifetime.Singleton
  );

  container.registerFactory(
    SERVICE_TOKENS.METRICS_SERVICE,
    (container) => {
      const appConfig = container.resolve<any>(SERVICE_TOKENS.APP_CONFIG);
      return MetricsService.fromAppConfig(appConfig);
    },
    ServiceLifetime.Singleton
  );

  container.registerSingleton(SERVICE_TOKENS.HEALTH_SERVICE, HealthService, [
    SERVICE_TOKENS.DATABASE_CONNECTION,
    SERVICE_TOKENS.CACHE_SERVICE,
  ]);
}

function registerRepositories(container: Container): void {
  container.registerScoped(SERVICE_TOKENS.TASK_REPOSITORY, TaskRepository, [
    SERVICE_TOKENS.DATABASE_CONNECTION,
  ]);

  container.registerScoped(
    SERVICE_TOKENS.PROJECT_REPOSITORY,
    ProjectRepository,
    [SERVICE_TOKENS.DATABASE_CONNECTION]
  );

  container.registerScoped(SERVICE_TOKENS.USER_REPOSITORY, UserRepository, [
    SERVICE_TOKENS.DATABASE_CONNECTION,
  ]);

  container.registerScoped(
    SERVICE_TOKENS.WORKSPACE_REPOSITORY,
    WorkspaceRepository,
    [SERVICE_TOKENS.DATABASE_CONNECTION]
  );

  container.registerScoped(
    SERVICE_TOKENS.NOTIFICATION_REPOSITORY,
    NotificationRepository,
    [SERVICE_TOKENS.DATABASE_CONNECTION]
  );

  container.registerScoped(
    SERVICE_TOKENS.NOTIFICATION_PREFERENCES_REPOSITORY,
    NotificationPreferencesRepository,
    [SERVICE_TOKENS.DATABASE_CONNECTION]
  );

  container.registerScoped(
    SERVICE_TOKENS.AUDIT_LOG_REPOSITORY,
    AuditLogRepository,
    [SERVICE_TOKENS.DATABASE_CONNECTION]
  );

  container.registerScoped(
    SERVICE_TOKENS.WEBHOOK_REPOSITORY,
    WebhookRepository,
    [SERVICE_TOKENS.DATABASE_CONNECTION]
  );

  container.registerScoped(
    SERVICE_TOKENS.CALENDAR_EVENT_REPOSITORY,
    CalendarEventRepository,
    [SERVICE_TOKENS.DATABASE_CONNECTION]
  );

  container.registerScoped(
    SERVICE_TOKENS.FILE_ATTACHMENT_REPOSITORY,
    FileAttachmentRepository,
    [SERVICE_TOKENS.DATABASE_CONNECTION]
  );
}

function registerDomainServices(container: Container): void {
  container.registerScoped(
    SERVICE_TOKENS.TASK_DOMAIN_SERVICE,
    TaskDomainService,
    [SERVICE_TOKENS.TASK_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.PROJECT_DOMAIN_SERVICE,
    ProjectDomainService,
    [SERVICE_TOKENS.PROJECT_REPOSITORY, SERVICE_TOKENS.USER_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.WORKSPACE_DOMAIN_SERVICE,
    WorkspaceDomainService,
    [SERVICE_TOKENS.WORKSPACE_REPOSITORY, SERVICE_TOKENS.USER_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.NOTIFICATION_DOMAIN_SERVICE,
    NotificationDomainService,
    [SERVICE_TOKENS.NOTIFICATION_REPOSITORY, SERVICE_TOKENS.USER_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.AUDIT_DOMAIN_SERVICE,
    AuditDomainService,
    [SERVICE_TOKENS.AUDIT_LOG_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.WEBHOOK_DOMAIN_SERVICE,
    WebhookDomainService,
    [SERVICE_TOKENS.WEBHOOK_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.CALENDAR_DOMAIN_SERVICE,
    CalendarDomainService,
    [SERVICE_TOKENS.CALENDAR_EVENT_REPOSITORY, SERVICE_TOKENS.USER_REPOSITORY]
  );
}

function registerApplicationServices(container: Container): void {
  container.registerScoped(
    SERVICE_TOKENS.TASK_APPLICATION_SERVICE,
    TaskApplicationService,
    [
      SERVICE_TOKENS.TASK_REPOSITORY,
      SERVICE_TOKENS.TASK_DOMAIN_SERVICE,
      SERVICE_TOKENS.DOMAIN_EVENT_PUBLISHER,
    ]
  );

  container.registerScoped(
    SERVICE_TOKENS.PROJECT_APPLICATION_SERVICE,
    ProjectApplicationService,
    [
      SERVICE_TOKENS.PROJECT_REPOSITORY,
      SERVICE_TOKENS.PROJECT_DOMAIN_SERVICE,
      SERVICE_TOKENS.USER_REPOSITORY,
      SERVICE_TOKENS.DOMAIN_EVENT_PUBLISHER,
    ]
  );

  container.registerScoped(
    SERVICE_TOKENS.WORKSPACE_APPLICATION_SERVICE,
    WorkspaceApplicationService,
    [
      SERVICE_TOKENS.WORKSPACE_REPOSITORY,
      SERVICE_TOKENS.WORKSPACE_DOMAIN_SERVICE,
      SERVICE_TOKENS.USER_REPOSITORY,
      SERVICE_TOKENS.DOMAIN_EVENT_PUBLISHER,
    ]
  );

  container.registerScoped(
    SERVICE_TOKENS.NOTIFICATION_APPLICATION_SERVICE,
    NotificationApplicationService,
    [
      SERVICE_TOKENS.NOTIFICATION_REPOSITORY,
      SERVICE_TOKENS.NOTIFICATION_PREFERENCES_REPOSITORY,
      SERVICE_TOKENS.EMAIL_SERVICE,
      SERVICE_TOKENS.WEBSOCKET_SERVICE,
      SERVICE_TOKENS.USER_REPOSITORY,
    ]
  );

  container.registerScoped(
    SERVICE_TOKENS.AUTH_APPLICATION_SERVICE,
    AuthApplicationService,
    [
      SERVICE_TOKENS.USER_REPOSITORY,
      SERVICE_TOKENS.JWT_SERVICE,
      SERVICE_TOKENS.PASSWORD_SERVICE,
      SERVICE_TOKENS.EMAIL_SERVICE,
      SERVICE_TOKENS.DOMAIN_EVENT_PUBLISHER,
    ]
  );

  container.registerScoped(
    SERVICE_TOKENS.WEBHOOK_APPLICATION_SERVICE,
    WebhookApplicationService,
    [
      SERVICE_TOKENS.WEBHOOK_REPOSITORY,
      SERVICE_TOKENS.WEBHOOK_DOMAIN_SERVICE,
      SERVICE_TOKENS.DOMAIN_EVENT_PUBLISHER,
    ]
  );

  container.registerScoped(
    SERVICE_TOKENS.CALENDAR_APPLICATION_SERVICE,
    CalendarApplicationService,
    [
      SERVICE_TOKENS.CALENDAR_EVENT_REPOSITORY,
      SERVICE_TOKENS.CALENDAR_DOMAIN_SERVICE,
      SERVICE_TOKENS.NOTIFICATION_APPLICATION_SERVICE,
      SERVICE_TOKENS.DOMAIN_EVENT_PUBLISHER,
    ]
  );
}

function registerCommandHandlers(container: Container): void {
  // Task Command Handlers
  container.registerScoped(
    SERVICE_TOKENS.CREATE_TASK_HANDLER,
    CreateTaskHandler,
    [SERVICE_TOKENS.TASK_APPLICATION_SERVICE]
  );

  container.registerScoped(
    SERVICE_TOKENS.UPDATE_TASK_HANDLER,
    UpdateTaskHandler,
    [SERVICE_TOKENS.TASK_APPLICATION_SERVICE]
  );

  container.registerScoped(
    SERVICE_TOKENS.ASSIGN_TASK_HANDLER,
    AssignTaskHandler,
    [SERVICE_TOKENS.TASK_APPLICATION_SERVICE]
  );

  container.registerScoped(
    SERVICE_TOKENS.COMPLETE_TASK_HANDLER,
    CompleteTaskHandler,
    [SERVICE_TOKENS.TASK_APPLICATION_SERVICE]
  );

  // Project Command Handlers
  container.registerScoped(
    SERVICE_TOKENS.CREATE_PROJECT_HANDLER,
    CreateProjectHandler,
    [SERVICE_TOKENS.PROJECT_REPOSITORY, SERVICE_TOKENS.PROJECT_DOMAIN_SERVICE]
  );

  container.registerScoped(
    SERVICE_TOKENS.UPDATE_PROJECT_HANDLER,
    UpdateProjectHandler,
    [SERVICE_TOKENS.PROJECT_REPOSITORY, SERVICE_TOKENS.PROJECT_DOMAIN_SERVICE]
  );

  container.registerScoped(
    SERVICE_TOKENS.ADD_PROJECT_MEMBER_HANDLER,
    AddProjectMemberHandler,
    [SERVICE_TOKENS.PROJECT_REPOSITORY, SERVICE_TOKENS.USER_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.REMOVE_PROJECT_MEMBER_HANDLER,
    RemoveProjectMemberHandler,
    [SERVICE_TOKENS.PROJECT_REPOSITORY]
  );

  // Workspace Command Handlers
  container.registerScoped(
    SERVICE_TOKENS.CREATE_WORKSPACE_HANDLER,
    CreateWorkspaceHandler,
    [
      SERVICE_TOKENS.WORKSPACE_REPOSITORY,
      SERVICE_TOKENS.WORKSPACE_DOMAIN_SERVICE,
    ]
  );

  container.registerScoped(
    SERVICE_TOKENS.INVITE_USER_HANDLER,
    InviteUserHandler,
    [
      SERVICE_TOKENS.WORKSPACE_REPOSITORY,
      SERVICE_TOKENS.USER_REPOSITORY,
      SERVICE_TOKENS.EMAIL_SERVICE,
    ]
  );

  // User Command Handlers
  container.registerScoped(
    SERVICE_TOKENS.REGISTER_USER_HANDLER,
    RegisterUserHandler,
    [
      SERVICE_TOKENS.USER_REPOSITORY,
      SERVICE_TOKENS.PASSWORD_SERVICE,
      SERVICE_TOKENS.EMAIL_SERVICE,
    ]
  );

  container.registerScoped(
    SERVICE_TOKENS.UPDATE_USER_PROFILE_HANDLER,
    UpdateUserProfileHandler,
    [SERVICE_TOKENS.USER_REPOSITORY]
  );

  // Notification Command Handlers
  container.registerScoped(
    SERVICE_TOKENS.CREATE_NOTIFICATION_HANDLER,
    CreateNotificationHandler,
    [SERVICE_TOKENS.NOTIFICATION_APPLICATION_SERVICE]
  );

  container.registerScoped(
    SERVICE_TOKENS.UPDATE_NOTIFICATION_HANDLER,
    UpdateNotificationHandler,
    [SERVICE_TOKENS.NOTIFICATION_APPLICATION_SERVICE]
  );

  container.registerScoped(
    SERVICE_TOKENS.MARK_NOTIFICATION_READ_HANDLER,
    MarkNotificationReadHandler,
    [SERVICE_TOKENS.NOTIFICATION_APPLICATION_SERVICE]
  );

  // Audit Log Command Handlers
  container.registerScoped(
    SERVICE_TOKENS.CREATE_AUDIT_LOG_HANDLER,
    CreateAuditLogHandler,
    [SERVICE_TOKENS.AUDIT_LOG_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.CLEANUP_AUDIT_LOGS_HANDLER,
    CleanupAuditLogsHandler,
    [SERVICE_TOKENS.AUDIT_LOG_REPOSITORY]
  );

  // Webhook Command Handlers
  container.registerScoped(
    SERVICE_TOKENS.CREATE_WEBHOOK_HANDLER,
    CreateWebhookHandler,
    [SERVICE_TOKENS.WEBHOOK_APPLICATION_SERVICE]
  );

  container.registerScoped(
    SERVICE_TOKENS.UPDATE_WEBHOOK_HANDLER,
    UpdateWebhookHandler,
    [SERVICE_TOKENS.WEBHOOK_APPLICATION_SERVICE]
  );

  container.registerScoped(
    SERVICE_TOKENS.TRIGGER_WEBHOOK_HANDLER,
    TriggerWebhookHandler,
    [SERVICE_TOKENS.WEBHOOK_APPLICATION_SERVICE]
  );

  // Calendar Command Handlers
  container.registerScoped(
    SERVICE_TOKENS.CREATE_CALENDAR_EVENT_HANDLER,
    CreateCalendarEventHandler,
    [SERVICE_TOKENS.CALENDAR_APPLICATION_SERVICE]
  );

  container.registerScoped(
    SERVICE_TOKENS.UPDATE_CALENDAR_EVENT_HANDLER,
    UpdateCalendarEventHandler,
    [SERVICE_TOKENS.CALENDAR_APPLICATION_SERVICE]
  );

  container.registerScoped(
    SERVICE_TOKENS.SCHEDULE_CALENDAR_EVENT_HANDLER,
    ScheduleCalendarEventHandler,
    [SERVICE_TOKENS.CALENDAR_APPLICATION_SERVICE]
  );
}

function registerQueryHandlers(container: Container): void {
  // Task Query Handlers
  container.registerScoped(SERVICE_TOKENS.GET_TASK_HANDLER, GetTaskHandler, [
    SERVICE_TOKENS.TASK_REPOSITORY,
  ]);

  container.registerScoped(
    SERVICE_TOKENS.LIST_TASKS_HANDLER,
    ListTasksHandler,
    [SERVICE_TOKENS.TASK_REPOSITORY]
  );

  // Project Query Handlers
  container.registerScoped(
    SERVICE_TOKENS.GET_PROJECT_HANDLER,
    GetProjectHandler,
    [SERVICE_TOKENS.PROJECT_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.LIST_PROJECTS_HANDLER,
    ListProjectsHandler,
    [SERVICE_TOKENS.PROJECT_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.GET_PROJECT_MEMBERS_HANDLER,
    GetProjectMembersHandler,
    [SERVICE_TOKENS.PROJECT_REPOSITORY, SERVICE_TOKENS.USER_REPOSITORY]
  );

  // Workspace Query Handlers
  container.registerScoped(
    SERVICE_TOKENS.GET_WORKSPACE_HANDLER,
    GetWorkspaceHandler,
    [SERVICE_TOKENS.WORKSPACE_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.LIST_WORKSPACES_HANDLER,
    ListWorkspacesHandler,
    [SERVICE_TOKENS.WORKSPACE_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.GET_WORKSPACE_STATS_HANDLER,
    GetWorkspaceStatsHandler,
    [
      SERVICE_TOKENS.WORKSPACE_REPOSITORY,
      SERVICE_TOKENS.PROJECT_REPOSITORY,
      SERVICE_TOKENS.TASK_REPOSITORY,
    ]
  );

  // User Query Handlers
  container.registerScoped(SERVICE_TOKENS.GET_USER_HANDLER, GetUserHandler, [
    SERVICE_TOKENS.USER_REPOSITORY,
  ]);

  container.registerScoped(
    SERVICE_TOKENS.LIST_USERS_HANDLER,
    ListUsersHandler,
    [SERVICE_TOKENS.USER_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.GET_USER_PREFERENCES_HANDLER,
    GetUserPreferencesHandler,
    [
      SERVICE_TOKENS.USER_REPOSITORY,
      SERVICE_TOKENS.NOTIFICATION_PREFERENCES_REPOSITORY,
    ]
  );

  // Notification Query Handlers
  container.registerScoped(
    SERVICE_TOKENS.GET_NOTIFICATIONS_HANDLER,
    GetNotificationsHandler,
    [SERVICE_TOKENS.NOTIFICATION_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.GET_NOTIFICATION_PREFERENCES_HANDLER,
    GetNotificationPreferencesHandler,
    [SERVICE_TOKENS.NOTIFICATION_PREFERENCES_REPOSITORY]
  );

  // Webhook Query Handlers
  container.registerScoped(
    SERVICE_TOKENS.GET_WEBHOOKS_HANDLER,
    GetWebhooksHandler,
    [SERVICE_TOKENS.WEBHOOK_REPOSITORY]
  );

  container.registerScoped(
    SERVICE_TOKENS.GET_WEBHOOK_DELIVERIES_HANDLER,
    GetWebhookDeliveriesHandler,
    [SERVICE_TOKENS.WEBHOOK_REPOSITORY]
  );
}

function registerControllers(container: Container): void {
  container.registerScoped(SERVICE_TOKENS.TASK_CONTROLLER, TaskController, [
    SERVICE_TOKENS.CREATE_TASK_HANDLER,
    SERVICE_TOKENS.UPDATE_TASK_HANDLER,
    SERVICE_TOKENS.ASSIGN_TASK_HANDLER,
    SERVICE_TOKENS.COMPLETE_TASK_HANDLER,
    SERVICE_TOKENS.GET_TASK_HANDLER,
    SERVICE_TOKENS.LIST_TASKS_HANDLER,
  ]);

  container.registerScoped(
    SERVICE_TOKENS.PROJECT_CONTROLLER,
    ProjectController,
    [
      SERVICE_TOKENS.CREATE_PROJECT_HANDLER,
      SERVICE_TOKENS.UPDATE_PROJECT_HANDLER,
      SERVICE_TOKENS.ADD_PROJECT_MEMBER_HANDLER,
      SERVICE_TOKENS.REMOVE_PROJECT_MEMBER_HANDLER,
    ]
  );

  container.registerScoped(
    SERVICE_TOKENS.WORKSPACE_CONTROLLER,
    WorkspaceController,
    [
      SERVICE_TOKENS.CREATE_WORKSPACE_HANDLER,
      SERVICE_TOKENS.INVITE_USER_HANDLER,
    ]
  );

  container.registerScoped(SERVICE_TOKENS.USER_CONTROLLER, UserController, [
    SERVICE_TOKENS.UPDATE_USER_PROFILE_HANDLER,
    SERVICE_TOKENS.GET_USER_HANDLER,
  ]);

  container.registerScoped(SERVICE_TOKENS.AUTH_CONTROLLER, AuthController, [
    SERVICE_TOKENS.REGISTER_USER_HANDLER,
    SERVICE_TOKENS.JWT_SERVICE,
    SERVICE_TOKENS.PASSWORD_SERVICE,
    SERVICE_TOKENS.USER_REPOSITORY,
  ]);

  container.registerScoped(
    SERVICE_TOKENS.NOTIFICATION_CONTROLLER,
    NotificationController,
    [
      SERVICE_TOKENS.GET_NOTIFICATIONS_HANDLER,
      SERVICE_TOKENS.CREATE_NOTIFICATION_HANDLER,
      SERVICE_TOKENS.UPDATE_NOTIFICATION_HANDLER,
      SERVICE_TOKENS.MARK_NOTIFICATION_READ_HANDLER,
      SERVICE_TOKENS.GET_NOTIFICATION_PREFERENCES_HANDLER,
    ]
  );

  container.registerScoped(
    SERVICE_TOKENS.WEBHOOK_CONTROLLER,
    WebhookController,
    [
      SERVICE_TOKENS.GET_WEBHOOKS_HANDLER,
      SERVICE_TOKENS.CREATE_WEBHOOK_HANDLER,
      SERVICE_TOKENS.UPDATE_WEBHOOK_HANDLER,
      SERVICE_TOKENS.TRIGGER_WEBHOOK_HANDLER,
      SERVICE_TOKENS.GET_WEBHOOK_DELIVERIES_HANDLER,
    ]
  );

  container.registerScoped(
    SERVICE_TOKENS.CALENDAR_CONTROLLER,
    CalendarController,
    [
      SERVICE_TOKENS.CREATE_CALENDAR_EVENT_HANDLER,
      SERVICE_TOKENS.UPDATE_CALENDAR_EVENT_HANDLER,
      SERVICE_TOKENS.SCHEDULE_CALENDAR_EVENT_HANDLER,
    ]
  );
}

function registerEventHandling(container: Container): void {
  container.registerSingleton(SERVICE_TOKENS.EVENT_BUS, EventBus, [
    SERVICE_TOKENS.LOGGING_SERVICE,
  ]);

  container.registerSingleton(SERVICE_TOKENS.DOMAIN_EVENT_BUS, DomainEventBus, [
    SERVICE_TOKENS.LOGGING_SERVICE,
  ]);

  container.registerFactory(
    SERVICE_TOKENS.DOMAIN_EVENT_PUBLISHER,
    () => DomainEventPublisher.getInstance(),
    ServiceLifetime.Singleton
  );

  container.registerSingleton(
    SERVICE_TOKENS.APPLICATION_EVENT_HANDLERS,
    ApplicationEventHandlers,
    [
      SERVICE_TOKENS.DOMAIN_EVENT_BUS,
      SERVICE_TOKENS.NOTIFICATION_APPLICATION_SERVICE,
      SERVICE_TOKENS.AUDIT_LOG_REPOSITORY,
    ]
  );

  container.registerSingleton(
    SERVICE_TOKENS.EVENT_INTEGRATION_SERVICE,
    EventIntegrationService,
    [
      SERVICE_TOKENS.DOMAIN_EVENT_BUS,
      SERVICE_TOKENS.EVENT_BUS,
      SERVICE_TOKENS.TRANSACTION_MANAGER,
      SERVICE_TOKENS.LOGGING_SERVICE,
      SERVICE_TOKENS.METRICS_SERVICE,
    ]
  );

  container.registerSingleton(
    SERVICE_TOKENS.EVENT_HANDLER_LIFECYCLE_MANAGER,
    EventHandlerLifecycleManager,
    [
      SERVICE_TOKENS.DOMAIN_EVENT_BUS,
      SERVICE_TOKENS.LOGGING_SERVICE,
      SERVICE_TOKENS.METRICS_SERVICE,
    ]
  );
}
