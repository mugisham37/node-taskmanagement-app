/**
 * Task Domain Event Handlers
 *
 * This module contains event handlers that process domain events related to task management.
 * These handlers coordinate side effects and cross-aggregate operations when tasks change.
 */

import { DomainEventHandler } from '@/shared/events/domain-event';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskAssignedEvent,
  TaskCompletedEvent,
  TaskDeletedEvent,
  TaskStatusChangedEvent,
  TaskPriorityChangedEvent,
  TaskMovedToProjectEvent,
} from '@/domain/task-management/events/task-events';
import { INotificationService } from '@/domain/notification/services/notification-service';
import { IAnalyticsService } from '@/domain/analytics/services/analytics-service';
import { ISearchService } from '@/domain/search/services/search-service';
import { IActivityService } from '../../../domains/audit/services/activity-service';
import { IWebSocketService } from '@/infrastructure/websocket/websocket-service';
import { IEmailService } from '@/infrastructure/email/email-service';
import { ILogger } from '@/shared/types/logger';
import { injectable } from '@/application/decorators/injectable';

@injectable()
export class TaskCreatedEventHandler
  implements DomainEventHandler<TaskCreatedEvent>
{
  constructor(
    private readonly notificationService: INotificationService,
    private readonly analyticsService: IAnalyticsService,
    private readonly searchService: ISearchService,
    private readonly activityService: IActivityService,
    private readonly webSocketService: IWebSocketService,
    private readonly logger: ILogger
  ) {}

  canHandle(event: any): boolean {
    return event instanceof TaskCreatedEvent;
  }

  async handle(event: TaskCreatedEvent): Promise<void> {
    this.logger.info('Handling TaskCreatedEvent', {
      taskId: event.taskId,
      creatorId: event.creatorId,
      projectId: event.projectId,
    });

    try {
      // Update search index
      await this.searchService.indexTask({
        id: event.taskId,
        title: event.title,
        description: event.description,
        status: 'todo',
        priority: event.priority,
        projectId: event.projectId,
        creatorId: event.creatorId,
        assigneeId: event.assigneeId,
        tags: event.tags,
        createdAt: event.occurredAt,
      });

      // Record activity
      await this.activityService.recordActivity({
        entityType: 'task',
        entityId: event.taskId,
        action: 'created',
        userId: event.creatorId,
        metadata: {
          title: event.title,
          projectId: event.projectId,
          assigneeId: event.assigneeId,
        },
        occurredAt: event.occurredAt,
      });

      // Send real-time notification via WebSocket
      await this.webSocketService.broadcastToProject(event.projectId, {
        type: 'task_created',
        data: {
          taskId: event.taskId,
          title: event.title,
          creatorId: event.creatorId,
          projectId: event.projectId,
        },
      });

      // Track analytics
      await this.analyticsService.trackEvent('task_created', {
        taskId: event.taskId,
        projectId: event.projectId,
        priority: event.priority,
        hasAssignee: !!event.assigneeId,
        tagCount: event.tags?.length || 0,
        creatorId: event.creatorId,
      });

      // Send notification to assignee if different from creator
      if (event.assigneeId && event.assigneeId !== event.creatorId) {
        await this.notificationService.createNotification({
          userId: event.assigneeId,
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: `You have been assigned a new task: "${event.title}"`,
          data: {
            taskId: event.taskId,
            taskTitle: event.title,
            assignedBy: event.creatorId,
          },
        });
      }

      // Notify project members if task is in a project
      if (event.projectId) {
        await this.notificationService.notifyProjectMembers(event.projectId, {
          type: 'task_created',
          title: 'New Task Created',
          message: `A new task "${event.title}" was created in the project`,
          data: {
            taskId: event.taskId,
            taskTitle: event.title,
            creatorId: event.creatorId,
          },
          excludeUsers: [event.creatorId], // Don't notify the creator
        });
      }

      this.logger.info('TaskCreatedEvent handled successfully', {
        taskId: event.taskId,
      });
    } catch (error) {
      this.logger.error('Error handling TaskCreatedEvent', {
        taskId: event.taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

@injectable()
export class TaskAssignedEventHandler
  implements DomainEventHandler<TaskAssignedEvent>
{
  constructor(
    private readonly notificationService: INotificationService,
    private readonly activityService: IActivityService,
    private readonly webSocketService: IWebSocketService,
    private readonly emailService: IEmailService,
    private readonly logger: ILogger
  ) {}

  canHandle(event: any): boolean {
    return event instanceof TaskAssignedEvent;
  }

  async handle(event: TaskAssignedEvent): Promise<void> {
    this.logger.info('Handling TaskAssignedEvent', {
      taskId: event.taskId,
      assigneeId: event.assigneeId,
      assignedBy: event.assignedBy,
    });

    try {
      // Record activity
      await this.activityService.recordActivity({
        entityType: 'task',
        entityId: event.taskId,
        action: 'assigned',
        userId: event.assignedBy,
        metadata: {
          assigneeId: event.assigneeId,
          previousAssigneeId: event.previousAssigneeId,
        },
        occurredAt: event.occurredAt,
      });

      // Send real-time notification
      await this.webSocketService.broadcastToUser(event.assigneeId, {
        type: 'task_assigned',
        data: {
          taskId: event.taskId,
          assignedBy: event.assignedBy,
        },
      });

      // Create in-app notification
      await this.notificationService.createNotification({
        userId: event.assigneeId,
        type: 'task_assigned',
        title: 'Task Assigned',
        message: `You have been assigned to a task`,
        data: {
          taskId: event.taskId,
          assignedBy: event.assignedBy,
        },
      });

      // Send email notification
      await this.emailService.sendTaskAssignmentEmail({
        recipientId: event.assigneeId,
        taskId: event.taskId,
        assignedBy: event.assignedBy,
      });

      // Notify previous assignee if there was one
      if (
        event.previousAssigneeId &&
        event.previousAssigneeId !== event.assigneeId
      ) {
        await this.notificationService.createNotification({
          userId: event.previousAssigneeId,
          type: 'task_unassigned',
          title: 'Task Reassigned',
          message: `A task has been reassigned to someone else`,
          data: {
            taskId: event.taskId,
            newAssigneeId: event.assigneeId,
            reassignedBy: event.assignedBy,
          },
        });
      }

      this.logger.info('TaskAssignedEvent handled successfully', {
        taskId: event.taskId,
        assigneeId: event.assigneeId,
      });
    } catch (error) {
      this.logger.error('Error handling TaskAssignedEvent', {
        taskId: event.taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

@injectable()
export class TaskCompletedEventHandler
  implements DomainEventHandler<TaskCompletedEvent>
{
  constructor(
    private readonly notificationService: INotificationService,
    private readonly analyticsService: IAnalyticsService,
    private readonly activityService: IActivityService,
    private readonly webSocketService: IWebSocketService,
    private readonly logger: ILogger
  ) {}

  canHandle(event: any): boolean {
    return event instanceof TaskCompletedEvent;
  }

  async handle(event: TaskCompletedEvent): Promise<void> {
    this.logger.info('Handling TaskCompletedEvent', {
      taskId: event.taskId,
      completedBy: event.completedBy,
      actualHours: event.actualHours,
    });

    try {
      // Record activity
      await this.activityService.recordActivity({
        entityType: 'task',
        entityId: event.taskId,
        action: 'completed',
        userId: event.completedBy,
        metadata: {
          actualHours: event.actualHours,
          completionNotes: event.completionNotes,
        },
        occurredAt: event.occurredAt,
      });

      // Send real-time notification to project members
      if (event.projectId) {
        await this.webSocketService.broadcastToProject(event.projectId, {
          type: 'task_completed',
          data: {
            taskId: event.taskId,
            completedBy: event.completedBy,
          },
        });
      }

      // Track completion analytics
      await this.analyticsService.trackEvent('task_completed', {
        taskId: event.taskId,
        completedBy: event.completedBy,
        actualHours: event.actualHours,
        projectId: event.projectId,
        completionTime: event.occurredAt,
      });

      // Calculate and track completion metrics
      if (event.estimatedHours && event.actualHours) {
        const variance = event.actualHours - event.estimatedHours;
        await this.analyticsService.trackMetric(
          'task_time_variance',
          variance,
          {
            taskId: event.taskId,
            userId: event.completedBy,
          }
        );
      }

      // Notify task creator if different from completer
      if (event.creatorId && event.creatorId !== event.completedBy) {
        await this.notificationService.createNotification({
          userId: event.creatorId,
          type: 'task_completed',
          title: 'Task Completed',
          message: `Your task has been completed`,
          data: {
            taskId: event.taskId,
            completedBy: event.completedBy,
          },
        });
      }

      // Update project completion statistics
      if (event.projectId) {
        await this.analyticsService.updateProjectStats(
          event.projectId,
          'task_completed'
        );
      }

      this.logger.info('TaskCompletedEvent handled successfully', {
        taskId: event.taskId,
      });
    } catch (error) {
      this.logger.error('Error handling TaskCompletedEvent', {
        taskId: event.taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

@injectable()
export class TaskStatusChangedEventHandler
  implements DomainEventHandler<TaskStatusChangedEvent>
{
  constructor(
    private readonly searchService: ISearchService,
    private readonly activityService: IActivityService,
    private readonly webSocketService: IWebSocketService,
    private readonly analyticsService: IAnalyticsService,
    private readonly logger: ILogger
  ) {}

  canHandle(event: any): boolean {
    return event instanceof TaskStatusChangedEvent;
  }

  async handle(event: TaskStatusChangedEvent): Promise<void> {
    this.logger.info('Handling TaskStatusChangedEvent', {
      taskId: event.taskId,
      fromStatus: event.previousStatus,
      toStatus: event.newStatus,
      changedBy: event.changedBy,
    });

    try {
      // Update search index
      await this.searchService.updateTaskStatus(event.taskId, event.newStatus);

      // Record activity
      await this.activityService.recordActivity({
        entityType: 'task',
        entityId: event.taskId,
        action: 'status_changed',
        userId: event.changedBy,
        metadata: {
          fromStatus: event.previousStatus,
          toStatus: event.newStatus,
        },
        occurredAt: event.occurredAt,
      });

      // Send real-time update
      await this.webSocketService.broadcastTaskUpdate(event.taskId, {
        type: 'status_changed',
        data: {
          taskId: event.taskId,
          fromStatus: event.previousStatus,
          toStatus: event.newStatus,
          changedBy: event.changedBy,
        },
      });

      // Track analytics
      await this.analyticsService.trackEvent('task_status_changed', {
        taskId: event.taskId,
        fromStatus: event.previousStatus,
        toStatus: event.newStatus,
        changedBy: event.changedBy,
      });

      this.logger.info('TaskStatusChangedEvent handled successfully', {
        taskId: event.taskId,
      });
    } catch (error) {
      this.logger.error('Error handling TaskStatusChangedEvent', {
        taskId: event.taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

@injectable()
export class TaskDeletedEventHandler
  implements DomainEventHandler<TaskDeletedEvent>
{
  constructor(
    private readonly searchService: ISearchService,
    private readonly activityService: IActivityService,
    private readonly webSocketService: IWebSocketService,
    private readonly analyticsService: IAnalyticsService,
    private readonly logger: ILogger
  ) {}

  canHandle(event: any): boolean {
    return event instanceof TaskDeletedEvent;
  }

  async handle(event: TaskDeletedEvent): Promise<void> {
    this.logger.info('Handling TaskDeletedEvent', {
      taskId: event.taskId,
      deletedBy: event.deletedBy,
    });

    try {
      // Remove from search index
      await this.searchService.removeTask(event.taskId);

      // Record activity
      await this.activityService.recordActivity({
        entityType: 'task',
        entityId: event.taskId,
        action: 'deleted',
        userId: event.deletedBy,
        metadata: {
          title: event.title,
          projectId: event.projectId,
        },
        occurredAt: event.occurredAt,
      });

      // Send real-time notification
      if (event.projectId) {
        await this.webSocketService.broadcastToProject(event.projectId, {
          type: 'task_deleted',
          data: {
            taskId: event.taskId,
            deletedBy: event.deletedBy,
          },
        });
      }

      // Track analytics
      await this.analyticsService.trackEvent('task_deleted', {
        taskId: event.taskId,
        deletedBy: event.deletedBy,
        projectId: event.projectId,
      });

      this.logger.info('TaskDeletedEvent handled successfully', {
        taskId: event.taskId,
      });
    } catch (error) {
      this.logger.error('Error handling TaskDeletedEvent', {
        taskId: event.taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

@injectable()
export class TaskMovedToProjectEventHandler
  implements DomainEventHandler<TaskMovedToProjectEvent>
{
  constructor(
    private readonly searchService: ISearchService,
    private readonly activityService: IActivityService,
    private readonly webSocketService: IWebSocketService,
    private readonly notificationService: INotificationService,
    private readonly logger: ILogger
  ) {}

  canHandle(event: any): boolean {
    return event instanceof TaskMovedToProjectEvent;
  }

  async handle(event: TaskMovedToProjectEvent): Promise<void> {
    this.logger.info('Handling TaskMovedToProjectEvent', {
      taskId: event.taskId,
      fromProjectId: event.previousProjectId,
      toProjectId: event.newProjectId,
      movedBy: event.movedBy,
    });

    try {
      // Update search index
      await this.searchService.updateTaskProject(
        event.taskId,
        event.newProjectId
      );

      // Record activity
      await this.activityService.recordActivity({
        entityType: 'task',
        entityId: event.taskId,
        action: 'moved_to_project',
        userId: event.movedBy,
        metadata: {
          fromProjectId: event.previousProjectId,
          toProjectId: event.newProjectId,
        },
        occurredAt: event.occurredAt,
      });

      // Send real-time notifications to both projects
      if (event.previousProjectId) {
        await this.webSocketService.broadcastToProject(
          event.previousProjectId,
          {
            type: 'task_moved_out',
            data: {
              taskId: event.taskId,
              toProjectId: event.newProjectId,
              movedBy: event.movedBy,
            },
          }
        );
      }

      if (event.newProjectId) {
        await this.webSocketService.broadcastToProject(event.newProjectId, {
          type: 'task_moved_in',
          data: {
            taskId: event.taskId,
            fromProjectId: event.previousProjectId,
            movedBy: event.movedBy,
          },
        });

        // Notify new project members
        await this.notificationService.notifyProjectMembers(
          event.newProjectId,
          {
            type: 'task_moved_to_project',
            title: 'Task Moved to Project',
            message: `A task has been moved to this project`,
            data: {
              taskId: event.taskId,
              movedBy: event.movedBy,
            },
            excludeUsers: [event.movedBy],
          }
        );
      }

      this.logger.info('TaskMovedToProjectEvent handled successfully', {
        taskId: event.taskId,
      });
    } catch (error) {
      this.logger.error('Error handling TaskMovedToProjectEvent', {
        taskId: event.taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
