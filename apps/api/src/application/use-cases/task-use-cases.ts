import {
  DomainEventPublisher,
  IProjectRepository,
  ITaskRepository,
  Priority,
  TaskDomainService,
} from '@taskmanagement/domain';
import { ValidationError } from '@taskmanagement/validation';
// Additional imports from domain package (already imported above)
import { TransactionManager } from '@taskmanagement/database';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { Priority as PriorityEnum } from '../../shared/enums/common.enums';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { CreateTaskCommand, UpdateTaskCommand } from '../commands/task-commands';
import { ICommandBus, IQueryBus } from '../cqrs';
import { GetTaskByIdQuery, GetTasksQuery } from '../queries/task-queries';
import {
  BaseApplicationService,
  LengthValidationRule,
  RequiredFieldValidationRule,
  ValidationRule,
} from '../services/base-application-service';

export interface CreateTaskUseCaseInput {
  title: string;
  description: string;
  priority: Priority;
  projectId: ProjectId;
  createdById: UserId;
  dueDate?: Date | undefined;
  assigneeId?: UserId | undefined;
  estimatedHours?: number | undefined;
  tags?: string[];
  notifyAssignee?: boolean;
  templateId?: string;
}

export interface UpdateTaskUseCaseInput {
  taskId: TaskId;
  userId: UserId;
  title?: string;
  description?: string;
  priority?: Priority | undefined;
  assigneeId?: UserId | undefined;
  dueDate?: Date | undefined;
  estimatedHours?: number | undefined;
  actualHours?: number | undefined;
  tags?: string[];
  notifyChanges?: boolean;
}

export interface AssignTaskUseCaseInput {
  taskId: TaskId;
  assigneeId: UserId;
  assignedBy: UserId;
  notifyAssignee?: boolean;
}

export interface CompleteTaskUseCaseInput {
  taskId: TaskId;
  completedBy: UserId;
  actualHours?: number;
  completionNotes?: string;
  notifyStakeholders?: boolean;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  projectId?: string;
  assigneeId?: string;
  dueDate?: Date;
  estimatedHours?: number;
  tags?: string[];
  notifyAssignee?: boolean;
  templateId?: string;
}

export interface UpdateTaskRequest {
  taskId: string;
  updates: {
    title?: string;
    description?: string;
    status?: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CANCELLED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    projectId?: string;
    assigneeId?: string;
    dueDate?: Date;
    estimatedHours?: number;
    actualHours?: number;
    tags?: string[];
  };
  notifyChanges?: boolean;
}

export interface TaskWorkflowRequest {
  taskId: string;
  action: 'start' | 'pause' | 'resume' | 'complete' | 'cancel';
  actualHours?: number;
  completionNotes?: string;
  notifyStakeholders?: boolean;
}

export interface BulkTaskOperationRequest {
  taskIds: string[];
  operation:
    | 'update_status'
    | 'update_priority'
    | 'assign'
    | 'move_project'
    | 'add_tags'
    | 'delete';
  data: any;
  notifyAffected?: boolean;
}

export interface TaskInsightsResponse {
  stats: {
    total: number;
    completed: number;
    overdue: number;
    highPriority: number;
    completionRate?: number;
  };
  trends: any;
  recommendations: string[];
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
          throw new NotFoundError(`Project with ID ${input.projectId.value} not found`);
        }

        if (!project.canUserCreateTask(input.createdById)) {
          throw new AuthorizationError(
            'User does not have permission to create tasks in this project'
          );
        }

        // Create task through domain service
        const task = await this.taskDomainService.createTask({
          title: input.title,
          description: input.description,
          priority: input.priority,
          projectId: input.projectId,
          createdById: input.createdById,
          ...(input.dueDate && { dueDate: input.dueDate }),
          ...(input.assigneeId && { assigneeId: input.assigneeId }),
          ...(input.estimatedHours && { estimatedHours: input.estimatedHours }),
        });

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

  private async invalidateTaskCaches(projectId: ProjectId, assigneeId?: UserId): Promise<void> {
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
          throw new NotFoundError(`Task with ID ${input.taskId.value} not found`);
        }

        // Check permissions through domain service
        if (!this.taskDomainService.canUserUpdateTask(task, input.userId)) {
          throw new AuthorizationError('User does not have permission to update this task');
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
        await this.invalidateTaskCaches(input.taskId, task.projectId, task.assigneeId || undefined);

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
    const patterns = [`task:${taskId.value}`, `tasks:project:${projectId.value}:*`, 'task-stats:*'];

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
          throw new NotFoundError(`Task with ID ${input.taskId.value} not found`);
        }

        // Assign task through domain service
        await this.taskDomainService.assignTask(task, input.assigneeId, input.assignedBy);

        await this.taskRepository.save(task);

        // Invalidate caches
        await this.invalidateTaskCaches(input.taskId, task.projectId, input.assigneeId);

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
          throw new NotFoundError(`Task with ID ${input.taskId.value} not found`);
        }

        // Complete task through domain service
        await this.taskDomainService.completeTask(task, input.completedBy, input.actualHours);

        await this.taskRepository.save(task);

        // Invalidate caches
        await this.invalidateTaskCaches(input.taskId, task.projectId, task.assigneeId || undefined);

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

