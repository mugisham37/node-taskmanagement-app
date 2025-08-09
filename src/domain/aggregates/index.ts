export { AggregateRoot } from './aggregate-root';
export {
  TaskAggregate,
  TaskDependency,
  CreateTaskData,
} from './task-aggregate';
export {
  ProjectAggregate,
  CreateProjectData,
  ProjectStatistics,
} from './project-aggregate';
export {
  WorkspaceAggregate,
  CreateWorkspaceData,
  WorkspaceStatistics,
  ProjectSummary,
} from './workspace-aggregate';

// New aggregates for migrated entities
export { NotificationAggregate } from './notification-aggregate';
export { WebhookAggregate } from './webhook-aggregate';
