/**
 * Task Management Domain Layer Exports
 * This module exports all task management domain components
 */

// Aggregates
export {
  TaskAggregate,
  TaskProps,
  TaskAttachment,
  TaskExternalLink,
} from './aggregates/task.aggregate';
export { ProjectAggregate, ProjectProps } from './aggregates/project.aggregate';

// Value Objects
export { TaskId } from './value-objects/task-id';
export { ProjectId } from './value-objects/project-id';
export { WorkspaceId } from './value-objects/workspace-id';
export { TaskStatus, TaskStatusEnum } from './value-objects/task-status';
export { Priority, PriorityEnum } from './value-objects/priority';

// Domain Services
export { TaskDomainService } from './services/task-domain.service';

// Repository Interfaces
export {
  ITaskRepository,
  TaskFilters,
  TaskSimilarityFilters,
} from './repositories/task.repository.interface';
export { IProjectRepository } from './repositories/project.repository.interface';

// Domain Events
export {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskStatusChangedEvent,
  TaskAssignedEvent,
  TaskUnassignedEvent,
  TaskCompletedEvent,
  TaskDeletedEvent,
  TaskWatcherAddedEvent,
} from './aggregates/task.aggregate';

export { ProjectCreatedEvent } from './aggregates/project.aggregate';
