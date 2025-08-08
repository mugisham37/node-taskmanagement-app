/**
 * Task Management Use Cases
 *
 * This module contains high-level use case orchestrators that coordinate complex business workflows
 * involving multiple aggregates and services. Use cases represent complete business operations
 * from the user's perspective.
 */

import { ICommandBus, IQueryBus } from '../cqrs';
import {
  CreateTaskCommand,
  UpdateTaskCommand,
  AssignTaskCommand,
  CompleteTaskCommand,
  BulkUpdateTasksCommand,
} from '../cqrs/commands/task-commands';
import {
  GetTaskByIdQuery,
  GetTasksQuery,
  GetTaskStatsQuery,
  TaskWithDetails,
  TaskStats,
} from '../cqrs/queries/task-queries';
import {
  Task,
  TaskStatus,
  TaskPriority,
} from '@/domain/task-management/entities/task';
import { INotificationService } from '@/domain/notification/services/notification-service';
import { IAnalyticsService } from '@/domain/analytics/services/analytics-service';
import { IProjectRepository } from '@/domain/task-management/repositories/project-repository';
import { IUserRepository } from '@/domain/authentication/repositories/user-repository';
import { ILogger } from '@/shared/types/logger';
import { injectable } from '@/application/decorators/injectable';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '@/shared/errors/app-error';

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority;
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
    status?: TaskStatus;
    priority?: TaskPriority;
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

@injectable()
export class TaskManagementUseCase {
  constructor(
    private readonly commandBus: ICommandBus,
    private readonly queryBus: IQueryBus,
    private readonly notificationService: INotificationService,
    private readonly analyticsService: IAnalyticsService,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly logger: ILogger
  ) {}

  /**
   * Creates a new task with full workflow orchestration
   */
  async createTask(
    request: CreateTaskRequest,
    userId: string
  ): Promise<TaskWithDetails> {
    this.logger.info('Creating task with orchestration', {
      title: request.title,
      projectId: request.projectId,
      assigneeId: request.assigneeId,
      userId,
    });

    // Validate business rules
    await this.validateTaskCreation(request, userId);

    // Apply template if specified
    if (request.templateId) {
      request = await this.applyTaskTemplate(request, request.templateId);
    }

    // Create the task
    const command = new CreateTaskCommand(
      request.title,
      request.description,
      request.priority,
      request.projectId,
      request.assigneeId,
      request.dueDate,
      request.estimatedHours,
      request.tags,
      userId
    );

    const task = await this.commandBus.send<Task>(command);

    // Get detailed task information
    const taskDetails = await this.queryBus.send<TaskWithDetails>(
      new GetTaskByIdQuery(task.id, userId)
    );

    // Post-creation orchestration
    await this.orchestrateTaskCreation(taskDetails, request, userId);

    this.logger.info('Task created successfully with orchestration', {
      taskId: task.id,
      userId,
    });

    return taskDetails;
  }

  /**
   * Updates a task with change tracking and notifications
   */
  async updateTask(
    request: UpdateTaskRequest,
    userId: string
  ): Promise<TaskWithDetails> {
    this.logger.info('Updating task with orchestration', {
      taskId: request.taskId,
      updates: Object.keys(request.updates),
      userId,
    });

    // Get current task state for comparison
    const currentTask = await this.queryBus.send<TaskWithDetails>(
      new GetTaskByIdQuery(request.taskId, userId)
    );

    // Validate business rules for updates
    await this.validateTaskUpdate(request, currentTask, userId);

    // Update the task
    const command = new UpdateTaskCommand(
      request.taskId,
      request.updates,
      userId
    );
    const updatedTask = await this.commandBus.send<Task>(command);

    // Get updated task details
    const taskDetails = await this.queryBus.send<TaskWithDetails>(
      new GetTaskByIdQuery(updatedTask.id, userId)
    );

    // Post-update orchestration
    await this.orchestrateTaskUpdate(currentTask, taskDetails, request, userId);

    this.logger.info('Task updated successfully with orchestration', {
      taskId: updatedTask.id,
      userId,
    });

    return taskDetails;
  }

