/**
 * Task Management Commands
 *
 * This module contains all commands related to task management operations.
 * Commands represent write operations that change the state of tasks.
 */

import { Command } from '../command';
import {
  TaskStatus,
  TaskPriority,
} from '@/domain/task-management/entities/task';

export class CreateTaskCommand extends Command {
  constructor(
    public readonly title: string,
    public readonly description?: string,
    public readonly priority: TaskPriority = TaskPriority.MEDIUM,
    public readonly projectId?: string,
    public readonly assigneeId?: string,
    public readonly dueDate?: Date,
    public readonly estimatedHours?: number,
    public readonly tags: string[] = [],
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class UpdateTaskCommand extends Command {
  constructor(
    public readonly taskId: string,
    public readonly updates: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      projectId?: string;
      assigneeId?: string;
      dueDate?: Date;
      estimatedHours?: number;
      actualHours?: number;
      tags?: string[];
    },
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class DeleteTaskCommand extends Command {
  constructor(
    public readonly taskId: string,
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class AssignTaskCommand extends Command {
  constructor(
    public readonly taskId: string,
    public readonly assigneeId: string,
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class CompleteTaskCommand extends Command {
  constructor(
    public readonly taskId: string,
    public readonly actualHours?: number,
    public readonly completionNotes?: string,
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class BulkUpdateTasksCommand extends Command {
  constructor(
    public readonly taskIds: string[],
    public readonly operation:
      | 'update_status'
      | 'update_priority'
      | 'assign'
      | 'move_project'
      | 'add_tags'
      | 'delete',
    public readonly data: any,
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class MoveTaskToProjectCommand extends Command {
  constructor(
    public readonly taskId: string,
    public readonly projectId: string | null,
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class AddTaskTagsCommand extends Command {
  constructor(
    public readonly taskId: string,
    public readonly tags: string[],
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}

export class RemoveTaskTagsCommand extends Command {
  constructor(
    public readonly taskId: string,
    public readonly tags: string[],
    userId?: string,
    correlationId?: string
  ) {
    super(userId, correlationId);
  }
}
