import { Logger } from '../monitoring/logging-service';
import { JobManager } from './job-manager';
import { JobConfig, JobMonitoringConfig } from './job-types';
import { NotificationJobHandler } from './notification-job';
import { RecurringTaskJobHandler } from './recurring-task-job';
import { CalendarReminderJobHandler } from './calendar-reminder-job';
import { WebhookDeliveryJobHandler } from './webhook-delivery-job';

export class JobFactory {
  private static instance: JobFactory;
  private jobManager?: JobManager;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): JobFactory {
    if (!JobFactory.instance) {
      JobFactory.instance = new JobFactory();
    }
    return JobFactory.instance;
  }

  /**
   * Create and configure job manager
   */
  createJobManager(
    logger: Logger,
    config: Partial<JobConfig> = {},
    monitoringConfig: Partial<JobMonitoringConfig> = {}
  ): JobManager {
    if (this.jobManager) {
      return this.jobManager;
    }

    const defaultConfig: JobConfig = {
      enabled: true,
      concurrency: 5,
      retryDelay: 5000,
      maxRetries: 3,
      timeout: 30000,
      cleanupInterval: 300000,
      maxJobHistory: 1000,
      ...config,
    };

    this.jobManager = new JobManager(logger, defaultConfig);

    // Register default job handlers
    this.registerDefaultHandlers(this.jobManager, logger);

    return this.jobManager;
  }

  /**
   * Get existing job manager
   */
  getJobManager(): JobManager | null {
    return this.jobManager || null;
  }

  /**
   * Register default job handlers
   */
  private registerDefaultHandlers(
    jobManager: JobManager,
    logger: Logger
  ): void {
    // These would be injected with proper dependencies in a real implementation
    const mockTaskService = this.createMockTaskService();
    const mockNotificationService = this.createMockNotificationService();
    const mockCalendarService = this.createMockCalendarService();
    const mockWebhookService = this.createMockWebhookService();
    const mockEmailService = this.createMockEmailService();
    const mockHttpClient = this.createMockHttpClient();
    const mockRecurringTaskService = this.createMockRecurringTaskService();

    // Register notification job handler
    const notificationHandler = new NotificationJobHandler(
      logger,
      mockTaskService,
      mockNotificationService
    );
    jobManager.registerHandler(notificationHandler);

    // Register recurring task job handler
    const recurringTaskHandler = new RecurringTaskJobHandler(
      logger,
      mockRecurringTaskService,
      mockTaskService
    );
    jobManager.registerHandler(recurringTaskHandler);

    // Register calendar reminder job handler
    const calendarReminderHandler = new CalendarReminderJobHandler(
      logger,
      mockCalendarService,
      mockNotificationService,
      mockEmailService
    );
    jobManager.registerHandler(calendarReminderHandler);

    // Register webhook delivery job handler
    const webhookDeliveryHandler = new WebhookDeliveryJobHandler(
      logger,
      mockWebhookService,
      mockHttpClient
    );
    jobManager.registerHandler(webhookDeliveryHandler);

    logger.info('Default job handlers registered', {
      handlers: [
        'notification-job',
        'recurring-task-job',
        'calendar-reminder-job',
        'webhook-delivery-job',
      ],
    });
  }

  /**
   * Create job manager with custom handlers
   */
  createCustomJobManager(
    logger: Logger,
    handlers: any[],
    config: Partial<JobConfig> = {}
  ): JobManager {
    const jobManager = this.createJobManager(logger, config);

    // Register custom handlers
    for (const handler of handlers) {
      jobManager.registerHandler(handler);
    }

    return jobManager;
  }

  /**
   * Reset job manager (for testing)
   */
  reset(): void {
    if (this.jobManager) {
      this.jobManager.stop().catch(() => {
        // Ignore errors during shutdown
      });
      this.jobManager = undefined;
    }
  }

  // Mock services for demonstration - these would be replaced with real implementations
  private createMockTaskService(): any {
    return {
      getTasks: async () => ({ data: [] }),
      createTask: async () => ({ id: 'mock-task-id' }),
      updateTask: async () => ({ id: 'mock-task-id' }),
    };
  }

  private createMockNotificationService(): any {
    return {
      createNotification: async () => ({ id: 'mock-notification-id' }),
      sendNotification: async () => ({ success: true }),
    };
  }

  private createMockCalendarService(): any {
    return {
      getEvents: async () => [],
      updateReminder: async () => ({ success: true }),
      processEventReminders: async () => 0,
    };
  }

  private createMockWebhookService(): any {
    return {
      updateDelivery: async () => ({ success: true }),
      getDeliveries: async () => [],
    };
  }

  private createMockEmailService(): any {
    return {
      sendEmail: async () => ({ success: true }),
    };
  }

  private createMockHttpClient(): any {
    return {
      request: async () => ({
        status: 200,
        data: { success: true },
        headers: {},
      }),
    };
  }

  private createMockRecurringTaskService(): any {
    return {
      getRecurringTasks: async () => [],
      updateRecurringTask: async () => ({ success: true }),
      processRecurringTasks: async () => ({ tasksCreated: 0 }),
    };
  }
}
