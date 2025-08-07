/**
 * Integration Event Handlers
 *
 * This module contains handlers for integration events that facilitate communication
 * between different bounded contexts and external systems.
 */

import { IntegrationEventHandler } from '@/shared/events/integration-event';
import {
  TaskCreatedIntegrationEvent,
  TaskCompletedIntegrationEvent,
  TaskAssignedIntegrationEvent,
  ProjectUpdatedIntegrationEvent,
  UserRegisteredIntegrationEvent,
} from '@/shared/events/integration-events';
import { IWebhookService } from '@/domain/webhook/services/webhook-service';
import { IExternalIntegrationService } from '@/domain/integration/services/external-integration-service';
import { IAnalyticsService } from '@/domain/analytics/services/analytics-service';
import { INotificationService } from '@/domain/notification/services/notification-service';
import { ILogger } from '@/shared/types/logger';
import { injectable } from '@/application/decorators/injectable';

@injectable()
export class TaskCreatedIntegrationEventHandler
  implements IntegrationEventHandler<TaskCreatedIntegrationEvent>
{
  constructor(
    private readonly webhookService: IWebhookService,
    private readonly externalIntegrationService: IExternalIntegrationService,
    private readonly analyticsService: IAnalyticsService,
    private readonly logger: ILogger
  ) {}

  canHandle(event: any): boolean {
    return event instanceof TaskCreatedIntegrationEvent;
  }

  async handle(event: TaskCreatedIntegrationEvent): Promise<void> {
    this.logger.info('Handling TaskCreatedIntegrationEvent', {
      taskId: event.taskId,
      projectId: event.projectId,
    });

    try {
      // Send webhook notifications to external systems
      await this.webhookService.sendWebhook('task.created', {
        taskId: event.taskId,
        title: event.title,
        projectId: event.projectId,
        creatorId: event.creatorId,
        assigneeId: event.assigneeId,
        priority: event.priority,
        createdAt: event.occurredAt,
      });

      // Sync with external project management tools
      if (event.projectId) {
        await this.externalIntegrationService.syncTaskToExternalSystems(
          event.taskId,
          {
            action: 'created',
            projectId: event.projectId,
            data: {
              title: event.title,
              description: event.description,
              priority: event.priority,
              assigneeId: event.assigneeId,
            },
          }
        );
      }

      // Send to external analytics platforms
      await this.analyticsService.sendToExternalAnalytics('task_created', {
        taskId: event.taskId,
        projectId: event.projectId,
        priority: event.priority,
        hasAssignee: !!event.assigneeId,
        timestamp: event.occurredAt,
      });

      // Update external reporting systems
      await this.externalIntegrationService.updateExternalReports(
        'task_metrics',
        {
          action: 'increment',
          metric: 'tasks_created',
          projectId: event.projectId,
          timestamp: event.occurredAt,
        }
      );

      this.logger.info('TaskCreatedIntegrationEvent handled successfully', {
        taskId: event.taskId,
      });
    } catch (error) {
      this.logger.error('Error handling TaskCreatedIntegrationEvent', {
        taskId: event.taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - integration events should not fail the main operation
    }
  }
}

@injectable()
export class TaskCompletedIntegrationEventHandler
  implements IntegrationEventHandler<TaskCompletedIntegrationEvent>
{
  constructor(
    private readonly webhookService: IWebhookService,
    private readonly externalIntegrationService: IExternalIntegrationService,
    private readonly analyticsService: IAnalyticsService,
    private readonly logger: ILogger
  ) {}

  canHandle(event: any): boolean {
    return event instanceof TaskCompletedIntegrationEvent;
  }

  async handle(event: TaskCompletedIntegrationEvent): Promise<void> {
    this.logger.info('Handling TaskCompletedIntegrationEvent', {
      taskId: event.taskId,
      completedBy: event.completedBy,
    });

    try {
      // Send webhook notifications
      await this.webhookService.sendWebhook('task.completed', {
        taskId: event.taskId,
        completedBy: event.completedBy,
        actualHours: event.actualHours,
        completionNotes: event.completionNotes,
        projectId: event.projectId,
        completedAt: event.occurredAt,
      });

      // Sync completion with external systems
      if (event.projectId) {
        await this.externalIntegrationService.syncTaskToExternalSystems(
          event.taskId,
          {
            action: 'completed',
            projectId: event.projectId,
            data: {
              completedBy: event.completedBy,
              actualHours: event.actualHours,
              completionNotes: event.completionNotes,
              completedAt: event.occurredAt,
            },
          }
        );
      }

      // Send completion metrics to external analytics
      await this.analyticsService.sendToExternalAnalytics('task_completed', {
        taskId: event.taskId,
        completedBy: event.completedBy,
        actualHours: event.actualHours,
        projectId: event.projectId,
        timestamp: event.occurredAt,
      });

      // Update time tracking in external systems
      if (event.actualHours) {
        await this.externalIntegrationService.updateTimeTracking({
          taskId: event.taskId,
          userId: event.completedBy,
          hours: event.actualHours,
          date: event.occurredAt,
          projectId: event.projectId,
        });
      }

      // Trigger external automation workflows
      await this.externalIntegrationService.triggerWorkflow('task_completion', {
        taskId: event.taskId,
        projectId: event.projectId,
        completedBy: event.completedBy,
      });

      this.logger.info('TaskCompletedIntegrationEvent handled successfully', {
        taskId: event.taskId,
      });
    } catch (error) {
      this.logger.error('Error handling TaskCompletedIntegrationEvent', {
        taskId: event.taskId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

@injectable()
export class TaskAssignedIntegrationEventHandler
  implements IntegrationEventHandler<TaskAssignedIntegrationEvent>
{
  constructor(
    private readonly webhookService: IWebhookService,
    private readonly externalIntegrationService: IExternalIntegrationService,
    private readonly notificationService: INotificationService,
    private readonly logger: ILogger
  ) {}

  canHandle(event: any): boolean {
    return event instanceof TaskAssignedIntegrationEvent;
  }

  async handle(event: TaskAssignedIntegrationEvent): Promise<void> {
    this.logger.info('Handling TaskAssignedIntegrationEvent', {
      taskId: event.taskId,
      assigneeId: event.assigneeId,
      assignedBy: event.assignedBy,
    });

    try {
      // Send webhook notifications
      await this.webhookService.sendWebhook('task.assigned', {
        taskId: event.taskId,
        assigneeId: event.assigneeId,
        assignedBy: event.assignedBy,
        previousAssigneeId: event.previousAssigneeId,
        projectId: event.projectId,
        assignedAt: event.occurredAt,
      });

      // Sync assignment with external systems
      await this.externalIntegrationService.syncTaskToExternalSystems(
        event.taskId,
        {
          action: 'assigned',
          projectId: event.projectId,
          data: {
            assigneeId: event.assigneeId,
            assignedBy: event.assignedBy,
            previousAssigneeId: event.previousAssigneeId,
          },
        }
      );

      // Send external notifications (Slack, Teams, etc.)
      await this.externalIntegrationService.sendExternalNotification({
        type: 'task_assigned',
        recipientId: event.assigneeId,
        data: {
          taskId: event.taskId,
          assignedBy: event.assignedBy,
          projectId: event.projectId,
        },
      });

      // Update external calendar systems
      await this.externalIntegrationService.updateExternalCalendar({
        userId: event.assigneeId,
        action: 'add_task',
        taskId: event.taskId,
        projectId: event.projectId,
      });

      this.logger.info('TaskAssignedIntegrationEvent handled successfully', {
        taskId: event.taskId,
      });
    } catch (error) {
      this.logger.error('Error handling TaskAssignedIntegrationEvent', {
        taskId: event.taskId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

@injectable()
export class ProjectUpdatedIntegrationEventHandler
  implements IntegrationEventHandler<ProjectUpdatedIntegrationEvent>
{
  constructor(
    private readonly webhookService: IWebhookService,
    private readonly externalIntegrationService: IExternalIntegrationService,
    private readonly analyticsService: IAnalyticsService,
    private readonly logger: ILogger
  ) {}

  canHandle(event: any): boolean {
    return event instanceof ProjectUpdatedIntegrationEvent;
  }

  async handle(event: ProjectUpdatedIntegrationEvent): Promise<void> {
    this.logger.info('Handling ProjectUpdatedIntegrationEvent', {
      projectId: event.projectId,
      updatedBy: event.updatedBy,
    });

    try {
      // Send webhook notifications
      await this.webhookService.sendWebhook('project.updated', {
        projectId: event.projectId,
        updatedBy: event.updatedBy,
        changes: event.changes,
        updatedAt: event.occurredAt,
      });

      // Sync project changes with external systems
      await this.externalIntegrationService.syncProjectToExternalSystems(
        event.projectId,
        {
          action: 'updated',
          changes: event.changes,
          updatedBy: event.updatedBy,
        }
      );

      // Update external reporting dashboards
      await this.externalIntegrationService.updateExternalReports(
        'project_metrics',
        {
          action: 'update',
          projectId: event.projectId,
          changes: event.changes,
          timestamp: event.occurredAt,
        }
      );

      // Send project update analytics
      await this.analyticsService.sendToExternalAnalytics('project_updated', {
        projectId: event.projectId,
        updatedBy: event.updatedBy,
        changeCount: Object.keys(event.changes).length,
        timestamp: event.occurredAt,
      });

      this.logger.info('ProjectUpdatedIntegrationEvent handled successfully', {
        projectId: event.projectId,
      });
    } catch (error) {
      this.logger.error('Error handling ProjectUpdatedIntegrationEvent', {
        projectId: event.projectId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

@injectable()
export class UserRegisteredIntegrationEventHandler
  implements IntegrationEventHandler<UserRegisteredIntegrationEvent>
{
  constructor(
    private readonly webhookService: IWebhookService,
    private readonly externalIntegrationService: IExternalIntegrationService,
    private readonly notificationService: INotificationService,
    private readonly analyticsService: IAnalyticsService,
    private readonly logger: ILogger
  ) {}

  canHandle(event: any): boolean {
    return event instanceof UserRegisteredIntegrationEvent;
  }

  async handle(event: UserRegisteredIntegrationEvent): Promise<void> {
    this.logger.info('Handling UserRegisteredIntegrationEvent', {
      userId: event.userId,
      email: event.email,
    });

    try {
      // Send webhook notifications
      await this.webhookService.sendWebhook('user.registered', {
        userId: event.userId,
        email: event.email,
        firstName: event.firstName,
        lastName: event.lastName,
        registeredAt: event.occurredAt,
      });

      // Create user in external systems
      await this.externalIntegrationService.createUserInExternalSystems({
        userId: event.userId,
        email: event.email,
        firstName: event.firstName,
        lastName: event.lastName,
      });

      // Send welcome notifications through external channels
      await this.externalIntegrationService.sendExternalNotification({
        type: 'user_welcome',
        recipientId: event.userId,
        data: {
          firstName: event.firstName,
          email: event.email,
        },
      });

      // Add user to external mailing lists
      await this.externalIntegrationService.addToMailingList({
        email: event.email,
        firstName: event.firstName,
        lastName: event.lastName,
        listType: 'new_users',
      });

      // Track user registration in external analytics
      await this.analyticsService.sendToExternalAnalytics('user_registered', {
        userId: event.userId,
        email: event.email,
        registrationSource: event.registrationSource,
        timestamp: event.occurredAt,
      });

      // Set up user in external monitoring systems
      await this.externalIntegrationService.setupUserMonitoring({
        userId: event.userId,
        email: event.email,
      });

      this.logger.info('UserRegisteredIntegrationEvent handled successfully', {
        userId: event.userId,
      });
    } catch (error) {
      this.logger.error('Error handling UserRegisteredIntegrationEvent', {
        userId: event.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