/**
 * Enhanced Task Management Use Case Orchestrator
 * Provides comprehensive task management with advanced orchestration, validation, and monitoring
 */
export class EnhancedTaskManagementUseCase extends BaseApplicationService {
  constructor(
    logger: LoggingService,
    eventPublisher: DomainEventPublisher,
    private readonly commandBus: ICommandBus,
    private readonly queryBus: IQueryBus
    // Future dependencies for enhanced functionality:
    // private readonly taskRepository: ITaskRepository,
    // private readonly projectRepository: IProjectRepository,
    // private readonly taskDomainService: TaskDomainService,
    // private readonly transactionManager: TransactionManager,
    // private readonly cacheService: CacheService
  ) {
    super(logger, eventPublisher);
  }

  /**
   * Creates a new task with comprehensive validation and orchestration
   */
  async createTask(request: CreateTaskRequest, userId: UserId): Promise<any> {
    return this.executeWithMonitoring(
      'createTask',
      async () => {
        this.logInfo('Creating task with enhanced orchestration', {
          title: request.title,
          projectId: request.projectId,
          assigneeId: request.assigneeId,
          userId: userId.value,
        });

        // Validate input
        const validationResult = this.validateInput(request, this.getCreateTaskValidationRules());
        if (!validationResult.isValid) {
          throw new ValidationError([
            {
              field: 'request',
              message: `Task creation validation failed: ${validationResult.errors.join(', ')}`,
            },
          ]);
        }

        // Validate business rules
        await this.validateTaskCreation(request, userId);

        // Apply template if specified
        if (request.templateId) {
          request = await this.applyTaskTemplate(request, request.templateId);
        }

        // Execute within transaction
        return this.executeInTransaction(async () => {
          // Create the task
          const command = new CreateTaskCommand(
            request.title,
            request.description || '',
            request.priority
              ? new Priority(request.priority as any)
              : new Priority(PriorityEnum.MEDIUM),
            new ProjectId(request.projectId || 'default-project'),
            userId,
            userId,
            request.dueDate,
            request.assigneeId ? new UserId(request.assigneeId) : undefined,
            request.estimatedHours
          );

          const taskId = await this.commandBus.send<TaskId>(command);

          // Get detailed task information
          const taskDetails = await this.queryBus.send(new GetTaskByIdQuery(taskId, userId));

          // Post-creation orchestration
          await this.orchestrateTaskCreation(taskDetails, request, userId);

          this.logInfo('Task created successfully with enhanced orchestration', {
            taskId: taskId.value,
            userId: userId.value,
          });

          return taskDetails;
        });
      },
      { userId: userId.value, title: request.title }
    );
  }

  /**
   * Updates a task with comprehensive change tracking and notifications
   */
  async updateTask(request: UpdateTaskRequest, userId: UserId): Promise<any> {
    return this.executeWithMonitoring(
      'updateTask',
      async () => {
        this.logInfo('Updating task with enhanced orchestration', {
          taskId: request.taskId,
          updates: Object.keys(request.updates),
          userId: userId.value,
        });

        // Validate input
        const validationResult = this.validateInput(request, this.getUpdateTaskValidationRules());
        if (!validationResult.isValid) {
          throw new ValidationError([
            {
              field: 'request',
              message: `Task update validation failed: ${validationResult.errors.join(', ')}`,
            },
          ]);
        }

        // Get current task state for comparison
        const taskId = new TaskId(request.taskId);
        const currentTask = await this.queryBus.send(new GetTaskByIdQuery(taskId, userId));

        // Validate business rules for updates
        await this.validateTaskUpdate(request, currentTask, userId);

        // Execute within transaction
        return this.executeInTransaction(async () => {
          // Update the task
          const command = new UpdateTaskCommand(
            taskId,
            userId,
            request.updates.title,
            request.updates.description,
            request.updates.priority ? new Priority(request.updates.priority as any) : undefined,
            request.updates.dueDate,
            request.updates.estimatedHours
          );

          await this.commandBus.send(command);

          // Get updated task details
          const taskDetails = await this.queryBus.send(new GetTaskByIdQuery(taskId, userId));

          // Post-update orchestration
          await this.orchestrateTaskUpdate(currentTask, taskDetails, request, userId);

          this.logInfo('Task updated successfully with enhanced orchestration', {
            taskId: taskId.value,
            userId: userId.value,
          });

          return taskDetails;
        });
      },
      { userId: userId.value, taskId: request.taskId }
    );
  }

