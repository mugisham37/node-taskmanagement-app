/**
 * Task Command Handlers
 *
 * This module contains all command handlers for task management operations.
 * Command handlers are responsible for executing business logic and coordinating with domain services.
 */

import { CommandHandler } from '../command';
import {
  CreateTaskCommand,
  UpdateTaskCommand,
  DeleteTaskCommand,
  AssignTaskCommand,
  CompleteTaskCommand,
  BulkUpdateTasksCommand,
  MoveTaskToProjectCommand,
  AddTaskTagsCommand,
  RemoveTaskTagsCommand,
} from '../commands/task-commands';
import { Task } from '@/domain/task-management/entities/task';
import { ITaskRepository } from '@/domain/task-management/repositories/task-repository';
import { IProjectRepository } from '@/domain/task-management/repositories/project-repository';
import { IUserRepository } from '@/domain/authentication/repositories/user-repository';
import { IDomainEventBus } from '@/shared/events/domain-event-bus';
import { ILogger } from '@/shared/types/logger';
import { injectable } from '@/application/decorators/injectable';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '@/shared/errors/app-error';

@injectable()
export class CreateTaskCommandHandler extends CommandHandler<
  CreateTaskCommand,
  Task
> {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly eventBus: IDomainEventBus,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getCommandType(): string {
    return 'CreateTaskCommand';
  }

  async handle(command: CreateTaskCommand): Promise<Task> {
    this.logger.info('Creating new task', {
      title: command.title,
      projectId: command.projectId,
      assigneeId: command.assigneeId,
      userId: command.userId,
    });

    // Validate required fields
    if (!command.title?.trim()) {
      throw new ValidationError('Task title is required');
    }

    if (!command.userId) {
      throw new ValidationError('User ID is required');
    }

    // Validate project exists if provided
    if (command.projectId) {
      const project = await this.projectRepository.findById(command.projectId);
      if (!project) {
        throw new NotFoundError('Project', command.projectId);
      }
    }

    // Validate assignee exists if provided
    if (command.assigneeId) {
      const assignee = await this.userRepository.findById(command.assigneeId);
      if (!assignee) {
        throw new NotFoundError('User', command.assigneeId);
      }
    }

    // Create task entity
    const task = Task.create({
      title: command.title.trim(),
      description: command.description?.trim(),
      priority: command.priority,
      projectId: command.projectId,
      assigneeId: command.assigneeId,
      dueDate: command.dueDate,
      estimatedHours: command.estimatedHours,
      tags: command.tags,
      creatorId: command.userId,
    });

    // Save task
    const savedTask = await this.taskRepository.save(task);

    // Publish domain events
    const events = task.getUncommittedEvents();
    for (const event of events) {
      await this.eventBus.publish(event);
    }
    task.markEventsAsCommitted();

    this.logger.info('Task created successfully', {
      taskId: savedTask.id,
      title: savedTask.title,
      userId: command.userId,
    });

    return savedTask;
  }
}

@injectable()
export class UpdateTaskCommandHandler extends CommandHandler<
  UpdateTaskCommand,
  Task
