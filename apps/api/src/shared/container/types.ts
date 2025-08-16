// Import ServiceDescriptor from service-descriptor module
import type { ServiceDescriptor } from './service-descriptor';

/**
 * Container interface for dependency injection
 */
export interface Container {
  register<T>(
    token: string,
    implementation: new (...args: any[]) => T,
    lifetime?: ServiceLifetime,
    dependencies?: string[]
  ): void;

  registerSingleton<T>(
    token: string,
    implementation: new (...args: any[]) => T,
    dependencies?: string[]
  ): void;

  registerScoped<T>(
    token: string,
    implementation: new (...args: any[]) => T,
    dependencies?: string[]
  ): void;

  registerInstance<T>(token: string, instance: T): void;

  registerFactory<T>(
    token: string,
    factory: (container: Container) => T,
    lifetime?: ServiceLifetime
  ): void;

  resolve<T>(token: string): T;
  isRegistered(token: string): boolean;
  validateDependencies(): void;
  createScope(): Container;
  clear(): void;

  // Additional methods used by health-checker and service-factory
  getRegisteredServices(): string[];
  getDescriptor(token: string): ServiceDescriptor | undefined;
  getSingletonInstance<T>(token: string): T | undefined;
  setSingletonInstance<T>(token: string, instance: T): void;
}

/**
 * Service lifetime enumeration
 */
export enum ServiceLifetime {
  Transient = 'transient',
  Scoped = 'scoped',
  Singleton = 'singleton',
}

/**
 * Service tokens for dependency injection
 */
