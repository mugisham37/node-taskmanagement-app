import { IContainer, ServiceLifetime } from './container';
import { getInjectableToken } from './decorators';

export interface IServiceRegistry {
  registerDomainServices(container: IContainer): void;
  registerApplicationServices(container: IContainer): void;
  registerInfrastructureServices(container: IContainer): void;
  registerPresentationServices(container: IContainer): void;
}

export class ServiceRegistry implements IServiceRegistry {
  registerDomainServices(container: IContainer): void {
    // Domain Services
    this.registerService(
      container,
      'IUserDomainService',
      require('@/domain/authentication/services/user-domain.service')
        .UserDomainService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'ITaskDomainService',
      require('@/domain/task-management/services/task-domain.service')
        .TaskDomainService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IProjectDomainService',
      require('@/domain/task-management/services/project-domain.service')
        .ProjectDomainService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IWorkspaceDomainService',
      require('@/domain/task-management/services/workspace-domain.service')
        .WorkspaceDomainService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'INotificationDomainService',
      require('@/domain/notification/services/notification-domain.service')
        .NotificationDomainService,
      ServiceLifetime.SCOPED
    );

    // Domain Event Bus
    this.registerService(
      container,
      'IDomainEventBus',
      require('@/application/events/domain-event-bus').DomainEventBus,
      ServiceLifetime.SINGLETON
    );
  }

  registerApplicationServices(container: IContainer): void {
    // Application Services
    this.registerService(
      container,
      'IUserService',
      require('@/application/services/user.service').UserService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'ITaskService',
      require('@/application/services/task.service').TaskService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IProjectService',
      require('@/application/services/project.service').ProjectService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IWorkspaceService',
      require('@/application/services/workspace.service').WorkspaceService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'INotificationService',
      require('@/application/services/notification.service')
        .NotificationService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IEmailService',
      require('@/application/services/email.service').EmailService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IAnalyticsService',
      require('@/application/services/analytics.service').AnalyticsService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'ISearchService',
      require('@/application/services/search.service').SearchService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IFileManagementService',
      require('@/application/services/file-management.service')
        .FileManagementService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IWebhookService',
      require('@/application/services/webhook-management.service')
        .WebhookManagementService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IWebSocketService',
      require('@/application/services/websocket.service').WebSocketService,
      ServiceLifetime.SINGLETON
    );
    this.registerService(
      container,
      'ICalendarService',
      require('@/application/services/calendar.service').CalendarService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'ITeamService',
      require('@/application/services/team.service').TeamService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IInvitationService',
      require('@/application/services/invitation.service').InvitationService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'ICommentService',
      require('@/application/services/comment.service').CommentService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IActivityService',
      require('@/application/services/activity.service').ActivityService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IDashboardService',
      require('@/application/services/dashboard.service').DashboardService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IFeedbackService',
      require('@/application/services/feedback.service').FeedbackService,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IPresenceService',
      require('@/application/services/presence.service').PresenceService,
      ServiceLifetime.SINGLETON
    );
    this.registerService(
      container,
      'ISystemMonitoringService',
      require('@/application/services/system-monitoring.service')
        .SystemMonitoringService,
      ServiceLifetime.SINGLETON
    );
  }

