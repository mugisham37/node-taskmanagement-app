import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { EmailService } from '../../infrastructure/external-services/email-service';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { ITaskRepository } from '../../domain/repositories/task-repository';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { IProjectRepository } from '../../domain/repositories/project-repository';
import { TaskDomainService } from '../../domain/services/task-domain-service';
import { TransactionManager } from '../../infrastructure/database/transaction-manager';
import {
  CreateTaskUseCase,
  UpdateTaskUseCase,
  AssignTaskUseCase,
  CompleteTaskUseCase,
  CreateTaskUseCaseInput,
  UpdateTaskUseCaseInput,
  AssignTaskUseCaseInput,
  CompleteTaskUseCaseInput,
} from '../use-cases/task-use-cases';
import {
  GetTaskByIdQueryHandler,
  GetTasksByProjectQueryHandler,
  GetTasksByAssigneeQueryHandler,
  GetOverdueTasksQueryHandler,
  GetTaskStatisticsQueryHandler,
  TaskDto,
  TaskStatisticsDto,
} from '../handlers/task-query-handlers';
import {
  GetTaskByIdQuery,
  GetTasksByProjectQuery,
  GetTasksByAssigneeQuery,
  GetOverdueTasksQuery,
  GetTaskStatisticsQuery,
  TaskFilters,
} from '../queries/task-queries';
import { PaginatedResult, PaginationOptions } from '../queries/base-query';
import { TaskId } from '../../domain/value-objects/task-id';
import { ProjectId } from '../../domain/value-objects/project-id';
import { UserId } from '../../domain/value-objects/user-id';
import { Priority } from '../../domain/value-objects/priority';

export class TaskApplicationService {
  private readonly createTaskUseCase: CreateTaskUseCase;
  private readonly updateTaskUseCase: UpdateTaskUseCase;
  private readonly assignTaskUseCase: AssignTaskUseCase;
  private readonly completeTaskUseCase: CompleteTaskUseCase;

