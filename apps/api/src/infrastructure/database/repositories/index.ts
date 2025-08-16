// Export all repository implementations
export { AuditLogRepository } from './audit-log-repository';
export { CalendarEventRepository } from './calendar-event-repository';
export { FileAttachmentRepository } from './file-attachment-repository';
export { NotificationRepository } from './notification-repository';
export { ProjectRepository } from './project-repository';
export { TaskRepository } from './task-repository';
export { UserRepository } from './user-repository';
export { WebhookRepository } from './webhook-repository';
export { WorkspaceRepository } from './workspace-repository';

// Re-export repository interfaces for convenience
export type { IUserRepository, UserFilters, UserSortOptions } from '@taskmanagement/domain';

export type {
  IAuditLogRepository,
  ICalendarEventRepository,
  IFileAttachmentRepository,
  INotificationRepository,
  IProjectRepository,
  ITaskRepository,
  IWebhookRepository,
  IWorkspaceRepository,
  ProjectFilters,
  ProjectSortOptions,
  TaskFilters,
  TaskSortOptions,
  WorkspaceFilters,
  WorkspaceSortOptions,
} from '@taskmanagement/domain';

export type { PaginatedResult, PaginationOptions } from '@taskmanagement/domain';