  registerInfrastructureServices(container: IContainer): void {
    // Database and Repositories
    this.registerService(
      container,
      'PrismaClient',
      require('@/infrastructure/database/prisma-client').prisma,
      ServiceLifetime.SINGLETON
    );

    // Repository Implementations
    this.registerService(
      container,
      'IUserRepository',
      require('@/db/repositories/user.repository').UserRepository,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'ITaskRepository',
      require('@/db/repositories/task.repository').TaskRepository,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IProjectRepository',
      require('@/db/repositories/project.repository').ProjectRepository,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IWorkspaceRepository',
      require('@/db/repositories/workspace.repository').WorkspaceRepository,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'INotificationRepository',
      require('@/db/repositories/notification.repository')
        .NotificationRepository,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'ITeamRepository',
      require('@/db/repositories/team.repository').TeamRepository,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IInvitationRepository',
      require('@/db/repositories/invitation.repository').InvitationRepository,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'ICommentRepository',
      require('@/db/repositories/comment.repository').CommentRepository,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IActivityRepository',
      require('@/db/repositories/activity.repository').ActivityRepository,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IFeedbackRepository',
      require('@/db/repositories/feedback.repository').FeedbackRepository,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'ICalendarEventRepository',
      require('@/db/repositories/calendar-event.repository')
        .CalendarEventRepository,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IRecurringTaskRepository',
      require('@/db/repositories/recurring-task.repository')
        .RecurringTaskRepository,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'ITaskTemplateRepository',
      require('@/db/repositories/task-template.repository')
        .TaskTemplateRepository,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'IAuditRepository',
      require('@/db/repositories/audit.repository').AuditRepository,
      ServiceLifetime.SCOPED
    );

    // External Services
    this.registerService(
      container,
      'IEmailProvider',
      require('@/infrastructure/email/email-delivery-provider')
        .EmailDeliveryProvider,
      ServiceLifetime.SINGLETON
    );
    this.registerService(
      container,
      'IPushProvider',
      require('@/infrastructure/push/push-delivery-provider')
        .PushDeliveryProvider,
      ServiceLifetime.SINGLETON
    );
    this.registerService(
      container,
      'IStorageService',
      require('@/infrastructure/storage/storage-factory.service')
        .StorageFactoryService,
      ServiceLifetime.SINGLETON
    );
    this.registerService(
      container,
      'IWebhookDeliveryProvider',
      require('@/infrastructure/webhook/webhook-delivery-provider')
        .WebhookDeliveryProvider,
      ServiceLifetime.SINGLETON
    );

    // Caching (will be implemented in Phase 3)
    // this.registerService(container, 'ICacheManager', require('@/infrastructure/cache/redis-cache-manager').RedisCacheManager, ServiceLifetime.SINGLETON);

    // Logging and Monitoring
    this.registerService(
      container,
      'ILogger',
      require('@/infrastructure/logging/logger').logger,
      ServiceLifetime.SINGLETON
    );

    // Configuration
    this.registerService(
      container,
      'IConfiguration',
      require('@/infrastructure/config/environment').config,
      ServiceLifetime.SINGLETON
    );
  }

  registerPresentationServices(container: IContainer): void {
    // Controllers
    this.registerService(
      container,
      'AuthController',
      require('@/presentation/controllers/auth.controller').AuthController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'UserController',
      require('@/presentation/controllers/user.controller').UserController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'TaskController',
      require('@/presentation/controllers/task.controller').TaskController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'ProjectController',
      require('@/presentation/controllers/project.controller')
        .ProjectController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'WorkspaceController',
      require('@/presentation/controllers/workspace.controller')
        .WorkspaceController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'NotificationController',
      require('@/presentation/controllers/notification.controller')
        .NotificationController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'TeamController',
      require('@/presentation/controllers/team.controller').TeamController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'InvitationController',
      require('@/presentation/controllers/invitation.controller')
        .InvitationController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'CommentController',
      require('@/presentation/controllers/comment.controller')
        .CommentController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'ActivityController',
      require('@/presentation/controllers/activity.controller')
        .ActivityController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'DashboardController',
      require('@/presentation/controllers/dashboard.controller')
        .DashboardController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'FeedbackController',
      require('@/presentation/controllers/feedback.controller')
        .FeedbackController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'CalendarController',
      require('@/presentation/controllers/calendar.controller')
        .CalendarController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'SearchController',
      require('@/presentation/controllers/search.controller').SearchController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'FileManagementController',
      require('@/presentation/controllers/file-management.controller')
        .FileManagementController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'WebhookController',
      require('@/presentation/controllers/webhook.controller')
        .WebhookController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'AnalyticsController',
      require('@/presentation/controllers/analytics.controller')
        .AnalyticsController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'HealthController',
      require('@/presentation/controllers/health.controller').HealthController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'MonitoringController',
      require('@/presentation/controllers/monitoring.controller')
        .MonitoringController,
      ServiceLifetime.SCOPED
    );
    this.registerService(
      container,
      'PresenceController',
      require('@/presentation/controllers/presence.controller')
        .PresenceController,
      ServiceLifetime.SCOPED
    );
  }

  private registerService(
    container: IContainer,
    token: string,
    implementation: any,
    lifetime: ServiceLifetime
  ): void {
    try {
      // Handle both class constructors and instances
      if (typeof implementation === 'function') {
        container.register(token, implementation, lifetime);
      } else {
        // For singleton instances (like logger, config)
        container.registerFactory(
          token,
          () => implementation,
          ServiceLifetime.SINGLETON
        );
      }
    } catch (error) {
      console.warn(`Failed to register service '${token}':`, error.message);
      // Continue registration of other services
    }
  }
}

export const serviceRegistry = new ServiceRegistry();