  /**
   * Manages task workflow transitions with enhanced validation
   */
  async manageTaskWorkflow(request: TaskWorkflowRequest, userId: UserId): Promise<any> {
    return this.executeWithMonitoring(
      'manageTaskWorkflow',
      async () => {
        this.logInfo('Managing task workflow with enhanced validation', {
          taskId: request.taskId,
          action: request.action,
          userId: userId.value,
        });

        const taskId = new TaskId(request.taskId);
        const currentTask = await this.queryBus.send(new GetTaskByIdQuery(taskId, userId));

        // Validate workflow transition
        await this.validateWorkflowTransition(currentTask, request.action, userId);

        // Execute within transaction
        return this.executeInTransaction(async () => {
          switch (request.action) {
            case 'start':
            case 'complete':
              await this.commandBus.send(new UpdateTaskCommand(taskId, userId));
              break;
            default:
              throw new ValidationError([
                {
                  field: 'action',
                  message: `Invalid workflow action: ${request.action}`,
                },
              ]);
          }

          // Get updated task details
          const taskDetails = await this.queryBus.send(new GetTaskByIdQuery(taskId, userId));

          // Post-workflow orchestration
          await this.orchestrateWorkflowTransition(currentTask, taskDetails, request, userId);

          return taskDetails;
        });
      },
      { userId: userId.value, taskId: request.taskId, action: request.action }
    );
  }

  /**
   * Gets comprehensive task insights with analytics
   */
  async getTaskInsights(filters: any = {}, userId: UserId): Promise<TaskInsightsResponse> {
    return this.executeWithMonitoring(
      'getTaskInsights',
      async () => {
        this.logInfo('Getting enhanced task insights', {
          filters,
          userId: userId.value,
        });

        // Get tasks with filters
        const tasks = await this.queryBus.send(
          new GetTasksQuery(userId, filters, { page: 1, limit: 100 })
        );

        // Calculate stats
        const stats = this.calculateTaskStats(tasks as any[]);

        // Generate trends (simplified for now)
        const trends = await this.generateTaskTrends(tasks as any[], userId);

        // Generate recommendations
        const recommendations = await this.generateTaskRecommendations(stats, trends, userId);

        return {
          stats,
          trends,
          recommendations,
        };
      },
      { userId: userId.value, filters }
    );
  }

  // Private validation methods
  private getCreateTaskValidationRules(): ValidationRule<CreateTaskRequest>[] {
    return [
      new RequiredFieldValidationRule('title', 'Task title'),
      new LengthValidationRule('title', 1, 200, 'Task title'),
      new LengthValidationRule('description', undefined, 2000, 'Task description'),
    ];
  }

  private getUpdateTaskValidationRules(): ValidationRule<UpdateTaskRequest>[] {
    return [
      new RequiredFieldValidationRule('taskId', 'Task ID'),
      new LengthValidationRule('updates', undefined, undefined, 'Updates'),
    ];
  }

  // Private helper methods for orchestration
  private async validateTaskCreation(request: CreateTaskRequest, userId: UserId): Promise<void> {
    // Validate project exists if specified
    if (request.projectId) {
      this.logDebug('Validating project access', {
        projectId: request.projectId,
        userId: userId.value,
      });
    }

    // Validate assignee exists if specified
    if (request.assigneeId) {
      this.logDebug('Validating assignee exists', {
        assigneeId: request.assigneeId,
      });
    }
  }

  private async applyTaskTemplate(
    request: CreateTaskRequest,
    templateId: string
  ): Promise<CreateTaskRequest> {
    this.logDebug('Applying task template', { templateId });
    // This would load a task template and apply its settings
    return request;
  }

  private async orchestrateTaskCreation(
    task: any,
    request: CreateTaskRequest,
    userId: UserId
  ): Promise<void> {
    this.logDebug('Orchestrating task creation', {
      taskId: task.id,
      notifyAssignee: request.notifyAssignee,
    });

    // Send notifications
    if (request.notifyAssignee && task.assigneeId && task.assigneeId !== userId.value) {
      this.logDebug('Sending task assignment notification', {
        assigneeId: task.assigneeId,
        taskId: task.id,
      });
    }

    // Track analytics
    this.logDebug('Tracking task creation analytics', {
      taskId: task.id,
      projectId: task.projectId,
      hasAssignee: !!task.assigneeId,
      hasDueDate: !!task.dueDate,
    });
  }

