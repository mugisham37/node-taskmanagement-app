import { BaseHandler, ICommandHandler } from './base-handler';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { ITaskRepository } from '../../domain/repositories/task-repository';
import { IProjectRepository } from '../../domain/repositories/project-repository';
import { TaskDomainService } from '../../domain/services/task-domain-service';
import { TransactionManager } from '../../infrastructure/database/transaction-manager';
import {
  CreateTaskCommand,
  UpdateTaskCommand,
  AssignTaskCommand,
  CompleteTaskCommand,
  UpdateTaskStatusCommand,
  DeleteTaskCommand,
  AddTaskDependencyCommand,
  RemoveTaskDependencyCommand,
} from '../commands/task-commands';
import { TaskId, Priority, ProjectId, UserId, TaskStatusVO } from '../../domain/value-objects';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { AuthorizationError } from '../../shared/errors/authorization-error';

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
        const project = await this.projectRepository.findById(
          command.projectId
        );
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
        const createParams: {
          title: string;
          description: string;
          priority: Priority;
          projectId: ProjectId;
          createdById: UserId;
          dueDate?: Date;
          assigneeId?: UserId;
          estimatedHours?: number;
        } = {
          title: command.title,
          description: command.description,
          priority: command.priority,
          projectId: command.projectId,
          createdById: command.createdById,
        };

        // Only add optional properties if they are defined
        if (command.dueDate !== undefined) {
          createParams.dueDate = command.dueDate;
        }
        if (command.assigneeId !== undefined) {
          createParams.assigneeId = command.assigneeId;
        }
        if (command.estimatedHours !== undefined) {
          createParams.estimatedHours = command.estimatedHours;
        }

        const task = await this.taskDomainService.createTask(createParams);

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
  implements ICommandHandler<UpdateTaskCommand, void>
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
  implements ICommandHandler<AssignTaskCommand, void>
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
  implements ICommandHandler<CompleteTaskCommand, void>
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

export class UpdateTaskStatusCommandHandler
  extends BaseHandler
  implements ICommandHandler<UpdateTaskStatusCommand, void>
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

  async handle(command: UpdateTaskStatusCommand): Promise<void> {
    this.logInfo('Updating task status', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const task = await this.taskRepository.findById(command.taskId);
        if (!task) {
          throw new NotFoundError(
            `Task with ID ${command.taskId.value} not found`
          );
        }

        // Update status through domain service
        await this.taskDomainService.updateTaskStatus(
          task,
          TaskStatusVO.create(command.status),
          command.updatedBy
        );

        await this.taskRepository.save(task);
        await this.publishEvents();

        this.logInfo('Task status updated successfully', {
          taskId: task.id.value,
          newStatus: command.status,
        });
      } catch (error) {
        this.logError('Failed to update task status', error as Error, {
          command,
        });
        throw error;
      }
    });
  }
}

export class DeleteTaskCommandHandler
  extends BaseHandler
  implements ICommandHandler<DeleteTaskCommand, void>
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

  async handle(command: DeleteTaskCommand): Promise<void> {
    this.logInfo('Deleting task', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const task = await this.taskRepository.findById(command.taskId);
        if (!task) {
          throw new NotFoundError(
            `Task with ID ${command.taskId.value} not found`
          );
        }

        // Check permissions through domain service
        if (
          !this.taskDomainService.canUserDeleteTask(task, command.deletedBy)
        ) {
          throw new AuthorizationError(
            'User does not have permission to delete this task'
          );
        }

        await this.taskRepository.delete(command.taskId);
        await this.publishEvents();

        this.logInfo('Task deleted successfully', {
          taskId: command.taskId.value,
        });
      } catch (error) {
        this.logError('Failed to delete task', error as Error, { command });
        throw error;
      }
    });
  }
}

export class AddTaskDependencyCommandHandler
  extends BaseHandler
  implements ICommandHandler<AddTaskDependencyCommand, void>
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

  async handle(command: AddTaskDependencyCommand): Promise<void> {
    this.logInfo('Adding task dependency', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Load task aggregate for the project
        const task = await this.taskRepository.findById(command.taskId);
        if (!task) {
          throw new NotFoundError(
            `Task with ID ${command.taskId.value} not found`
          );
        }

        const dependsOnTask = await this.taskRepository.findById(
          command.dependsOnTaskId
        );
        if (!dependsOnTask) {
          throw new NotFoundError(
            `Dependency task with ID ${command.dependsOnTaskId.value} not found`
          );
        }

        // Add dependency through domain service
        await this.taskDomainService.addTaskDependency(
          command.taskId,
          command.dependsOnTaskId
        );

        await this.publishEvents();

        this.logInfo('Task dependency added successfully', {
          taskId: command.taskId.value,
          dependsOnTaskId: command.dependsOnTaskId.value,
        });
      } catch (error) {
        this.logError('Failed to add task dependency', error as Error, {
          command,
        });
        throw error;
      }
    });
  }
}

export class RemoveTaskDependencyCommandHandler
  extends BaseHandler
  implements ICommandHandler<RemoveTaskDependencyCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly taskDomainService: TaskDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: RemoveTaskDependencyCommand): Promise<void> {
    this.logInfo('Removing task dependency', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Remove dependency through domain service
        await this.taskDomainService.removeTaskDependency(
          command.taskId,
          command.dependsOnTaskId
        );

        await this.publishEvents();

        this.logInfo('Task dependency removed successfully', {
          taskId: command.taskId.value,
          dependsOnTaskId: command.dependsOnTaskId.value,
        });
      } catch (error) {
        this.logError('Failed to remove task dependency', error as Error, {
          command,
        });
        throw error;
      }
    });
  }
}

// Export aliases for backward compatibility
export const CreateTaskHandler = CreateTaskCommandHandler;
export const UpdateTaskHandler = UpdateTaskCommandHandler;
export const AssignTaskHandler = AssignTaskCommandHandler;
export const CompleteTaskHandler = CompleteTaskCommandHandler;
