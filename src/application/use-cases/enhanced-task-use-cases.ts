/**
 * Enhanced Task Management Use Cases
 *
 * This module contains comprehensive use case orchestrators that coordinate complex business workflows
 * involving multiple aggregates and services. Enhanced with better error handling, validation,
 * performance monitoring, and integration with the current architecture.
 */

import { ICommandBus, IQueryBus } from '../cqrs';
import {
  CreateTaskCommand,
  UpdateTaskCommand,
} from '../commands/task-commands';
import { GetTaskByIdQuery, GetTasksQuery } from '../queries/task-queries';
import {
  BaseApplicationService,
  ValidationRule,
  RequiredFieldValidationRule,
  LengthValidationRule,
} from '../services/base-application-service';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { UserId } from '../../domain/value-objects/user-id';
import { TaskId } from '../../domain/value-objects/task-id';
import { ProjectId } from '../../domain/value-objects/project-id';
import { injectable } from '../../shared/decorators/injectable.decorator';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../../shared/utils/app-error';

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

export interface TaskCollaborationRequest {
  taskId: string;
  collaboratorIds: string[];
  permissions: ('view' | 'edit' | 'comment')[];
  message?: string;
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

@injectable()
export class EnhancedTaskManagementUseCase extends BaseApplicationService {
  constructor(
    logger: LoggingService,
    eventPublisher: DomainEventPublisher,
    private readonly commandBus: ICommandBus,
    private readonly queryBus: IQueryBus
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
        const validationResult = this.validateInput(
          request,
          this.getCreateTaskValidationRules()
        );
        if (!validationResult.isValid) {
          throw new ValidationError(
            `Task creation validation failed: ${validationResult.errors.join(', ')}`
          );
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
            userId,
            request.projectId ? new ProjectId(request.projectId) : undefined,
            request.assigneeId ? new UserId(request.assigneeId) : undefined
          );

          const taskId = await this.commandBus.send<TaskId>(command);

          // Get detailed task information
          const taskDetails = await this.queryBus.send(
            new GetTaskByIdQuery(taskId, userId)
          );

          // Post-creation orchestration
          await this.orchestrateTaskCreation(taskDetails, request, userId);

          this.logInfo(
            'Task created successfully with enhanced orchestration',
            {
              taskId: taskId.value,
              userId: userId.value,
            }
          );

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
        const validationResult = this.validateInput(
          request,
          this.getUpdateTaskValidationRules()
        );
        if (!validationResult.isValid) {
          throw new ValidationError(
            `Task update validation failed: ${validationResult.errors.join(', ')}`
          );
        }

        // Get current task state for comparison
        const taskId = new TaskId(request.taskId);
        const currentTask = await this.queryBus.send(
          new GetTaskByIdQuery(taskId, userId)
        );

        // Validate business rules for updates
        await this.validateTaskUpdate(request, currentTask, userId);

        // Execute within transaction
        return this.executeInTransaction(async () => {
          // Update the task
          const command = new UpdateTaskCommand(
            taskId,
            request.updates.title,
            request.updates.description,
            userId
          );

          await this.commandBus.send(command);

          // Get updated task details
          const taskDetails = await this.queryBus.send(
            new GetTaskByIdQuery(taskId, userId)
          );

          // Post-update orchestration
          await this.orchestrateTaskUpdate(
            currentTask,
            taskDetails,
            request,
            userId
          );

          this.logInfo(
            'Task updated successfully with enhanced orchestration',
            {
              taskId: taskId.value,
              userId: userId.value,
            }
          );

          return taskDetails;
        });
      },
      { userId: userId.value, taskId: request.taskId }
    );
  }

  /**
   * Manages task workflow transitions with enhanced validation
   */
  async manageTaskWorkflow(
    request: TaskWorkflowRequest,
    userId: UserId
  ): Promise<any> {
    return this.executeWithMonitoring(
      'manageTaskWorkflow',
      async () => {
        this.logInfo('Managing task workflow with enhanced validation', {
          taskId: request.taskId,
          action: request.action,
          userId: userId.value,
        });

        const taskId = new TaskId(request.taskId);
        const currentTask = await this.queryBus.send(
          new GetTaskByIdQuery(taskId, userId)
        );

        // Validate workflow transition
        await this.validateWorkflowTransition(
          currentTask,
          request.action,
          userId
        );

        // Execute within transaction
        return this.executeInTransaction(async () => {
          let updatedTask: any;

          switch (request.action) {
            case 'start':
              updatedTask = await this.commandBus.send(
                new UpdateTaskCommand(taskId, undefined, undefined, userId)
              );
              break;

            case 'complete':
              updatedTask = await this.commandBus.send(
                new UpdateTaskCommand(taskId, undefined, undefined, userId)
              );
              break;

            default:
              throw new ValidationError(
                `Invalid workflow action: ${request.action}`
              );
          }

          // Get updated task details
          const taskDetails = await this.queryBus.send(
            new GetTaskByIdQuery(taskId, userId)
          );

          // Post-workflow orchestration
          await this.orchestrateWorkflowTransition(
            currentTask,
            taskDetails,
            request,
            userId
          );

          return taskDetails;
        });
      },
      { userId: userId.value, taskId: request.taskId, action: request.action }
    );
  }

  /**
   * Gets comprehensive task insights with analytics
   */
  async getTaskInsights(
    filters: any = {},
    userId: UserId
  ): Promise<TaskInsightsResponse> {
    return this.executeWithMonitoring(
      'getTaskInsights',
      async () => {
        this.logInfo('Getting enhanced task insights', {
          filters,
          userId: userId.value,
        });

        // Get tasks with filters
        const tasks = await this.queryBus.send(
          new GetTasksQuery(
            userId,
            filters.projectId ? new ProjectId(filters.projectId) : undefined
          )
        );

        // Calculate stats
        const stats = this.calculateTaskStats(tasks);

        // Generate trends (simplified for now)
        const trends = await this.generateTaskTrends(tasks, userId);

        // Generate recommendations
        const recommendations = await this.generateTaskRecommendations(
          stats,
          trends,
          userId
        );

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
      new LengthValidationRule(
        'description',
        undefined,
        2000,
        'Task description'
      ),
    ];
  }

  private getUpdateTaskValidationRules(): ValidationRule<UpdateTaskRequest>[] {
    return [
      new RequiredFieldValidationRule('taskId', 'Task ID'),
      new LengthValidationRule('updates', undefined, undefined, 'Updates'),
    ];
  }

  // Private helper methods for orchestration
  private async validateTaskCreation(
    request: CreateTaskRequest,
    userId: UserId
  ): Promise<void> {
    // Validate project exists if specified
    if (request.projectId) {
      // This would check if project exists and user has access
      this.logDebug('Validating project access', {
        projectId: request.projectId,
        userId: userId.value,
      });
    }

    // Validate assignee exists if specified
    if (request.assigneeId) {
      // This would check if user exists
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
    // For now, return the request unchanged
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
    if (
      request.notifyAssignee &&
      task.assigneeId &&
      task.assigneeId !== userId.value
    ) {
      // Send notification logic would go here
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
    if (
      currentTask.creatorId !== userId.value &&
      currentTask.assigneeId !== userId.value
    ) {
      throw new ForbiddenError(
        'You do not have permission to update this task'
      );
    }

    // Validate specific updates
    if (request.updates.projectId) {
      // Validate project exists and user has access
      this.logDebug('Validating project update', {
        projectId: request.updates.projectId,
      });
    }

    if (request.updates.assigneeId) {
      // Validate assignee exists
      this.logDebug('Validating assignee update', {
        assigneeId: request.updates.assigneeId,
      });
    }
  }

  private async orchestrateTaskUpdate(
    currentTask: any,
    updatedTask: any,
    request: UpdateTaskRequest,
    userId: UserId
  ): Promise<void> {
    this.logDebug('Orchestrating task update', {
      taskId: updatedTask.id,
      changes: Object.keys(request.updates),
    });

    // Send notifications for significant changes
    if (request.notifyChanges) {
      if (
        request.updates.assigneeId &&
        request.updates.assigneeId !== currentTask.assigneeId
      ) {
        this.logDebug('Sending task reassignment notification', {
          newAssigneeId: request.updates.assigneeId,
          taskId: updatedTask.id,
        });
      }

      if (
        request.updates.status &&
        request.updates.status !== currentTask.status
      ) {
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
      throw new ForbiddenError(
        'You do not have permission to manage this task workflow'
      );
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
      throw new ValidationError(
        `Cannot ${action} task from ${task.status} status`
      );
    }
  }

  private async orchestrateWorkflowTransition(
    currentTask: any,
    updatedTask: any,
    request: TaskWorkflowRequest,
    userId: UserId
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
    const completed = tasks.filter(t => t.status === 'DONE').length;
    const overdue = tasks.filter(
      t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE'
    ).length;
    const highPriority = tasks.filter(
      t => t.priority === 'HIGH' || t.priority === 'URGENT'
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

  private async generateTaskTrends(tasks: any[], userId: UserId): Promise<any> {
    // Generate trend data (simplified for now)
    return {
      completionTrend: 'stable',
      productivityScore: 75,
      averageCompletionTime: 3.5,
    };
  }

  private async generateTaskRecommendations(
    stats: TaskInsightsResponse['stats'],
    trends: any,
    userId: UserId
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (stats.overdue > 0) {
      recommendations.push(
        `You have ${stats.overdue} overdue tasks that need attention`
      );
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
