// Export all repository implementations
export { UserRepository } from './user-repository';
export { TaskRepository } from './task-repository';
export { ProjectRepository } from './project-repository';
export { WorkspaceRepository } from './workspace-repository';
export { NotificationRepository } from './notification-repository';
export { AuditLogRepository } from './audit-log-repository';
export { WebhookRepository } from './webhook-repository';
export { CalendarEventRepository } from './calendar-event-repository';
export { FileAttachmentRepository } from './file-attachment-repository';

// Re-export repository interfaces for convenience
export type {
  IUserRepository,
  UserFilters,
  UserSortOptions,
} from '../../../domain/repositories/user-repository';

export type {
  ITaskRepository,
  TaskFilters,
  TaskSortOptions,
} from '../../../domain/repositories/task-repository';

export type {
  IProjectRepository,
  ProjectFilters,
  ProjectSortOptions,
} from '../../../domain/repositories/project-repository';

export type {
  IWorkspaceRepository,
  WorkspaceFilters,
  WorkspaceSortOptions,
} from '../../../domain/repositories/workspace-repository';

export type { INotificationRepository } from '../../../domain/repositories/notification-repository';

export type { IAuditLogRepository } from '../../../domain/repositories/audit-log-repository';

export type { IWebhookRepository } from '../../../domain/repositories/webhook-repository';

export type { ICalendarEventRepository } from '../../../domain/repositories/calendar-event-repository';

export type { IFileAttachmentRepository } from '../../../domain/repositories/file-attachment-repository';

export type {
  PaginationOptions,
  PaginatedResult,
} from '../../../domain/repositories/user-repository';