export const SERVICE_TOKENS = {
  // Database
  DATABASE_CONNECTION: 'DatabaseConnection',
  TRANSACTION_MANAGER: 'TransactionManager',
  TRANSACTION_INTEGRATION_SERVICE: 'TransactionIntegrationService',
  UNIT_OF_WORK_FACTORY: 'UnitOfWorkFactory',

  // Repositories
  USER_REPOSITORY: 'UserRepository',
  TASK_REPOSITORY: 'TaskRepository',
  PROJECT_REPOSITORY: 'ProjectRepository',
  WORKSPACE_REPOSITORY: 'WorkspaceRepository',
  NOTIFICATION_REPOSITORY: 'NotificationRepository',
  NOTIFICATION_PREFERENCES_REPOSITORY: 'NotificationPreferencesRepository',
  AUDIT_LOG_REPOSITORY: 'AuditLogRepository',
  WEBHOOK_REPOSITORY: 'WebhookRepository',
  CALENDAR_EVENT_REPOSITORY: 'CalendarEventRepository',
  FILE_ATTACHMENT_REPOSITORY: 'FileAttachmentRepository',

  // Domain Services
  TASK_DOMAIN_SERVICE: 'TaskDomainService',
  PROJECT_DOMAIN_SERVICE: 'ProjectDomainService',
  WORKSPACE_DOMAIN_SERVICE: 'WorkspaceDomainService',
  NOTIFICATION_DOMAIN_SERVICE: 'NotificationDomainService',
  AUDIT_DOMAIN_SERVICE: 'AuditDomainService',
  WEBHOOK_DOMAIN_SERVICE: 'WebhookDomainService',
  CALENDAR_DOMAIN_SERVICE: 'CalendarDomainService',

  // Application Services
  TASK_APPLICATION_SERVICE: 'TaskApplicationService',
  PROJECT_APPLICATION_SERVICE: 'ProjectApplicationService',
  WORKSPACE_APPLICATION_SERVICE: 'WorkspaceApplicationService',
  NOTIFICATION_APPLICATION_SERVICE: 'NotificationApplicationService',
  AUTH_APPLICATION_SERVICE: 'AuthApplicationService',
  WEBHOOK_APPLICATION_SERVICE: 'WebhookApplicationService',
  CALENDAR_APPLICATION_SERVICE: 'CalendarApplicationService',

  // Command Handlers
  CREATE_TASK_HANDLER: 'CreateTaskHandler',
  UPDATE_TASK_HANDLER: 'UpdateTaskHandler',
  ASSIGN_TASK_HANDLER: 'AssignTaskHandler',
  COMPLETE_TASK_HANDLER: 'CompleteTaskHandler',
  CREATE_PROJECT_HANDLER: 'CreateProjectHandler',
  UPDATE_PROJECT_HANDLER: 'UpdateProjectHandler',
  ADD_PROJECT_MEMBER_HANDLER: 'AddProjectMemberHandler',
  REMOVE_PROJECT_MEMBER_HANDLER: 'RemoveProjectMemberHandler',
  CREATE_WORKSPACE_HANDLER: 'CreateWorkspaceHandler',
  INVITE_USER_HANDLER: 'InviteUserHandler',
  REGISTER_USER_HANDLER: 'RegisterUserHandler',
  UPDATE_USER_PROFILE_HANDLER: 'UpdateUserProfileHandler',
  CREATE_NOTIFICATION_HANDLER: 'CreateNotificationHandler',
  UPDATE_NOTIFICATION_HANDLER: 'UpdateNotificationHandler',
  MARK_NOTIFICATION_READ_HANDLER: 'MarkNotificationReadHandler',
  CREATE_AUDIT_LOG_HANDLER: 'CreateAuditLogHandler',
  CLEANUP_AUDIT_LOGS_HANDLER: 'CleanupAuditLogsHandler',
  CREATE_WEBHOOK_HANDLER: 'CreateWebhookHandler',
  UPDATE_WEBHOOK_HANDLER: 'UpdateWebhookHandler',
  TRIGGER_WEBHOOK_HANDLER: 'TriggerWebhookHandler',
  CREATE_CALENDAR_EVENT_HANDLER: 'CreateCalendarEventHandler',
  UPDATE_CALENDAR_EVENT_HANDLER: 'UpdateCalendarEventHandler',
  SCHEDULE_CALENDAR_EVENT_HANDLER: 'ScheduleCalendarEventHandler',

  // Query Handlers
  GET_TASK_HANDLER: 'GetTaskHandler',
  LIST_TASKS_HANDLER: 'ListTasksHandler',
  GET_PROJECT_HANDLER: 'GetProjectHandler',
  LIST_PROJECTS_HANDLER: 'ListProjectsHandler',
  GET_PROJECT_MEMBERS_HANDLER: 'GetProjectMembersHandler',
  GET_WORKSPACE_HANDLER: 'GetWorkspaceHandler',
  LIST_WORKSPACES_HANDLER: 'ListWorkspacesHandler',
  GET_WORKSPACE_STATS_HANDLER: 'GetWorkspaceStatsHandler',
  GET_USER_HANDLER: 'GetUserHandler',
  LIST_USERS_HANDLER: 'ListUsersHandler',
  GET_USER_PREFERENCES_HANDLER: 'GetUserPreferencesHandler',
  GET_NOTIFICATIONS_HANDLER: 'GetNotificationsHandler',
  GET_NOTIFICATION_PREFERENCES_HANDLER: 'GetNotificationPreferencesHandler',
  GET_WEBHOOKS_HANDLER: 'GetWebhooksHandler',
  GET_WEBHOOK_DELIVERIES_HANDLER: 'GetWebhookDeliveriesHandler',

  // Infrastructure Services
  CACHE_SERVICE: 'CacheService',
  EMAIL_SERVICE: 'EmailService',
  JWT_SERVICE: 'JwtService',
  PASSWORD_SERVICE: 'PasswordService',
  SESSION_MANAGER: 'SessionManager',
  OAUTH_SERVICE: 'OAuthService',
  TWO_FACTOR_AUTH_SERVICE: 'TwoFactorAuthService',
  RATE_LIMIT_SERVICE: 'RateLimitService',
  LOGGING_SERVICE: 'LoggingService',
  METRICS_SERVICE: 'MetricsService',
  HEALTH_SERVICE: 'HealthService',
  WEBSOCKET_SERVICE: 'WebSocketService',

  // Controllers
  TASK_CONTROLLER: 'TaskController',
  PROJECT_CONTROLLER: 'ProjectController',
  WORKSPACE_CONTROLLER: 'WorkspaceController',
  USER_CONTROLLER: 'UserController',
  AUTH_CONTROLLER: 'AuthController',
  NOTIFICATION_CONTROLLER: 'NotificationController',
  WEBHOOK_CONTROLLER: 'WebhookController',
  CALENDAR_CONTROLLER: 'CalendarController',

  // Middleware
  AUTH_MIDDLEWARE: 'AuthMiddleware',
  RATE_LIMIT_MIDDLEWARE: 'RateLimitMiddleware',
  VALIDATION_MIDDLEWARE: 'ValidationMiddleware',
  ERROR_HANDLER_MIDDLEWARE: 'ErrorHandlerMiddleware',
  CORS_MIDDLEWARE: 'CorsMiddleware',
  SECURITY_MIDDLEWARE: 'SecurityMiddleware',

  // Event Handling
  EVENT_BUS: 'EventBus',
  DOMAIN_EVENT_BUS: 'DomainEventBus',
  DOMAIN_EVENT_PUBLISHER: 'DomainEventPublisher',
  APPLICATION_EVENT_HANDLERS: 'ApplicationEventHandlers',
  EVENT_INTEGRATION_SERVICE: 'EventIntegrationService',
  EVENT_HANDLER_LIFECYCLE_MANAGER: 'EventHandlerLifecycleManager',

  // Configuration
  APP_CONFIG: 'AppConfig',
  DATABASE_CONFIG: 'DatabaseConfig',
  REDIS_CONFIG: 'RedisConfig',
  JWT_CONFIG: 'JwtConfig',
  EMAIL_CONFIG: 'EmailConfig',
} as const;

export type ServiceToken = (typeof SERVICE_TOKENS)[keyof typeof SERVICE_TOKENS];
