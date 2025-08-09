import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { ITaskRepository } from '../../domain/repositories/task-repository';
import { IProjectRepository } from '../../domain/repositories/project-repository';
import { TaskDomainService } from '../../domain/services/task-domain-service';
import { TransactionManager } from '../../infrastructure/database/transaction-manager';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { TaskId } from '../../domain/value-objects/task-id';
import { ProjectId } from '../../domain/value-objects/project-id';
import { UserId } from '../../domain/value-objects/user-id';
import { Priority } from '../../domain/value-objects/priority';
import { TaskStatus } from '../../domain/value-objects/task-status';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { AuthorizationError } from '../../shared/errors/authorization-error';

export interface CreateTaskUseCaseInput {
  title: string;
  description: string;
  priority: Priority;
  projectId: ProjectId;
  createdById: UserId;
  dueDate?: Date;
  assigneeId?: UserId;
  estimatedHours?: number;
}

export interface UpdateTaskUseCaseInput {
  taskId: TaskId;
  userId: UserId;
  title?: string;
  description?: string;
  priority?: Priority;
  dueDate?: Date;
  estimatedHours?: number;
}

export interface AssignTaskUseCaseInput {
  taskId: TaskId;
  assigneeId: UserId;
  assignedBy: UserId;
}

export interface CompleteTaskUseCaseInput {
  taskId: TaskId;
  completedBy: UserId;
  actualHours?: number;
  completionNotes?: string;
}

export class CreateTaskUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly taskDomainService: TaskDomainService,
    private readonly transactionManager: TransactionManager,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly cacheService: CacheService,
    private readonly logger: LoggingService
  ) {}

  async execute(input: CreateTaskUseCaseInput): Promise<TaskId> {
    this.logger.info('Executing CreateTaskUseCase', { input });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Verify project exists and user has permission
        const project = await this.projectRepository.findById(input.projectId);
        if (!project) {
          throw new NotFoundError(
            `Project with ID ${input.projectId.value} not found`
          );
        }

        if (!project.canUserCreateTask(input.createdById)) {
          throw new AuthorizationError(
            'User does not have permission to create tasks in this project'
          );
        }

        // Create task through domain service
        const task = await this.taskDomainService.createTask(input);

        // Save task
        await this.taskRepository.save(task);

        // Invalidate related caches
        await this.invalidateTaskCaches(input.projectId, input.assigneeId);

        // Publish domain events
        await this.eventPublisher.publishAll();

        this.logger.info('Task created successfully', {
          taskId: task.id.value,
        });
        return task.id;
      } catch (error) {
        this.logger.error('Failed to create task', error as Error, { input });
        throw error;
      }
    });
  }

  private async invalidateTaskCaches(
    projectId: ProjectId,
    assigneeId?: UserId
  ): Promise<void> {
    const patterns = [`tasks:project:${projectId.value}:*`, 'task-stats:*'];

    if (assigneeId) {
      patterns.push(`tasks:assignee:${assigneeId.value}:*`);
    }

    for (const pattern of patterns) {
      await this.cacheService.invalidatePattern(pattern);
    }
  }
}

export class UpdateTaskUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly taskDomainService: TaskDomainService,
    private readonly transactionManager: TransactionManager,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly cacheService: CacheService,
    private readonly logger: LoggingService
  ) {}

  async execute(input: UpdateTaskUseCaseInput): Promise<void> {
    this.logger.info('Executing UpdateTaskUseCase', { input });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const task = await this.taskRepository.findById(input.taskId);
        if (!task) {
          throw new NotFoundError(
            `Task with ID ${input.taskId.value} not found`
          );
        }

        // Check permissions through domain service
        if (!this.taskDomainService.canUserUpdateTask(task, input.userId)) {
          throw new AuthorizationError(
            'User does not have permission to update this task'
          );
        }

        // Update task properties
        if (input.title !== undefined) {
          task.updateTitle(input.title, input.userId);
        }
        if (input.description !== undefined) {
          task.updateDescription(input.description, input.userId);
        }
        if (input.priority !== undefined) {
          task.updatePriority(input.priority, input.userId);
        }
        if (input.dueDate !== undefined) {
          task.updateDueDate(input.dueDate, input.userId);
        }
        if (input.estimatedHours !== undefined) {
          task.updateEstimatedHours(input.estimatedHours, input.userId);
        }

        await this.taskRepository.save(task);

        // Invalidate caches
        await this.invalidateTaskCaches(
          input.taskId,
          task.projectId,
          task.assigneeId
        );

        await this.eventPublisher.publishAll();

        this.logger.info('Task updated successfully', {
          taskId: task.id.value,
        });
      } catch (error) {
        this.logger.error('Failed to update task', error as Error, { input });
        throw error;
      }
    });
  }

  private async invalidateTaskCaches(
    taskId: TaskId,
    projectId: ProjectId,
    assigneeId?: UserId
  ): Promise<void> {
    const patterns = [
      `task:${taskId.value}`,
      `tasks:project:${projectId.value}:*`,
      'task-stats:*',
    ];

    if (assigneeId) {
      patterns.push(`tasks:assignee:${assigneeId.value}:*`);
    }

    for (const pattern of patterns) {
      await this.cacheService.invalidatePattern(pattern);
    }
  }
}