> {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly eventBus: IDomainEventBus,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getCommandType(): string {
    return 'UpdateTaskCommand';
  }

  async handle(command: UpdateTaskCommand): Promise<Task> {
    this.logger.info('Updating task', {
      taskId: command.taskId,
      updates: Object.keys(command.updates),
      userId: command.userId,
    });

    // Get existing task
    const task = await this.taskRepository.findById(command.taskId);
    if (!task) {
      throw new NotFoundError('Task', command.taskId);
    }

    // Check permissions
    if (!command.userId) {
      throw new ValidationError('User ID is required');
    }

    // Validate project exists if being updated
    if (command.updates.projectId) {
      const project = await this.projectRepository.findById(
        command.updates.projectId
      );
      if (!project) {
        throw new NotFoundError('Project', command.updates.projectId);
      }
    }

    // Validate assignee exists if being updated
    if (command.updates.assigneeId) {
      const assignee = await this.userRepository.findById(
        command.updates.assigneeId
      );
      if (!assignee) {
        throw new NotFoundError('User', command.updates.assigneeId);
      }
    }

    // Apply updates
    if (command.updates.title !== undefined) {
      task.updateTitle(command.updates.title, command.userId);
    }

    if (command.updates.description !== undefined) {
      task.updateDescription(command.updates.description, command.userId);
    }

    if (command.updates.status !== undefined) {
      task.updateStatus(command.updates.status, command.userId);
    }

    if (command.updates.priority !== undefined) {
      task.updatePriority(command.updates.priority, command.userId);
    }

    if (command.updates.assigneeId !== undefined) {
      task.assignTo(command.updates.assigneeId, command.userId);
    }

    if (command.updates.dueDate !== undefined) {
      task.updateDueDate(command.updates.dueDate, command.userId);
    }

    if (command.updates.estimatedHours !== undefined) {
      task.updateEstimatedHours(command.updates.estimatedHours, command.userId);
    }

    if (command.updates.actualHours !== undefined) {
      task.updateActualHours(command.updates.actualHours, command.userId);
    }

    if (command.updates.tags !== undefined) {
      task.updateTags(command.updates.tags, command.userId);
    }

    if (command.updates.projectId !== undefined) {
      task.moveToProject(command.updates.projectId, command.userId);
    }

    // Save updated task
    const savedTask = await this.taskRepository.save(task);

    // Publish domain events
    const events = task.getUncommittedEvents();
    for (const event of events) {
      await this.eventBus.publish(event);
    }
    task.markEventsAsCommitted();

    this.logger.info('Task updated successfully', {
      taskId: savedTask.id,
      userId: command.userId,
    });

    return savedTask;
  }
}

@injectable()
export class DeleteTaskCommandHandler extends CommandHandler<
  DeleteTaskCommand,
  void
> {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly eventBus: IDomainEventBus,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getCommandType(): string {
    return 'DeleteTaskCommand';
  }

  async handle(command: DeleteTaskCommand): Promise<void> {
    this.logger.info('Deleting task', {
      taskId: command.taskId,
      userId: command.userId,
    });

    // Get existing task
    const task = await this.taskRepository.findById(command.taskId);
    if (!task) {
      throw new NotFoundError('Task', command.taskId);
    }

    if (!command.userId) {
      throw new ValidationError('User ID is required');
    }

    // Check permissions - only creator can delete
    if (task.creatorId !== command.userId) {
      throw new ForbiddenError('Only the task creator can delete this task');
    }

    // Mark task as deleted
    task.delete(command.userId);

    // Save task (soft delete)
    await this.taskRepository.save(task);

    // Publish domain events
    const events = task.getUncommittedEvents();
    for (const event of events) {
      await this.eventBus.publish(event);
    }
    task.markEventsAsCommitted();

    this.logger.info('Task deleted successfully', {
      taskId: command.taskId,
      userId: command.userId,
    });
  }
}

@injectable()
export class AssignTaskCommandHandler extends CommandHandler<
  AssignTaskCommand,
  Task
> {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly userRepository: IUserRepository,
    private readonly eventBus: IDomainEventBus,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getCommandType(): string {
    return 'AssignTaskCommand';
  }

  async handle(command: AssignTaskCommand): Promise<Task> {
    this.logger.info('Assigning task', {
      taskId: command.taskId,
      assigneeId: command.assigneeId,
      userId: command.userId,
    });

    // Get existing task
    const task = await this.taskRepository.findById(command.taskId);
    if (!task) {
      throw new NotFoundError('Task', command.taskId);
    }

    if (!command.userId) {
      throw new ValidationError('User ID is required');
    }

    // Validate assignee exists
    const assignee = await this.userRepository.findById(command.assigneeId);
    if (!assignee) {
      throw new NotFoundError('User', command.assigneeId);
    }

    // Assign task
    task.assignTo(command.assigneeId, command.userId);

    // Save task
    const savedTask = await this.taskRepository.save(task);

    // Publish domain events
    const events = task.getUncommittedEvents();
    for (const event of events) {
      await this.eventBus.publish(event);
    }
    task.markEventsAsCommitted();

    this.logger.info('Task assigned successfully', {
      taskId: savedTask.id,
      assigneeId: command.assigneeId,
      userId: command.userId,
    });

    return savedTask;
  }
}

