// Application Layer Exports

// CQRS Infrastructure
export * from './cqrs';

// Commands - Base and specific implementations
export { BaseCommand, ICommand } from './commands/base-command';
export * from './commands/task-commands';
export * from './commands/project-commands';
export * from './commands/workspace-commands';
export * from './commands/user-commands';

// Queries - Base and specific implementations  
export { BaseQuery, IQuery, PaginationOptions, PaginatedResult } from './queries/base-query';
export * from './queries/task-queries';
export * from './queries/project-queries';
export * from './queries/workspace-queries';
export * from './queries/user-queries';

// Handlers - Only export the handler classes and interfaces, not the DTOs
export { ICommandHandler, IQueryHandler } from './handlers/base-handler';
export {
  CreateTaskHandler,
  UpdateTaskHandler,
  AssignTaskHandler,
  CompleteTaskHandler
} from './handlers/task-command-handlers';
export {
  GetTaskByIdQueryHandler,
  GetTasksByProjectQueryHandler,
  GetTasksByAssigneeQueryHandler,
  GetOverdueTasksQueryHandler,
  GetTaskStatisticsQueryHandler,
  GetTasksQueryHandler
} from './handlers/task-query-handlers';
export {
  CreateProjectHandler,
  UpdateProjectHandler,
  AddProjectMemberHandler,
  RemoveProjectMemberHandler
} from './handlers/project-command-handlers';
export {
  GetProjectByIdQueryHandler,
  GetProjectsByWorkspaceQueryHandler,
  GetProjectsByUserQueryHandler,
  GetProjectMembersQueryHandler,
  GetProjectStatisticsQueryHandler
} from './handlers/project-query-handlers';
export {
  CreateWorkspaceHandler,
  InviteUserHandler
} from './handlers/workspace-command-handlers';
export {
  GetWorkspaceByIdQueryHandler,
  GetWorkspaceBySlugQueryHandler,
  GetUserWorkspacesQueryHandler,
  GetWorkspaceMembersQueryHandler,
  GetWorkspaceStatisticsQueryHandler,
  GetWorkspaceUsageQueryHandler
} from './handlers/workspace-query-handlers';
export {
  RegisterUserHandler,
  UpdateUserProfileHandler
} from './handlers/user-command-handlers';
export {
  GetUserByIdQueryHandler,
  GetUserByEmailQueryHandler,
  GetUsersQueryHandler,
  GetUserStatisticsQueryHandler,
  SearchUsersQueryHandler
} from './handlers/user-query-handlers';
export {
  CreateNotificationHandler,
  UpdateNotificationHandler,
  MarkNotificationReadHandler
} from './handlers/notification-command-handlers';
export {
  CreateAuditLogHandler,
  CleanupAuditLogsHandler
} from './handlers/audit-log-command-handlers';
export {
  CreateWebhookHandler,
  UpdateWebhookHandler,
  TriggerWebhookHandler
} from './handlers/webhook-command-handlers';
export {
  CreateCalendarEventHandler,
  UpdateCalendarEventHandler,
  ScheduleCalendarEventHandler
} from './handlers/calendar-command-handlers';

// Application Services
export { 
  BaseApplicationService,
  ValidationRule,
  ValidationResult,
  RequiredFieldValidationRule,
  LengthValidationRule
} from './services/base-application-service';
export * from './services/task-application-service';
export * from './services/notification-application-service';
export * from './services/auth-application-service';
export * from './services/project-application-service';
export * from './services/workspace-application-service';
export * from './services/webhook-application-service';
export * from './services/calendar-application-service';

// Use Cases
export * from './use-cases';

// Events
export * from './events';

// Enhanced event infrastructure
export * from './events/domain-event-bus';
export * from './events/event-handler-registry';
