import { AuthorizationError } from '@project/core/errors/authorization-error';
import { NotFoundError } from '@project/core/errors/not-found-error';
import { DomainEventPublisher } from '@project/domain/events/domain-event-publisher';
import { IProjectRepository } from '@project/domain/repositories/project-repository';
import { ITaskRepository } from '@project/domain/repositories/task-repository';
import { TaskDomainService } from '@project/domain/services/task-domain-service';
import { TaskId } from '@project/domain/value-objects/task-id';
import { TransactionManager } from '@project/infrastructure/database/transaction-manager';
import { LoggingService } from '@project/infrastructure/monitoring/logging-service';
import {
    AssignTaskCommand,
    CompleteTaskCommand,
    CreateTaskCommand,
    UpdateTaskCommand
} from '../commands/task-commands';
import { BaseHandler, ICommandHandler } from './base-handler';

export class CreateTaskCommandHandler
  extends BaseHandler
  implements ICommandHandler<CreateTaskCommand, TaskId>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly taskDomainService: TaskDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: CreateTaskCommand): Promise<TaskId> {
    this.logInfo('Creating task', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Verify project exists and user has permission
        const project = await this.projectRepository.findById(command.projectId);
        if (!project) {
          throw new NotFoundError(
            `Project with ID ${command.projectId.value} not found`
          );
        }

        if (!project.canUserCreateTask(command.createdById)) {
          throw new AuthorizationError(
            'User does not have permission to create tasks in this project'
          );
        }

        // Create task through domain service
        const task = await this.taskDomainService.createTask({
          title: command.title,
          description: command.description,
          priority: command.priority,
          projectId: command.projectId,
          createdById: command.createdById,
          ...(command.dueDate && { dueDate: command.dueDate }),
          ...(command.assigneeId && { assigneeId: command.assigneeId }),
          ...(command.estimatedHours && { estimatedHours: command.estimatedHours }),
        });

        // Save task
        await this.taskRepository.save(task);

        // Publish domain events
        await this.publishEvents();

        this.logInfo('Task created successfully', { taskId: task.id.value });
        return task.id;
      } catch (error) {
        this.logError('Failed to create task', error as Error, { command });
        throw error;
      }
    });
  }
}

export class UpdateTaskCommandHandler
  extends BaseHandler
  implements ICommandHandler<UpdateTaskCommand>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly taskDomainService: TaskDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: UpdateTaskCommand): Promise<void> {
    this.logInfo('Updating task', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const task = await this.taskRepository.findById(command.taskId);
        if (!task) {
          throw new NotFoundError(
            `Task with ID ${command.taskId.value} not found`
          );
        }

        // Check permissions through domain service
        if (!this.taskDomainService.canUserUpdateTask(task, command.userId)) {
          throw new AuthorizationError(
            'User does not have permission to update this task'
          );
        }

        // Update task properties
        if (command.title !== undefined) {
          task.updateTitle(command.title, command.userId);
        }
        if (command.description !== undefined) {
          task.updateDescription(command.description, command.userId);
        }
        if (command.priority !== undefined) {
          task.updatePriority(command.priority, command.userId);
        }
        if (command.dueDate !== undefined) {
          task.updateDueDate(command.dueDate, command.userId);
        }
        if (command.estimatedHours !== undefined) {
          task.updateEstimatedHours(command.estimatedHours, command.userId);
        }

        await this.taskRepository.save(task);
        await this.publishEvents();

        this.logInfo('Task updated successfully', { taskId: task.id.value });
      } catch (error) {
        this.logError('Failed to update task', error as Error, { command });
        throw error;
      }
    });
  }
}

export class AssignTaskCommandHandler
  extends BaseHandler
  implements ICommandHandler<AssignTaskCommand>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly taskDomainService: TaskDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: AssignTaskCommand): Promise<void> {
    this.logInfo('Assigning task', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const task = await this.taskRepository.findById(command.taskId);
        if (!task) {
          throw new NotFoundError(
            `Task with ID ${command.taskId.value} not found`
          );
        }

        // Assign task through domain service
        await this.taskDomainService.assignTask(
          task,
          command.assigneeId,
          command.assignedBy
        );

        await this.taskRepository.save(task);
        await this.publishEvents();

        this.logInfo('Task assigned successfully', {
          taskId: task.id.value,
          assigneeId: command.assigneeId.value,
        });
      } catch (error) {
        this.logError('Failed to assign task', error as Error, { command });
        throw error;
      }
    });
  }
}

export class CompleteTaskCommandHandler
  extends BaseHandler
  implements ICommandHandler<CompleteTaskCommand>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskRepository: ITaskRepository,
    private readonly taskDomainService: TaskDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: CompleteTaskCommand): Promise<void> {
    this.logInfo('Completing task', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const task = await this.taskRepository.findById(command.taskId);
        if (!task) {
          throw new NotFoundError(
            `Task with ID ${command.taskId.value} not found`
          );
        }

        // Complete task through domain service
        await this.taskDomainService.completeTask(
          task,
          command.completedBy,
          command.actualHours
        );

        await this.taskRepository.save(task);
        await this.publishEvents();

        this.logInfo('Task completed successfully', { taskId: task.id.value });
      } catch (error) {
        this.logError('Failed to complete task', error as Error, { command });
        throw error;
      }
    });
  }
}