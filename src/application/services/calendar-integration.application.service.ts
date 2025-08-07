import {
  BaseService,
  ServiceContext,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../../services/base.service';
import {
  CalendarIntegration,
  CreateCalendarIntegrationProps,
  UpdateCalendarIntegrationProps,
  SyncDirection,
} from '../../domain/calendar/entities/calendar-integration.entity';
import { CalendarIntegrationId } from '../../domain/calendar/value-objects/calendar-integration-id.vo';
import { UserId } from '../../domain/shared/value-objects/user-id.vo';
import {
  CalendarProvider,
  CalendarProviderType,
} from '../../domain/calendar/value-objects/calendar-provider.vo';
import {
  GoogleCalendarIntegrationService,
  SyncResult,
} from '../../domain/calendar/services/google-calendar-integration.service';
import {
  TaskCalendarSyncService,
  TaskCalendarSyncOptions,
  CapacityPlanningResult,
} from '../../domain/calendar/services/task-calendar-sync.service';
import { CalendarEventApplicationService } from './calendar-event.application.service';
import { DomainEventBus } from '../../domain/shared/events/domain-event-bus';
import {
  notificationService,
  NotificationType,
} from '../../services/notification.service';
import { activityService } from '../../services/activity.service';

export interface CalendarIntegrationCreateData {
  provider: string;
  providerAccountId: string;
  calendarId: string;
  calendarName: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  syncEnabled?: boolean;
  settings?: {
    syncDirection?: SyncDirection;
    syncTasks?: boolean;
    syncMeetings?: boolean;
    syncDeadlines?: boolean;
    defaultReminders?: number[];
  };
}

export interface CalendarIntegrationUpdateData {
  calendarName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  syncEnabled?: boolean;
  settings?: {
    syncDirection?: SyncDirection;
    syncTasks?: boolean;
    syncMeetings?: boolean;
    syncDeadlines?: boolean;
    defaultReminders?: number[];
  };
}

export interface CalendarSyncOptions {
  timeMin?: Date;
  timeMax?: Date;
  dryRun?: boolean;
  forceSync?: boolean;
}

export interface TaskSyncOptions extends TaskCalendarSyncOptions {
  taskIds?: string[];
  projectIds?: string[];
}

export class CalendarIntegrationApplicationService extends BaseService {
  constructor(
    private readonly googleCalendarService: GoogleCalendarIntegrationService,
    private readonly taskCalendarSyncService: TaskCalendarSyncService,
    private readonly calendarEventService: CalendarEventApplicationService,
    private readonly domainEventBus: DomainEventBus
  ) {
    super('CalendarIntegrationApplicationService', {
      enableCache: true,
      cacheTimeout: 300, // 5 minutes cache
      enableAudit: true,
      enableMetrics: true,
    });
  }

  // Core CRUD Operations
  async createCalendarIntegration(
    data: CalendarIntegrationCreateData,
    context?: ServiceContext
  ): Promise<CalendarIntegration> {
    const ctx = this.createContext(context);
    this.logOperation('createCalendarIntegration', ctx, {
      provider: data.provider,
      calendarName: data.calendarName,
    });

    try {
      // Validate input
      this.validateCalendarIntegrationData(data);

      // Check if integration already exists
      await this.checkDuplicateIntegration(data, ctx.userId!);

      // Create domain props
      const createProps: CreateCalendarIntegrationProps = {
        ...data,
        userId: ctx.userId!,
      };

      // Create integration
      const integration = CalendarIntegration.create(createProps);

      // Test the integration
      await this.testIntegration(integration);

      // Publish domain events
      await this.publishDomainEvents(integration);

      // Send notification
      await notificationService.createNotification({
        userId: ctx.userId!,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Calendar Integration Added',
        message: `Successfully connected ${integration.provider.getDisplayName()} calendar: ${integration.calendarName.value}`,
        data: {
          integrationId: integration.id.value,
          provider: integration.provider.value,
        },
      });

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_created', // Using closest available type
          data: {
            action: 'calendar_integration_created',
            provider: integration.provider.value,
            calendarName: integration.calendarName.value,
          },
          metadata: {
            integrationId: integration.id.value,
          },
        },
        ctx
      );

      await this.recordMetric('calendar_integration.created', 1, {
        provider: integration.provider.value,
      });

      return integration;
    } catch (error) {
      this.handleError(error, 'createCalendarIntegration', ctx);
    }
  }

  async getCalendarIntegrationById(
    id: string,
    context?: ServiceContext
  ): Promise<CalendarIntegration> {
    const ctx = this.createContext(context);
    this.logOperation('getCalendarIntegrationById', ctx, { integrationId: id });

    try {
      const integrationId = CalendarIntegrationId.create(id);
      const integration = await this.findIntegrationById(integrationId);

      if (!integration) {
        throw new NotFoundError('Calendar Integration', id);
      }

      // Check access permissions
      if (integration.userId.value !== ctx.userId) {
        throw new ForbiddenError(
          'You do not have access to this calendar integration'
        );
      }

      return integration;
    } catch (error) {
      this.handleError(error, 'getCalendarIntegrationById', ctx);
    }
  }

  async getUserCalendarIntegrations(
    context?: ServiceContext
  ): Promise<CalendarIntegration[]> {
    const ctx = this.createContext(context);
    this.logOperation('getUserCalendarIntegrations', ctx);

    try {
      const userId = UserId.create(ctx.userId!);
      const integrations = await this.findIntegrationsByUserId(userId);
      return integrations;
    } catch (error) {
      this.handleError(error, 'getUserCalendarIntegrations', ctx);
    }
  }

  async updateCalendarIntegration(
    id: string,
    data: CalendarIntegrationUpdateData,
    context?: ServiceContext
  ): Promise<CalendarIntegration> {
    const ctx = this.createContext(context);
    this.logOperation('updateCalendarIntegration', ctx, {
      integrationId: id,
      updates: Object.keys(data),
    });

    try {
      const integration = await this.getCalendarIntegrationById(id, ctx);

      // Update integration
      integration.update(data);

      // Test the integration if tokens were updated
      if (data.accessToken || data.refreshToken) {
        await this.testIntegration(integration);
      }

      // Publish domain events
      await this.publishDomainEvents(integration);

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_updated', // Using closest available type
          data: {
            action: 'calendar_integration_updated',
            provider: integration.provider.value,
            calendarName: integration.calendarName.value,
            changes: Object.keys(data),
          },
          metadata: {
            integrationId: integration.id.value,
          },
        },
        ctx
      );

      await this.recordMetric('calendar_integration.updated', 1);

      return integration;
    } catch (error) {
      this.handleError(error, 'updateCalendarIntegration', ctx);
    }
  }

  async deleteCalendarIntegration(
    id: string,
    context?: ServiceContext
  ): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('deleteCalendarIntegration', ctx, { integrationId: id });

    try {
      const integration = await this.getCalendarIntegrationById(id, ctx);

      // Mark as deleted (triggers domain event)
      integration.delete();

      // Publish domain events
      await this.publishDomainEvents(integration);

      // Send notification
      await notificationService.createNotification({
        userId: ctx.userId!,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Calendar Integration Removed',
        message: `Disconnected ${integration.provider.getDisplayName()} calendar: ${integration.calendarName.value}`,
        data: {
          integrationId: integration.id.value,
          provider: integration.provider.value,
        },
      });

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'calendar_integration_deleted',
          data: {
            provider: integration.provider.value,
            calendarName: integration.calendarName.value,
          },
          metadata: {
            integrationId: id,
          },
        },
        ctx
      );

      await this.recordMetric('calendar_integration.deleted', 1);
    } catch (error) {
      this.handleError(error, 'deleteCalendarIntegration', ctx);
    }
  }

  // Synchronization Operations
  async syncCalendarIntegration(
    id: string,
    options: CalendarSyncOptions = {},
    context?: ServiceContext
  ): Promise<SyncResult> {
    const ctx = this.createContext(context);
    this.logOperation('syncCalendarIntegration', ctx, {
      integrationId: id,
      options,
    });

    try {
      const integration = await this.getCalendarIntegrationById(id, ctx);

      if (!integration.canSync()) {
        throw new ValidationError(
          'Integration cannot be synced. Check if it is enabled and tokens are valid.'
        );
      }

      // Get user's internal calendar events
      const internalEvents = await this.calendarEventService.getCalendarEvents(
        {
          userId: ctx.userId!,
          startDate: options.timeMin,
          endDate: options.timeMax,
        },
        {},
        ctx
      );

      let syncResult: SyncResult;

      // Perform sync based on provider
      switch (integration.provider.value) {
        case CalendarProviderType.GOOGLE:
          syncResult = await this.googleCalendarService.syncCalendar(
            integration,
            internalEvents.data,
            options
          );
          break;
        default:
          throw new ValidationError(
            `Sync not supported for provider: ${integration.provider.value}`
          );
      }

      // Update integration sync status
      if (syncResult.errors.length === 0) {
        integration.recordSyncSuccess();
      } else {
        syncResult.errors.forEach(error => integration.recordSyncError(error));
      }

      // Publish domain events
      await this.publishDomainEvents(integration);

      // Send notification if there were issues
      if (syncResult.errors.length > 0) {
        await notificationService.createNotification({
          userId: ctx.userId!,
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          title: 'Calendar Sync Issues',
          message: `Calendar sync completed with ${syncResult.errors.length} errors. Check integration settings.`,
          data: {
            integrationId: integration.id.value,
            errors: syncResult.errors,
          },
        });
      }

      await this.recordMetric('calendar_integration.synced', 1, {
        provider: integration.provider.value,
        success: syncResult.errors.length === 0 ? 'true' : 'false',
      });

      return syncResult;
    } catch (error) {
      this.handleError(error, 'syncCalendarIntegration', ctx);
    }
  }

  async syncAllUserIntegrations(
    options: CalendarSyncOptions = {},
    context?: ServiceContext
  ): Promise<{ integrationId: string; result: SyncResult }[]> {
    const ctx = this.createContext(context);
    this.logOperation('syncAllUserIntegrations', ctx, { options });

    try {
      const integrations = await this.getUserCalendarIntegrations(ctx);
      const results: { integrationId: string; result: SyncResult }[] = [];

      for (const integration of integrations) {
        if (integration.canSync() && integration.needsSync()) {
          try {
            const result = await this.syncCalendarIntegration(
              integration.id.value,
              options,
              ctx
            );
            results.push({ integrationId: integration.id.value, result });
          } catch (error) {
            results.push({
              integrationId: integration.id.value,
              result: {
                imported: 0,
                exported: 0,
                updated: 0,
                deleted: 0,
                errors: [
                  error instanceof Error ? error.message : 'Unknown error',
                ],
              },
            });
          }
        }
      }

      return results;
    } catch (error) {
      this.handleError(error, 'syncAllUserIntegrations', ctx);
    }
  }

  // Task-Calendar Synchronization
  async syncTasksToCalendar(
    tasks: any[], // Task interface from domain
    options: TaskSyncOptions,
    context?: ServiceContext
  ): Promise<{ taskId: string; events: any[]; warnings: string[] }[]> {
    const ctx = this.createContext(context);
    this.logOperation('syncTasksToCalendar', ctx, {
      taskCount: tasks.length,
      options,
    });

    try {
      const results: { taskId: string; events: any[]; warnings: string[] }[] =
        [];

      for (const task of tasks) {
        try {
          const syncResult =
            await this.taskCalendarSyncService.syncTaskToCalendar(
              task,
              ctx.userId!,
              options
            );

          results.push({
            taskId: task.id,
            events: syncResult.events,
            warnings: syncResult.warnings,
          });
        } catch (error) {
          results.push({
            taskId: task.id,
            events: [],
            warnings: [
              error instanceof Error ? error.message : 'Unknown error',
            ],
          });
        }
      }

      await this.recordMetric('tasks.synced_to_calendar', tasks.length);

      return results;
    } catch (error) {
      this.handleError(error, 'syncTasksToCalendar', ctx);
    }
  }

  async analyzeCalendarCapacity(
    startDate: Date,
    endDate: Date,
    workingHours: { start: number; end: number; days: number[] },
    context?: ServiceContext
  ): Promise<CapacityPlanningResult> {
    const ctx = this.createContext(context);
    this.logOperation('analyzeCalendarCapacity', ctx, { startDate, endDate });

    try {
      const result = await this.taskCalendarSyncService.analyzeCapacity(
        ctx.userId!,
        startDate,
        endDate,
        workingHours
      );

      return result;
    } catch (error) {
      this.handleError(error, 'analyzeCalendarCapacity', ctx);
    }
  }

  async createTimeBlocks(
    tasks: any[],
    startDate: Date,
    endDate: Date,
    options: TaskCalendarSyncOptions,
    context?: ServiceContext
  ): Promise<any[]> {
    const ctx = this.createContext(context);
    this.logOperation('createTimeBlocks', ctx, { taskCount: tasks.length });

    try {
      const timeBlocks = await this.taskCalendarSyncService.createTimeBlocks(
        ctx.userId!,
        tasks,
        startDate,
        endDate,
        options
      );

      await this.recordMetric('time_blocks.created', timeBlocks.length);

      return timeBlocks;
    } catch (error) {
      this.handleError(error, 'createTimeBlocks', ctx);
    }
  }

  // Helper Methods
  private async testIntegration(
    integration: CalendarIntegration
  ): Promise<void> {
    try {
      switch (integration.provider.value) {
        case CalendarProviderType.GOOGLE:
          // Test by fetching a small number of events
          await this.googleCalendarService.syncCalendar(integration, [], {
            timeMin: new Date(),
            timeMax: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next 24 hours
            dryRun: true,
          });
          break;
        default:
          // For other providers, we'll assume they're valid for now
          break;
      }
    } catch (error) {
      throw new ValidationError(
        `Integration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async checkDuplicateIntegration(
    data: CalendarIntegrationCreateData,
    userId: string
  ): Promise<void> {
    const existingIntegrations = await this.getUserCalendarIntegrations({
      userId,
    } as ServiceContext);

    const duplicate = existingIntegrations.find(
      integration =>
        integration.provider.value === data.provider &&
        integration.providerAccountId === data.providerAccountId &&
        integration.calendarId === data.calendarId
    );

    if (duplicate) {
      throw new ValidationError('This calendar is already integrated');
    }
  }

  private validateCalendarIntegrationData(
    data: CalendarIntegrationCreateData
  ): void {
    if (!data.provider || data.provider.trim().length === 0) {
      throw new ValidationError('Provider is required');
    }

    if (!data.providerAccountId || data.providerAccountId.trim().length === 0) {
      throw new ValidationError('Provider account ID is required');
    }

    if (!data.calendarId || data.calendarId.trim().length === 0) {
      throw new ValidationError('Calendar ID is required');
    }

    if (!data.calendarName || data.calendarName.trim().length === 0) {
      throw new ValidationError('Calendar name is required');
    }

    if (!data.accessToken || data.accessToken.trim().length === 0) {
      throw new ValidationError('Access token is required');
    }

    // Validate provider
    try {
      CalendarProvider.create(data.provider);
    } catch (error) {
      throw new ValidationError(`Invalid provider: ${data.provider}`);
    }
  }

  private async publishDomainEvents(
    integration: CalendarIntegration
  ): Promise<void> {
    const domainEvents = integration.getDomainEvents();
    for (const domainEvent of domainEvents) {
      await this.domainEventBus.publish(domainEvent);
    }
    integration.clearDomainEvents();
  }

  // These would be implemented by the repository layer
  private async findIntegrationById(
    id: CalendarIntegrationId
  ): Promise<CalendarIntegration | null> {
    // This would be implemented by the repository
    throw new Error('Repository method not implemented');
  }

  private async findIntegrationsByUserId(
    userId: UserId
  ): Promise<CalendarIntegration[]> {
    // This would be implemented by the repository
    throw new Error('Repository method not implemented');
  }
}