  /**
   * Manages task workflow transitions (start, pause, complete, etc.)
   */
  async manageTaskWorkflow(
    request: TaskWorkflowRequest,
    userId: string
  ): Promise<TaskWithDetails> {
    this.logger.info('Managing task workflow', {
      taskId: request.taskId,
      action: request.action,
      userId,
    });

    const currentTask = await this.queryBus.send<TaskWithDetails>(
      new GetTaskByIdQuery(request.taskId, userId)
    );

    // Validate workflow transition
    await this.validateWorkflowTransition(currentTask, request.action, userId);

    let updatedTask: Task;

    switch (request.action) {
      case 'start':
        updatedTask = await this.commandBus.send<Task>(
          new UpdateTaskCommand(
            request.taskId,
            { status: TaskStatus.IN_PROGRESS },
            userId
          )
        );
        break;

      case 'pause':
        updatedTask = await this.commandBus.send<Task>(
          new UpdateTaskCommand(
            request.taskId,
            { status: TaskStatus.TODO },
            userId
          )
        );
        break;

      case 'resume':
        updatedTask = await this.commandBus.send<Task>(
          new UpdateTaskCommand(
            request.taskId,
            { status: TaskStatus.IN_PROGRESS },
            userId
          )
        );
        break;

      case 'complete':
        updatedTask = await this.commandBus.send<Task>(
          new CompleteTaskCommand(
            request.taskId,
            request.actualHours,
            request.completionNotes,
            userId
          )
        );
        break;

      case 'cancel':
        updatedTask = await this.commandBus.send<Task>(
          new UpdateTaskCommand(
            request.taskId,
            { status: TaskStatus.CANCELLED },
            userId
          )
        );
        break;

      default:
        throw new ValidationError(`Invalid workflow action: ${request.action}`);
    }

    // Get updated task details
    const taskDetails = await this.queryBus.send<TaskWithDetails>(
      new GetTaskByIdQuery(updatedTask.id, userId)
    );

    // Post-workflow orchestration
    await this.orchestrateWorkflowTransition(
      currentTask,
      taskDetails,
      request,
      userId
    );

    return taskDetails;
  }

  /**
   * Performs bulk operations on multiple tasks with coordination
   */
  async performBulkOperation(
    request: BulkTaskOperationRequest,
    userId: string
  ): Promise<{
    updated: number;
    failed: string[];
    details: TaskWithDetails[];
  }> {
    this.logger.info('Performing bulk task operation', {
      operation: request.operation,
      taskCount: request.taskIds.length,
      userId,
    });

    // Validate bulk operation
    await this.validateBulkOperation(request, userId);

    // Execute bulk operation
    const command = new BulkUpdateTasksCommand(
      request.taskIds,
      request.operation,
      request.data,
      userId
    );

    const result = await this.commandBus.send<{
      updated: number;
      failed: string[];
    }>(command);

    // Get details of successfully updated tasks
    const updatedTaskDetails: TaskWithDetails[] = [];
    const successfulTaskIds = request.taskIds.filter(
      id => !result.failed.includes(id)
    );

    for (const taskId of successfulTaskIds) {
      try {
        const taskDetails = await this.queryBus.send<TaskWithDetails>(
          new GetTaskByIdQuery(taskId, userId)
        );
        updatedTaskDetails.push(taskDetails);
      } catch (error) {
        this.logger.warn('Failed to get updated task details', {
          taskId,
          error,
        });
      }
    }

    // Post-bulk operation orchestration
    await this.orchestrateBulkOperation(updatedTaskDetails, request, userId);

    this.logger.info('Bulk operation completed', {
      operation: request.operation,
      updated: result.updated,
      failed: result.failed.length,
      userId,
    });

    return {
      ...result,
      details: updatedTaskDetails,
    };
  }

