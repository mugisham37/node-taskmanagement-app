import { Container, SERVICE_TOKENS, ServiceLifetime } from './types';
import { ConfigLoader } from '../config';

// Domain Services
import { TaskDomainService } from '../../domain/services/task-domain-service';
import { ProjectDomainService } from '../../domain/services/project-domain-service';
import { WorkspaceDomainService } from '../../domain/services/workspace-domain-service';

// Application Services
import { TaskApplicationService } from '../../application/services/task-application-service';
import { NotificationApplicationService } from '../../application/services/notification-application-service';

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

// Query Handlers
import {
  GetTaskHandler,
  ListTasksHandler,
} from '../../application/handlers/task-query-handlers';

// Infrastructure Services
import { DatabaseConnection } from '../../infrastructure/database/connection';
import { TransactionManager } from '../../infrastructure/database/transaction-manager';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { EmailService } from '../../infrastructure/external-services/email-service';
import { JwtService } from '../../infrastructure/security/jwt-service';
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

// Controllers
import { TaskController } from '../../presentation/controllers/task-controller';
import { ProjectController } from '../../presentation/controllers/project-controller';
import { WorkspaceController } from '../../presentation/controllers/workspace-controller';
import { UserController } from '../../presentation/controllers/user-controller';
import { AuthController } from '../../presentation/controllers/auth-controller';

// Event Handling
import { EventBus } from '../../application/events/event-bus';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';

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
  container.registerSingleton(
    SERVICE_TOKENS.DATABASE_CONNECTION,
    DatabaseConnection,
    [SERVICE_TOKENS.DATABASE_CONFIG]
  );

  container.registerScoped(
    SERVICE_TOKENS.TRANSACTION_MANAGER,
    TransactionManager,
    [SERVICE_TOKENS.DATABASE_CONNECTION]
  );

  // Caching
  container.registerSingleton(SERVICE_TOKENS.CACHE_SERVICE, CacheService, [
    SERVICE_TOKENS.REDIS_CONFIG,
  ]);

  // External Services
  container.registerSingleton(SERVICE_TOKENS.EMAIL_SERVICE, EmailService, [
    SERVICE_TOKENS.EMAIL_CONFIG,
  ]);

  container.registerSingleton(
    SERVICE_TOKENS.WEBSOCKET_SERVICE,
    WebSocketService
  );

  // Security Services
  container.registerSingleton(SERVICE_TOKENS.JWT_SERVICE, JwtService, [
    SERVICE_TOKENS.JWT_CONFIG,
  ]);

  container.registerSingleton(SERVICE_TOKENS.PASSWORD_SERVICE, PasswordService);

  container.registerSingleton(
    SERVICE_TOKENS.RATE_LIMIT_SERVICE,
    RateLimitService,
    [SERVICE_TOKENS.CACHE_SERVICE]
  );

  // Monitoring Services
  container.registerSingleton(SERVICE_TOKENS.LOGGING_SERVICE, LoggingService, [
    SERVICE_TOKENS.APP_CONFIG,
  ]);

  container.registerSingleton(SERVICE_TOKENS.METRICS_SERVICE, MetricsService);

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
    SERVICE_TOKENS.NOTIFICATION_APPLICATION_SERVICE,
    NotificationApplicationService,
    [
      SERVICE_TOKENS.EMAIL_SERVICE,
      SERVICE_TOKENS.WEBSOCKET_SERVICE,
      SERVICE_TOKENS.USER_REPOSITORY,
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
}

function registerQueryHandlers(container: Container): void {
  container.registerScoped(SERVICE_TOKENS.GET_TASK_HANDLER, GetTaskHandler, [
    SERVICE_TOKENS.TASK_REPOSITORY,
  ]);

  container.registerScoped(
    SERVICE_TOKENS.LIST_TASKS_HANDLER,
    ListTasksHandler,
    [SERVICE_TOKENS.TASK_REPOSITORY]
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
}

function registerEventHandling(container: Container): void {
  container.registerSingleton(SERVICE_TOKENS.EVENT_BUS, EventBus);

  container.registerSingleton(
    SERVICE_TOKENS.DOMAIN_EVENT_PUBLISHER,
    DomainEventPublisher,
    [SERVICE_TOKENS.EVENT_BUS]
  );
}