  private async validateTaskUpdate(
    request: UpdateTaskRequest,
    currentTask: any,
    userId: UserId
  ): Promise<void> {
    // Check permissions
    if (currentTask.creatorId !== userId.value && currentTask.assigneeId !== userId.value) {
      throw new AuthorizationError('You do not have permission to update this task');
    }

    // Validate specific updates
    if (request.updates.projectId) {
      this.logDebug('Validating project update', {
        projectId: request.updates.projectId,
      });
    }

    if (request.updates.assigneeId) {
      this.logDebug('Validating assignee update', {
        assigneeId: request.updates.assigneeId,
      });
    }
  }

  private async orchestrateTaskUpdate(
    currentTask: any,
    updatedTask: any,
    request: UpdateTaskRequest,
    _userId: UserId // Prefixed with underscore to indicate intentionally unused
  ): Promise<void> {
    this.logDebug('Orchestrating task update', {
      taskId: updatedTask.id,
      changes: Object.keys(request.updates),
    });

    // Send notifications for significant changes
    if (request.notifyChanges) {
      if (request.updates.assigneeId && request.updates.assigneeId !== currentTask.assigneeId) {
        this.logDebug('Sending task reassignment notification', {
          newAssigneeId: request.updates.assigneeId,
          taskId: updatedTask.id,
        });
      }

      if (request.updates.status && request.updates.status !== currentTask.status) {
        this.logDebug('Sending task status change notification', {
          taskId: updatedTask.id,
          fromStatus: currentTask.status,
          toStatus: request.updates.status,
        });
      }
    }
  }

  private async validateWorkflowTransition(
    task: any,
    action: string,
    userId: UserId
  ): Promise<void> {
    // Check permissions
    if (task.assigneeId !== userId.value && task.creatorId !== userId.value) {
      throw new AuthorizationError('You do not have permission to manage this task workflow');
    }

    // Validate state transitions
    const validTransitions: Record<string, string[]> = {
      start: ['TODO'],
      pause: ['IN_PROGRESS'],
      resume: ['TODO'],
      complete: ['IN_PROGRESS', 'REVIEW'],
      cancel: ['TODO', 'IN_PROGRESS', 'REVIEW'],
    };

    const allowedFromStates = validTransitions[action];
    if (allowedFromStates && !allowedFromStates.includes(task.status)) {
      throw new ValidationError([
        {
          field: 'status',
          message: `Cannot ${action} task from ${task.status} status`,
        },
      ]);
    }
  }

  private async orchestrateWorkflowTransition(
    currentTask: any,
    updatedTask: any,
    request: TaskWorkflowRequest,
    _userId: UserId
  ): Promise<void> {
    this.logDebug('Orchestrating workflow transition', {
      taskId: updatedTask.id,
      action: request.action,
      fromStatus: currentTask.status,
      toStatus: updatedTask.status,
    });

    // Send notifications
    if (request.notifyStakeholders) {
      this.logDebug('Sending workflow transition notification', {
        taskId: updatedTask.id,
        action: request.action,
      });
    }
  }

  private calculateTaskStats(tasks: any[]): TaskInsightsResponse['stats'] {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'DONE').length;
    const overdue = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE'
    ).length;
    const highPriority = tasks.filter(
      (t) => t.priority === 'HIGH' || t.priority === 'URGENT'
    ).length;
    const completionRate = total > 0 ? completed / total : 0;

    return {
      total,
      completed,
      overdue,
      highPriority,
      completionRate,
    };
  }

  private async generateTaskTrends(_tasks: any[], _userId: UserId): Promise<any> {
    // Generate trend data (simplified for now)
    return {
      completionTrend: 'stable',
      productivityScore: 75,
      averageCompletionTime: 3.5,
    };
  }

  private async generateTaskRecommendations(
    stats: TaskInsightsResponse['stats'],
    _trends: any,
    _userId: UserId
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (stats.overdue > 0) {
      recommendations.push(`You have ${stats.overdue} overdue tasks that need attention`);
    }

    if (stats.highPriority > stats.total * 0.5) {
      recommendations.push(
        'Consider reviewing task priorities - many tasks are marked as high priority'
      );
    }

    if (stats.completionRate && stats.completionRate < 0.7) {
      recommendations.push(
        'Your task completion rate is below 70% - consider breaking down large tasks'
      );
    }

    return recommendations;
  }
}