  /**
   * Sets up task collaboration with permissions and notifications
   */
  async setupTaskCollaboration(
    request: TaskCollaborationRequest,
    userId: string
  ): Promise<TaskWithDetails> {
    this.logger.info('Setting up task collaboration', {
      taskId: request.taskId,
      collaboratorCount: request.collaboratorIds.length,
      userId,
    });

    const task = await this.queryBus.send<TaskWithDetails>(
      new GetTaskByIdQuery(request.taskId, userId)
    );

    // Validate collaboration setup
    await this.validateCollaborationSetup(task, request, userId);

    // Set up collaboration (this would involve additional domain logic)
    // For now, we'll simulate by adding collaborators as watchers

    // Notify collaborators
    if (request.message) {
      await this.notifyCollaborators(
        task,
        request.collaboratorIds,
        request.message,
        userId
      );
    }

    // Track collaboration analytics
    await this.analyticsService.trackEvent('task_collaboration_setup', {
      taskId: request.taskId,
      collaboratorCount: request.collaboratorIds.length,
      permissions: request.permissions,
      userId,
    });

    return task;
  }

  /**
   * Gets comprehensive task analytics and insights
   */
  async getTaskInsights(
    filters: any = {},
    userId: string
  ): Promise<{
    stats: TaskStats;
    trends: any;
    recommendations: string[];
  }> {
    this.logger.info('Getting task insights', { filters, userId });

    // Get basic stats
    const stats = await this.queryBus.send<TaskStats>(
      new GetTaskStatsQuery(filters, userId)
    );

    // Get trend data (simplified for now)
    const trends = await this.analyticsService.getTaskTrends(filters, userId);

    // Generate recommendations based on data
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
  }

  // Private helper methods for orchestration

  private async validateTaskCreation(
    request: CreateTaskRequest,
    userId: string
  ): Promise<void> {
    if (request.projectId) {
      const project = await this.projectRepository.findById(request.projectId);
      if (!project) {
        throw new NotFoundError('Project', request.projectId);
      }
      // Check if user has permission to create tasks in this project
    }

    if (request.assigneeId) {
      const assignee = await this.userRepository.findById(request.assigneeId);
      if (!assignee) {
        throw new NotFoundError('User', request.assigneeId);
      }
    }
  }

  private async applyTaskTemplate(
    request: CreateTaskRequest,
    templateId: string
  ): Promise<CreateTaskRequest> {
    // This would load a task template and apply its settings
    // For now, return the request unchanged
    return request;
  }

  private async orchestrateTaskCreation(
    task: TaskWithDetails,
    request: CreateTaskRequest,
    userId: string
  ): Promise<void> {
    // Send notifications
    if (
      request.notifyAssignee &&
      task.assigneeId &&
      task.assigneeId !== userId
    ) {
      await this.notificationService.sendTaskAssignmentNotification(
        task.assigneeId,
        task,
        userId
      );
    }

    // Track analytics
    await this.analyticsService.trackEvent('task_created', {
      taskId: task.id,
      projectId: task.projectId,
      priority: task.priority,
      hasAssignee: !!task.assigneeId,
      hasDueDate: !!task.dueDate,
      userId,
    });

    // Update project statistics if applicable
    if (task.projectId) {
      await this.analyticsService.updateProjectStats(
        task.projectId,
        'task_created'
      );
    }
  }

  private async validateTaskUpdate(
    request: UpdateTaskRequest,
    currentTask: TaskWithDetails,
    userId: string
  ): Promise<void> {
    // Check permissions
    if (currentTask.creatorId !== userId && currentTask.assigneeId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to update this task'
      );
    }

    // Validate specific updates
    if (request.updates.projectId) {
      const project = await this.projectRepository.findById(
        request.updates.projectId
      );
      if (!project) {
        throw new NotFoundError('Project', request.updates.projectId);
      }
    }

