// Repository interfaces
export {
  ITaskRepository,
  TaskFilters,
  TaskSortOptions,
  PaginationOptions,
  PaginatedResult,
} from './task-repository';
export {
  IProjectRepository,
  ProjectFilters,
  ProjectSortOptions,
} from './project-repository';
export {
  IUserRepository,
  UserFilters,
  UserSortOptions,
} from './user-repository';
export {
  IWorkspaceRepository,
  WorkspaceFilters,
  WorkspaceSortOptions,
} from './workspace-repository';

// New repository interfaces for migrated entities
export type { IActivityTrackingRepository } from './activity-tracking-repository';
export type { IMetricsRepository } from './metrics-repository';
export type { IAuditLogRepository } from './audit-log-repository';
export type {
  INotificationRepository,
  INotificationPreferencesRepository,
} from './notification-repository';
export type { ICalendarEventRepository } from './calendar-event-repository';
export type { IFileAttachmentRepository } from './file-attachment-repository';
export type {
  IWebhookRepository,
  IWebhookDeliveryRepository,
} from './webhook-repository';
export type { IAccountRepository } from './account-repository';
export type { IDeviceRepository } from './device-repository';
