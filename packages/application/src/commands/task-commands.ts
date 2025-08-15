import { Priority } from '@project/domain/value-objects/priority';
import { ProjectId } from '@project/domain/value-objects/project-id';
import { TaskId } from '@project/domain/value-objects/task-id';
import { TaskStatus } from '@project/domain/value-objects/task-status';
import { UserId } from '@project/domain/value-objects/user-id';
import { BaseCommand } from './base-command';

export class CreateTaskCommand extends BaseCommand {
  constructor(
    public readonly title: string,
    public readonly description: string,
    public readonly priority: Priority,
    public readonly projectId: ProjectId,
    public readonly createdById: UserId,
    userId: UserId,
    public readonly dueDate?: Date,
    public readonly assigneeId?: UserId,
    public readonly estimatedHours?: number
  ) {
    super(userId);
  }
}

export class UpdateTaskCommand extends BaseCommand {
  constructor(
    public readonly taskId: TaskId,
    userId: UserId,
    public readonly title?: string,
    public readonly description?: string,
    public readonly priority?: Priority,
    public readonly dueDate?: Date,
    public readonly estimatedHours?: number
  ) {
    super(userId);
  }
}

export class AssignTaskCommand extends BaseCommand {
  constructor(
    public readonly taskId: TaskId,
    public readonly assigneeId: UserId,
    public readonly assignedBy: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class CompleteTaskCommand extends BaseCommand {
  constructor(
    public readonly taskId: TaskId,
    public readonly completedBy: UserId,
    userId: UserId,
    public readonly actualHours?: number,
    public readonly completionNotes?: string
  ) {
    super(userId);
  }
}

export class UpdateTaskStatusCommand extends BaseCommand {
  constructor(
    public readonly taskId: TaskId,
    public readonly status: TaskStatus,
    public readonly updatedBy: UserId,
    userId: UserId,
    public readonly statusNotes?: string
  ) {
    super(userId);
  }
}

export class DeleteTaskCommand extends BaseCommand {
  constructor(
    public readonly taskId: TaskId,
    public readonly deletedBy: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class AddTaskDependencyCommand extends BaseCommand {
  constructor(
    public readonly taskId: TaskId,
    public readonly dependsOnTaskId: TaskId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class RemoveTaskDependencyCommand extends BaseCommand {
  constructor(
    public readonly taskId: TaskId,
    public readonly dependsOnTaskId: TaskId,
    userId: UserId
  ) {
    super(userId);
  }
}