    if (request.updates.assigneeId) {
      const assignee = await this.userRepository.findById(
        request.updates.assigneeId
      );
      if (!assignee) {
        throw new NotFoundError('User', request.updates.assigneeId);
      }
    }
  }

  private async orchestrateTaskUpdate(
    currentTask: TaskWithDetails,
    updatedTask: TaskWithDetails,
    request: UpdateTaskRequest,
    userId: string
  ): Promise<void> {
    // Send notifications for significant changes
    if (request.notifyChanges) {
      if (
        request.updates.assigneeId &&
        request.updates.assigneeId !== currentTask.assigneeId
      ) {
        await this.notificationService.sendTaskReassignmentNotification(
          request.updates.assigneeId,
          updatedTask,
          userId
        );
      }

      if (
        request.updates.status &&
        request.updates.status !== currentTask.status
      ) {
        await this.notificationService.sendTaskStatusChangeNotification(
          updatedTask,
          currentTask.status,
          request.updates.status,
          userId
        );
      }
    }

    // Track analytics
    await this.analyticsService.trackEvent('task_updated', {
      taskId: updatedTask.id,
      changes: Object.keys(request.updates),
      userId,
    });
  }

  private async validateWorkflowTransition(
    task: TaskWithDetails,
    action: string,
    userId: string
  ): Promise<void> {
    // Check permissions
    if (task.assigneeId !== userId && task.creatorId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to manage this task workflow'
      );
    }

    // Validate state transitions
    const validTransitions: Record<string, TaskStatus[]> = {
      start: [TaskStatus.TODO],
      pause: [TaskStatus.IN_PROGRESS],
      resume: [TaskStatus.TODO],
      complete: [TaskStatus.IN_PROGRESS, TaskStatus.REVIEW],
      cancel: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW],
    };

    const allowedFromStates = validTransitions[action];
    if (allowedFromStates && !allowedFromStates.includes(task.status)) {
      throw new ValidationError(
        `Cannot ${action} task from ${task.status} status`
      );
    }
  }

  private async orchestrateWorkflowTransition(
    currentTask: TaskWithDetails,
    updatedTask: TaskWithDetails,
    request: TaskWorkflowRequest,
    userId: string
  ): Promise<void> {
    // Send notifications
    if (request.notifyStakeholders) {
      await this.notificationService.sendTaskWorkflowNotification(
        updatedTask,
        request.action,
        userId
      );
    }

    // Track analytics
    await this.analyticsService.trackEvent('task_workflow_transition', {
      taskId: updatedTask.id,
      action: request.action,
      fromStatus: currentTask.status,
      toStatus: updatedTask.status,
      userId,
    });
  }

  private async validateBulkOperation(
    request: BulkTaskOperationRequest,
    userId: string
  ): Promise<void> {
    if (request.taskIds.length === 0) {
      throw new ValidationError('No tasks specified for bulk operation');
    }

    if (request.taskIds.length > 100) {
      throw new ValidationError(
        'Bulk operations are limited to 100 tasks at a time'
      );
    }
  }

  private async orchestrateBulkOperation(
    updatedTasks: TaskWithDetails[],
    request: BulkTaskOperationRequest,
    userId: string
  ): Promise<void> {
    // Send bulk notifications if requested
    if (request.notifyAffected) {
      await this.notificationService.sendBulkOperationNotification(
        updatedTasks,
        request.operation,
        userId
      );
    }

    // Track analytics
    await this.analyticsService.trackEvent('bulk_task_operation', {
      operation: request.operation,
      taskCount: updatedTasks.length,
      userId,
    });
  }

  private async validateCollaborationSetup(
    task: TaskWithDetails,
    request: TaskCollaborationRequest,
    userId: string
  ): Promise<void> {
    // Check permissions
    if (task.creatorId !== userId) {
      throw new ForbiddenError(
        'Only the task creator can set up collaboration'
      );
    }

    // Validate collaborators exist
    for (const collaboratorId of request.collaboratorIds) {
      const user = await this.userRepository.findById(collaboratorId);
      if (!user) {
        throw new NotFoundError('User', collaboratorId);
      }
    }
  }

  private async notifyCollaborators(
    task: TaskWithDetails,
    collaboratorIds: string[],
    message: string,
    userId: string
  ): Promise<void> {
    for (const collaboratorId of collaboratorIds) {
      await this.notificationService.sendTaskCollaborationInvitation(
        collaboratorId,
        task,
        message,
        userId
      );
    }
  }

  private async generateTaskRecommendations(
    stats: TaskStats,
    trends: any,
    userId: string
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
