// Base repository exports
export * from './base/interfaces';
export * from './base/types';
export { BaseRepository } from './base/base.repository';

// Repository exports
export { UserRepository, userRepository } from './user.repository';
export { TaskRepository, taskRepository } from './task.repository';
export { ProjectRepository, projectRepository } from './project.repository';
export {
  WorkspaceRepository,
  workspaceRepository,
} from './workspace.repository';

export {
  NotificationRepository,
  notificationRepository,
} from './notification.repository';
export { TeamRepository, teamRepository } from './team.repository';
export { ActivityRepository, activityRepository } from './activity.repository';
export {
  InvitationRepository,
  invitationRepository,
} from './invitation.repository';
export {
  CalendarEventRepository,
  calendarEventRepository,
} from './calendar-event.repository';
export {
  CalendarIntegrationRepository,
  calendarIntegrationRepository,
} from './calendar-integration.repository';
export { FeedbackRepository, feedbackRepository } from './feedback.repository';
export {
  RecurringTaskRepository,
  recurringTaskRepository,
} from './recurring-task.repository';
export {
  TaskTemplateRepository,
  taskTemplateRepository,
} from './task-template.repository';
export { AuditRepository, auditRepository } from './audit.repository';

// Import repository instances
import { userRepository } from './user.repository';
import { taskRepository } from './task.repository';
import { projectRepository } from './project.repository';
import { workspaceRepository } from './workspace.repository';

import { notificationRepository } from './notification.repository';
import { teamRepository } from './team.repository';
import { activityRepository } from './activity.repository';
import { invitationRepository } from './invitation.repository';
import { calendarEventRepository } from './calendar-event.repository';
import { calendarIntegrationRepository } from './calendar-integration.repository';
import { feedbackRepository } from './feedback.repository';
import { recurringTaskRepository } from './recurring-task.repository';
import { taskTemplateRepository } from './task-template.repository';
import { auditRepository } from './audit.repository';

// Repository instances for easy access
export const repositories = {
  user: userRepository,
  task: taskRepository,
  project: projectRepository,
  workspace: workspaceRepository,

  notification: notificationRepository,
  team: teamRepository,
  activity: activityRepository,
  invitation: invitationRepository,
  calendarEvent: calendarEventRepository,
  calendarIntegration: calendarIntegrationRepository,
  feedback: feedbackRepository,
  recurringTask: recurringTaskRepository,
  taskTemplate: taskTemplateRepository,
  audit: auditRepository,
} as const;

// Type exports for repository instances
export type Repositories = typeof repositories;
export type RepositoryName = keyof Repositories;