export class AssignTaskUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly taskDomainService: TaskDomainService,
    private readonly transactionManager: TransactionManager,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly cacheService: CacheService,
    private readonly logger: LoggingService
  ) {}

  async execute(input: AssignTaskUseCaseInput): Promise<void> {
    this.logger.info('Executing AssignTaskUseCase', { input });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const task = await this.taskRepository.findById(input.taskId);
        if (!task) {
          throw new NotFoundError(
            `Task with ID ${input.taskId.value} not found`
          );
        }

        // Assign task through domain service
        await this.taskDomainService.assignTask(
          task,
          input.assigneeId,
          input.assignedBy
        );

        await this.taskRepository.save(task);

        // Invalidate caches
        await this.invalidateTaskCaches(
          input.taskId,
          task.projectId,
          input.assigneeId
        );

        await this.eventPublisher.publishAll();

        this.logger.info('Task assigned successfully', {
          taskId: task.id.value,
          assigneeId: input.assigneeId.value,
        });
      } catch (error) {
        this.logger.error('Failed to assign task', error as Error, { input });
        throw error;
      }
    });
  }

  private async invalidateTaskCaches(
    taskId: TaskId,
    projectId: ProjectId,
    assigneeId: UserId
  ): Promise<void> {
    const patterns = [
      `task:${taskId.value}`,
      `tasks:project:${projectId.value}:*`,
      `tasks:assignee:${assigneeId.value}:*`,
      'task-stats:*',
    ];

    for (const pattern of patterns) {
      await this.cacheService.invalidatePattern(pattern);
    }
  }
}

export class CompleteTaskUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly taskDomainService: TaskDomainService,
    private readonly transactionManager: TransactionManager,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly cacheService: CacheService,
    private readonly logger: LoggingService
  ) {}

  async execute(input: CompleteTaskUseCaseInput): Promise<void> {
    this.logger.info('Executing CompleteTaskUseCase', { input });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const task = await this.taskRepository.findById(input.taskId);
        if (!task) {
          throw new NotFoundError(
            `Task with ID ${input.taskId.value} not found`
          );
        }

        // Complete task through domain service
        await this.taskDomainService.completeTask(
          task,
          input.completedBy,
          input.actualHours
        );

        await this.taskRepository.save(task);

        // Invalidate caches
        await this.invalidateTaskCaches(
          input.taskId,
          task.projectId,
          task.assigneeId
        );

        await this.eventPublisher.publishAll();

        this.logger.info('Task completed successfully', {
          taskId: task.id.value,
        });
      } catch (error) {
        this.logger.error('Failed to complete task', error as Error, { input });
        throw error;
      }
    });
  }

  private async invalidateTaskCaches(
    taskId: TaskId,
    projectId: ProjectId,
    assigneeId?: UserId
  ): Promise<void> {
    const patterns = [
      `task:${taskId.value}`,
      `tasks:project:${projectId.value}:*`,
      'task-stats:*',
      'tasks:overdue:*',
    ];

    if (assigneeId) {
      patterns.push(`tasks:assignee:${assigneeId.value}:*`);
    }

    for (const pattern of patterns) {
      await this.cacheService.invalidatePattern(pattern);
    }
  }
}