  private readonly getTaskByIdHandler: GetTaskByIdQueryHandler;
  private readonly getTasksByProjectHandler: GetTasksByProjectQueryHandler;
  private readonly getTasksByAssigneeHandler: GetTasksByAssigneeQueryHandler;
  private readonly getOverdueTasksHandler: GetOverdueTasksQueryHandler;
  private readonly getTaskStatisticsHandler: GetTaskStatisticsQueryHandler;

  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly userRepository: IUserRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly taskDomainService: TaskDomainService,
    private readonly transactionManager: TransactionManager,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService,
    private readonly logger: LoggingService
  ) {
    // Initialize use cases
    this.createTaskUseCase = new CreateTaskUseCase(
      taskRepository,
      projectRepository,
      taskDomainService,
      transactionManager,
      eventPublisher,
      cacheService,
      logger
    );

    this.updateTaskUseCase = new UpdateTaskUseCase(
      taskRepository,
      taskDomainService,
      transactionManager,
      eventPublisher,
      cacheService,
      logger
    );

    this.assignTaskUseCase = new AssignTaskUseCase(
      taskRepository,
      taskDomainService,
      transactionManager,
      eventPublisher,
      cacheService,
      logger
    );

    this.completeTaskUseCase = new CompleteTaskUseCase(
      taskRepository,
      taskDomainService,
      transactionManager,
      eventPublisher,
      cacheService,
      logger
    );

    // Initialize query handlers
    this.getTaskByIdHandler = new GetTaskByIdQueryHandler(
      eventPublisher,
      logger,
      taskRepository,
      cacheService
    );

    this.getTasksByProjectHandler = new GetTasksByProjectQueryHandler(
      eventPublisher,
      logger,
      taskRepository,
      cacheService
    );

    this.getTasksByAssigneeHandler = new GetTasksByAssigneeQueryHandler(
      eventPublisher,
      logger,
      taskRepository,
      cacheService
    );

    this.getOverdueTasksHandler = new GetOverdueTasksQueryHandler(
      eventPublisher,
      logger,
      taskRepository,
      cacheService
    );

    this.getTaskStatisticsHandler = new GetTaskStatisticsQueryHandler(
      eventPublisher,
      logger,
      taskRepository,
      cacheService
    );
  }

  // Command operations
  async createTask(input: CreateTaskUseCaseInput): Promise<TaskId> {
    const taskId = await this.createTaskUseCase.execute(input);

    // Send notification if task is assigned
    if (input.assigneeId) {
      await this.sendTaskAssignmentNotification(taskId, input.assigneeId);
    }

    return taskId;
  }

  async updateTask(input: UpdateTaskUseCaseInput): Promise<void> {
    await this.updateTaskUseCase.execute(input);
  }

  async assignTask(input: AssignTaskUseCaseInput): Promise<void> {
    await this.assignTaskUseCase.execute(input);

    // Send assignment notification
    await this.sendTaskAssignmentNotification(input.taskId, input.assigneeId);
  }

  async completeTask(input: CompleteTaskUseCaseInput): Promise<void> {
    await this.completeTaskUseCase.execute(input);

    // Send completion notification
    await this.sendTaskCompletionNotification(input.taskId, input.completedBy);
  }

  // Query operations
  async getTaskById(taskId: TaskId, userId: UserId): Promise<TaskDto> {
    const query = new GetTaskByIdQuery(taskId, userId);
    return await this.getTaskByIdHandler.handle(query);
  }

  async getTasksByProject(
    projectId: ProjectId,
    userId: UserId,
    filters?: TaskFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<TaskDto>> {
    const query = new GetTasksByProjectQuery(
      projectId,
      userId,
      filters,
      pagination
    );
    return await this.getTasksByProjectHandler.handle(query);
  }

  async getTasksByAssignee(
    assigneeId: UserId,
    userId: UserId,
    filters?: TaskFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<TaskDto>> {
    const query = new GetTasksByAssigneeQuery(
      assigneeId,
      userId,
      filters,
      pagination
    );
    return await this.getTasksByAssigneeHandler.handle(query);
  }

  async getOverdueTasks(
    userId: UserId,
    projectId?: ProjectId,
    assigneeId?: UserId,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<TaskDto>> {
    const query = new GetOverdueTasksQuery(
      userId,
      projectId,
      assigneeId,
      pagination
    );
    return await this.getOverdueTasksHandler.handle(query);
  }

  async getTaskStatistics(
    userId: UserId,
    projectId?: ProjectId,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<TaskStatisticsDto> {
    const query = new GetTaskStatisticsQuery(
      userId,
      projectId,
      dateFrom,
      dateTo
    );
    return await this.getTaskStatisticsHandler.handle(query);
  }

  // Notification methods
  private async sendTaskAssignmentNotification(
    taskId: TaskId,
    assigneeId: UserId
  ): Promise<void> {
    try {
      const task = await this.taskRepository.findById(taskId);
      const assignee = await this.userRepository.findById(assigneeId);

      if (task && assignee) {
        // Get project information for the notification
        const project = await this.projectRepository.findById(task.projectId);
        const assigner = await this.userRepository.findById(task.createdById);

        await this.emailService.sendTaskAssignmentNotification(
          assignee.email.value,
          assignee.name,
          task.title,
          task.description || '',
          project?.name || 'Unknown Project',
          assigner?.name || 'Unknown User',
          task.dueDate || undefined
        );
        
        this.logger.info('Task assignment notification sent', {
          taskId: taskId.value,
          assigneeId: assigneeId.value,
        });
      }
    } catch (error) {
      this.logger.error(
        'Failed to send task assignment notification',
        error as Error,
        {
          taskId: taskId.value,
          assigneeId: assigneeId.value,
        }
      );
      // Don't throw - notification failure shouldn't break the main operation
    }
  }

  private async sendTaskCompletionNotification(
    taskId: TaskId,
    completedBy: UserId
  ): Promise<void> {
    try {
      const task = await this.taskRepository.findById(taskId);
      const completedByUser = await this.userRepository.findById(completedBy);

      if (task && completedByUser) {
        // Get project information for the notification
        const project = await this.projectRepository.findById(task.projectId);

        await this.emailService.sendTaskCompletionNotification(
          completedByUser.email.value,
          completedByUser.name,
          task.title,
          project?.name || 'Unknown Project',
          completedByUser.name,
          task.completedAt || new Date()
        );
        
        this.logger.info('Task completion notification sent', {
          taskId: taskId.value,
          completedBy: completedBy.value,
        });
      }
    } catch (error) {
      this.logger.error(
        'Failed to send task completion notification',
        error as Error,
        {
          taskId: taskId.value,
          completedBy: completedBy.value,
        }
      );
      // Don't throw - notification failure shouldn't break the main operation
    }
  }

  // Bulk operations
  async bulkAssignTasks(
    taskIds: TaskId[],
    assigneeId: UserId,
    assignedBy: UserId
  ): Promise<void> {
    this.logger.info('Executing bulk task assignment', {
      taskCount: taskIds.length,
      assigneeId: assigneeId.value,
    });

    await this.transactionManager.executeInTransaction(async () => {
      for (const taskId of taskIds) {
        await this.assignTask({ taskId, assigneeId, assignedBy });
      }
      
      // Clear cache for affected tasks
      await this.cacheService.invalidatePattern(`task:*`);
      await this.cacheService.invalidatePattern(`tasks:assignee:${assigneeId.value}:*`);
    });

    this.logger.info('Bulk task assignment completed', {
      taskCount: taskIds.length,
      assigneeId: assigneeId.value,
    });
  }

  async bulkUpdateTaskPriority(
    taskIds: TaskId[],
    priority: Priority,
    updatedBy: UserId
  ): Promise<void> {
    this.logger.info('Executing bulk task priority update', {
      taskCount: taskIds.length,
      priority: priority.value,
    });

    await this.transactionManager.executeInTransaction(async () => {
      for (const taskId of taskIds) {
        await this.updateTask({ taskId, userId: updatedBy, priority });
      }
      
      // Clear cache for affected tasks
      await this.cacheService.invalidatePattern(`task:*`);
    });

    this.logger.info('Bulk task priority update completed', {
      taskCount: taskIds.length,
      priority: priority.value,
    });
  }

  // Validation methods using task domain service
  async validateTaskAssignment(taskId: TaskId, assigneeId: UserId): Promise<boolean> {
    try {
      const task = await this.taskRepository.findById(taskId);
      
      if (!task) {
        return false;
      }

      // Get user's active tasks for validation (extract items from paginated result)
      const userActiveTasksResult = await this.taskRepository.findByAssigneeId(assigneeId);
      const userActiveTasks = userActiveTasksResult.items;

      // Use task domain service for business validation
      const result = this.taskDomainService.validateTaskAssignment(task, userActiveTasks);
      return result.success;
    } catch (error) {
      this.logger.error('Failed to validate task assignment', error as Error, {
        taskId: taskId.value,
        assigneeId: assigneeId.value,
      });
      return false;
    }
  }

  // Enhanced create task method with event publishing
  async createTaskWithEvents(input: CreateTaskUseCaseInput): Promise<TaskId> {
    const taskId = await this.createTask(input);

    // Publish domain events for task creation
    const task = await this.taskRepository.findById(taskId);
    if (task && task.domainEvents.length > 0) {
      for (const event of task.domainEvents) {
        await this.eventPublisher.publish(event);
      }
      task.clearDomainEvents();
      // Save the task to persist the cleared events
      await this.taskRepository.save(task);
    }

    return taskId;
  }

  // Additional methods needed by controller
  async getTask(userId: string, taskId: string): Promise<TaskDto> {
    const userIdObj = new UserId(userId);
    const taskIdObj = new TaskId(taskId);
    return await this.getTaskById(taskIdObj, userIdObj);
  }

  async deleteTask(userId: string, taskId: string): Promise<void> {
    const userIdObj = new UserId(userId);
    const taskIdObj = new TaskId(taskId);
    
    // Find the task first
    const task = await this.taskRepository.findById(taskIdObj);
    if (!task) {
      throw new Error('Task not found');
    }

    // Delete the task
    await this.taskRepository.delete(taskIdObj);
    
    this.logger.info('Task deleted', { taskId, userId });
  }

  async unassignTask(userId: string, taskId: string): Promise<void> {
    const userIdObj = new UserId(userId);
    const taskIdObj = new TaskId(taskId);
    
    // Find the task
    const task = await this.taskRepository.findById(taskIdObj);
    if (!task) {
      throw new Error('Task not found');
    }

    // Unassign the task
    task.unassign(userIdObj);
    await this.taskRepository.save(task);
    
    this.logger.info('Task unassigned', { taskId, userId });
  }

  async reopenTask(userId: string, taskId: string): Promise<void> {
    const userIdObj = new UserId(userId);
    const taskIdObj = new TaskId(taskId);
    
    // Find the task
    const task = await this.taskRepository.findById(taskIdObj);
    if (!task) {
      throw new Error('Task not found');
    }

    // Reopen the task
    task.reopen(userIdObj);
    await this.taskRepository.save(task);
    
    this.logger.info('Task reopened', { taskId, userId });
  }

  async startTask(userId: string, taskId: string): Promise<void> {
    const userIdObj = new UserId(userId);
    const taskIdObj = new TaskId(taskId);
    
    // Find the task
    const task = await this.taskRepository.findById(taskIdObj);
    if (!task) {
      throw new Error('Task not found');
    }

    // Start the task
    task.start(userIdObj);
    await this.taskRepository.save(task);
    
    this.logger.info('Task started', { taskId, userId });
  }

  async submitForReview(userId: string, taskId: string): Promise<void> {
    const userIdObj = new UserId(userId);
    const taskIdObj = new TaskId(taskId);
    
    // Find the task
    const task = await this.taskRepository.findById(taskIdObj);
    if (!task) {
      throw new Error('Task not found');
    }

    // Complete task and mark for review (using complete method)
    task.complete(userIdObj);
    await this.taskRepository.save(task);
    
    this.logger.info('Task submitted for review', { taskId, userId });
  }

  async cancelTask(userId: string, taskId: string): Promise<void> {
    const userIdObj = new UserId(userId);
    const taskIdObj = new TaskId(taskId);
    
    // Find the task
    const task = await this.taskRepository.findById(taskIdObj);
    if (!task) {
      throw new Error('Task not found');
    }

    // Cancel the task
    task.cancel(userIdObj);
    await this.taskRepository.save(task);
    
    this.logger.info('Task cancelled', { taskId, userId });
  }

  async getTasks(userId: string, filters?: any, page?: number, limit?: number): Promise<PaginatedResult<TaskDto>> {
    const userIdObj = new UserId(userId);
    const pagination = { page: page || 1, limit: limit || 20 };
    
    // Use existing method
    return await this.getTasksByAssignee(userIdObj, userIdObj, filters, pagination);
  }

  async getProjectTasks(projectId: string, userId: string, filters?: any, page?: number, limit?: number): Promise<PaginatedResult<TaskDto>> {
    const userIdObj = new UserId(userId);
    const projectIdObj = new ProjectId(projectId);
    const pagination = { page: page || 1, limit: limit || 20 };
    
    return await this.getTasksByProject(projectIdObj, userIdObj, filters, pagination);
  }

  async getMyTasks(userId: string, filters?: any, page?: number, limit?: number): Promise<PaginatedResult<TaskDto>> {
    const userIdObj = new UserId(userId);
    const pagination = { page: page || 1, limit: limit || 20 };
    
    return await this.getTasksByAssignee(userIdObj, userIdObj, filters, pagination);
  }

  async getAssignedTasks(assigneeId: string, userId: string, filters?: any, page?: number, limit?: number): Promise<PaginatedResult<TaskDto>> {
    const userIdObj = new UserId(userId);
    const assigneeIdObj = new UserId(assigneeId);
    const pagination = { page: page || 1, limit: limit || 20 };
    
    return await this.getTasksByAssignee(assigneeIdObj, userIdObj, filters, pagination);
  }
}
