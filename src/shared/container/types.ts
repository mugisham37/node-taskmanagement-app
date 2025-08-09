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

  // Repositories
  USER_REPOSITORY: 'UserRepository',
  TASK_REPOSITORY: 'TaskRepository',
  PROJECT_REPOSITORY: 'ProjectRepository',
  WORKSPACE_REPOSITORY: 'WorkspaceRepository',

  // Domain Services
  TASK_DOMAIN_SERVICE: 'TaskDomainService',
  PROJECT_DOMAIN_SERVICE: 'ProjectDomainService',
  WORKSPACE_DOMAIN_SERVICE: 'WorkspaceDomainService',

  // Application Services
  TASK_APPLICATION_SERVICE: 'TaskApplicationService',
  NOTIFICATION_APPLICATION_SERVICE: 'NotificationApplicationService',

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

  // Query Handlers
  GET_TASK_HANDLER: 'GetTaskHandler',
  LIST_TASKS_HANDLER: 'ListTasksHandler',
  GET_PROJECT_HANDLER: 'GetProjectHandler',
  LIST_PROJECTS_HANDLER: 'ListProjectsHandler',
  GET_WORKSPACE_HANDLER: 'GetWorkspaceHandler',
  LIST_WORKSPACES_HANDLER: 'ListWorkspacesHandler',
  GET_USER_HANDLER: 'GetUserHandler',
  LIST_USERS_HANDLER: 'ListUsersHandler',

  // Infrastructure Services
  CACHE_SERVICE: 'CacheService',
  EMAIL_SERVICE: 'EmailService',
  JWT_SERVICE: 'JwtService',
  PASSWORD_SERVICE: 'PasswordService',
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

  // Event Handling
  EVENT_BUS: 'EventBus',
  DOMAIN_EVENT_PUBLISHER: 'DomainEventPublisher',

  // Configuration
  APP_CONFIG: 'AppConfig',
  DATABASE_CONFIG: 'DatabaseConfig',
  REDIS_CONFIG: 'RedisConfig',
  JWT_CONFIG: 'JwtConfig',
  EMAIL_CONFIG: 'EmailConfig',
} as const;

export type ServiceToken = (typeof SERVICE_TOKENS)[keyof typeof SERVICE_TOKENS];