@injectable()
export class CompleteTaskCommandHandler extends CommandHandler<
  CompleteTaskCommand,
  Task
> {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly eventBus: IDomainEventBus,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getCommandType(): string {
    return 'CompleteTaskCommand';
  }

  async handle(command: CompleteTaskCommand): Promise<Task> {
    this.logger.info('Completing task', {
      taskId: command.taskId,
      actualHours: command.actualHours,
      userId: command.userId,
    });

    // Get existing task
    const task = await this.taskRepository.findById(command.taskId);
    if (!task) {
      throw new NotFoundError('Task', command.taskId);
    }

    if (!command.userId) {
      throw new ValidationError('User ID is required');
    }

    // Complete task
    task.complete(command.userId, command.actualHours, command.completionNotes);

    // Save task
    const savedTask = await this.taskRepository.save(task);

    // Publish domain events
    const events = task.getUncommittedEvents();
    for (const event of events) {
      await this.eventBus.publish(event);
    }
    task.markEventsAsCommitted();

    this.logger.info('Task completed successfully', {
      taskId: savedTask.id,
      userId: command.userId,
    });

    return savedTask;
  }
}

@injectable()
export class BulkUpdateTasksCommandHandler extends CommandHandler<
  BulkUpdateTasksCommand,
  { updated: number; failed: string[] }
> {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly eventBus: IDomainEventBus,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected getCommandType(): string {
    return 'BulkUpdateTasksCommand';
  }

  async handle(
    command: BulkUpdateTasksCommand
  ): Promise<{ updated: number; failed: string[] }> {
    this.logger.info('Bulk updating tasks', {
      operation: command.operation,
      taskCount: command.taskIds.length,
      userId: command.userId,
    });

    const results = { updated: 0, failed: [] as string[] };

    if (!command.userId) {
      throw new ValidationError('User ID is required');
    }

    for (const taskId of command.taskIds) {
      try {
        const task = await this.taskRepository.findById(taskId);
        if (!task) {
          results.failed.push(taskId);
          continue;
        }

        // Apply bulk operation
        switch (command.operation) {
          case 'update_status':
            task.updateStatus(command.data.status, command.userId);
            break;
          case 'update_priority':
            task.updatePriority(command.data.priority, command.userId);
            break;
          case 'assign':
            task.assignTo(command.data.assigneeId, command.userId);
            break;
          case 'move_project':
            task.moveToProject(command.data.projectId, command.userId);
            break;
          case 'add_tags':
            const currentTags = task.tags || [];
            const newTags = [...currentTags, ...command.data.tags];
            task.updateTags(newTags, command.userId);
            break;
          case 'delete':
            task.delete(command.userId);
            break;
        }

        // Save task
        await this.taskRepository.save(task);

        // Publish domain events
        const events = task.getUncommittedEvents();
        for (const event of events) {
          await this.eventBus.publish(event);
        }
        task.markEventsAsCommitted();

        results.updated++;
      } catch (error) {
        this.logger.error('Failed to update task in bulk operation', {
          taskId,
          operation: command.operation,
          error: error instanceof Error ? error.message : String(error),
        });
        results.failed.push(taskId);
      }
    }

    this.logger.info('Bulk update completed', {
      operation: command.operation,
      updated: results.updated,
      failed: results.failed.length,
      userId: command.userId,
    });

    return results;
  }
}
