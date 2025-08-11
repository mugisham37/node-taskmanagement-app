import { Logger } from '../monitoring/logging-service';
import { JobHandler } from './job-types';
import { TaskStatus } from '../../shared/enums/common.enums';

export interface NotificationJobPayload {
  type: 'overdue' | 'upcoming' | 'reminder' | 'digest';
  userId?: string;
  taskId?: string;
  data?: Record<string, any>;
}

export class NotificationJobHandler implements JobHandler {
  name = 'notification-job';

  constructor(
    private logger: Logger,
    private taskService: any, // Will be injected
    private notificationService: any // Will be injected
  ) {}

  /**
   * Execute notification job
   */
  async execute(payload: NotificationJobPayload): Promise<any> {
    this.logger.info('Processing notification job', {
      operation: 'notification-job',
      type: payload.type,
      ...(payload.userId && { userId: payload.userId }),
      ...(payload.taskId && { taskId: payload.taskId }),
    });

    switch (payload.type) {
      case 'overdue':
        return await this.processOverdueNotifications(payload);
      case 'upcoming':
        return await this.processUpcomingNotifications(payload);
      case 'reminder':
        return await this.processReminderNotifications(payload);
      case 'digest':
        return await this.processDigestNotifications(payload);
      default:
        throw new Error(`Unknown notification type: ${payload.type}`);
    }
  }

  /**
   * Validate notification job payload
   */
  validate(payload: NotificationJobPayload): boolean {
    if (!payload.type) {
      return false;
    }

    const validTypes = ['overdue', 'upcoming', 'reminder', 'digest'];
    return validTypes.includes(payload.type);
  }

  /**
   * Handle successful notification processing
   */
  async onSuccess(result: any): Promise<void> {
    this.logger.info('Notification job completed successfully', {
      notificationsSent: result.notificationsSent,
      type: result.type,
    });
  }

  /**
   * Handle notification processing failure
   */
  async onFailure(error: Error): Promise<void> {
    this.logger.error('Notification job failed', error, {
      operation: 'notification-job-failure',
    });
  }

  /**
   * Handle notification job retry
   */
  async onRetry(attempt: number): Promise<void> {
    this.logger.warn('Retrying notification job', {
      attempt,
      maxRetries: 3,
    });
  }

  /**
   * Process overdue task notifications
   */
  private async processOverdueNotifications(
    _payload: NotificationJobPayload
  ): Promise<any> {
    const startTime = Date.now();
    let notificationsSent = 0;
    const errors: string[] = [];

    try {
      this.logger.debug('Processing overdue task notifications');

      const now = new Date();

      // Get overdue tasks
      const overdueTasks = await this.taskService.getTasks(
        {
          dueDateTo: now,
          status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW],
        },
        { limit: 1000 },
        { userId: 'system', timestamp: new Date() }
      );

      for (const task of overdueTasks.data) {
        try {
          await this.notificationService.createNotification({
            type: 'task_overdue',
            title: 'Task Overdue',
            message: `Task "${task.title}" is overdue`,
            userId: task.assignedTo,
            taskId: task.id,
            data: {
              taskTitle: task.title,
              dueDate: task.dueDate,
              projectName: task.project?.name,
            },
            channels: ['inApp', 'email'],
            priority: 'high',
          });

          notificationsSent++;

          this.logger.debug('Overdue notification sent', {
            taskId: task.id,
            userId: task.assignedTo,
            dueDate: task.dueDate,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Task ${task.id}: ${errorMessage}`);

          this.logger.error('Failed to send overdue notification', error instanceof Error ? error : new Error(errorMessage), {
            operation: 'send-overdue-notification',
            taskId: task.id,
          });
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        type: 'overdue',
        notificationsSent,
        tasksProcessed: overdueTasks.data.length,
        errors,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error processing overdue notifications', error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'process-overdue-notifications',
      });
      throw error;
    }
  }

  /**
   * Process upcoming due date notifications
   */
  private async processUpcomingNotifications(
    _payload: NotificationJobPayload
  ): Promise<any> {
    const startTime = Date.now();
    let notificationsSent = 0;
    const errors: string[] = [];

    try {
      this.logger.debug('Processing upcoming due date notifications');

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Get tasks due in the next 24 hours
      const upcomingTasks = await this.taskService.getTasks(
        {
          dueDateFrom: now,
          dueDateTo: tomorrow,
          status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW],
        },
        { limit: 1000 },
        { userId: 'system', timestamp: new Date() }
      );

      for (const task of upcomingTasks.data) {
        try {
          const hoursUntilDue = task.dueDate
            ? Math.floor(
                (new Date(task.dueDate).getTime() - now.getTime()) /
                  (1000 * 60 * 60)
              )
            : null;

          await this.notificationService.createNotification({
            type: 'task_due_soon',
            title: 'Task Due Soon',
            message: `Task "${task.title}" is due in ${hoursUntilDue} hours`,
            userId: task.assignedTo,
            taskId: task.id,
            data: {
              taskTitle: task.title,
              dueDate: task.dueDate,
              hoursUntilDue,
              projectName: task.project?.name,
            },
            channels: ['inApp', 'email'],
            priority: 'medium',
          });

          notificationsSent++;

          this.logger.debug('Upcoming notification sent', {
            taskId: task.id,
            userId: task.assignedTo,
            hoursUntilDue,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Task ${task.id}: ${errorMessage}`);

          this.logger.error('Failed to send upcoming notification', error instanceof Error ? error : new Error(errorMessage), {
            operation: 'send-upcoming-notification',
            taskId: task.id,
          });
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        type: 'upcoming',
        notificationsSent,
        tasksProcessed: upcomingTasks.data.length,
        errors,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error processing upcoming notifications', error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'process-upcoming-notifications',
      });
      throw error;
    }
  }

  /**
   * Process reminder notifications
   */
  private async processReminderNotifications(
    payload: NotificationJobPayload
  ): Promise<any> {
    const startTime = Date.now();
    let notificationsSent = 0;

    try {
      this.logger.debug('Processing reminder notifications', {
        operation: 'reminder-notifications',
        ...(payload.userId && { userId: payload.userId }),
        ...(payload.taskId && { taskId: payload.taskId }),
      });

      if (payload.taskId && payload.userId) {
        // Send specific task reminder
        await this.notificationService.createNotification({
          type: 'task_reminder',
          title: 'Task Reminder',
          message: payload.data?.['message'] || 'You have a task reminder',
          userId: payload.userId,
          taskId: payload.taskId,
          data: payload.data,
          channels: ['inApp', 'email'],
          priority: 'medium',
        });

        notificationsSent = 1;
      }

      const processingTime = Date.now() - startTime;

      return {
        type: 'reminder',
        notificationsSent,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error processing reminder notifications', error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'process-reminder-notifications',
      });
      throw error;
    }
  }

  /**
   * Process daily digest notifications
   */
  private async processDigestNotifications(
    _payload: NotificationJobPayload
  ): Promise<any> {
    const startTime = Date.now();
    let notificationsSent = 0;
    const errors: string[] = [];

    try {
      this.logger.debug('Processing daily digest notifications');

      // Get all active users (this would need to be implemented)
      const users = await this.getUsersForDigest();

      for (const user of users) {
        try {
          const digestData = await this.generateUserDigest(user.id);

          if (digestData.hasContent) {
            await this.notificationService.createNotification({
              type: 'daily_digest',
              title: 'Daily Activity Summary',
              message: 'Your daily activity summary is ready',
              userId: user.id,
              data: digestData,
              channels: ['email'],
              priority: 'low',
            });

            notificationsSent++;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`User ${user.id}: ${errorMessage}`);

          this.logger.error('Failed to send digest notification', error instanceof Error ? error : new Error(errorMessage), {
            operation: 'send-digest-notification',
            userId: user.id,
          });
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        type: 'digest',
        notificationsSent,
        usersProcessed: users.length,
        errors,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error processing digest notifications', error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'process-digest-notifications',
      });
      throw error;
    }
  }

  /**
   * Get users who should receive digest notifications
   */
  private async getUsersForDigest(): Promise<
    Array<{ id: string; email: string }>
  > {
    // This would be implemented to get users from the database
    // For now, return empty array
    return [];
  }

  /**
   * Generate digest data for a user
   */
  private async generateUserDigest(userId: string): Promise<{
    hasContent: boolean;
    completedTasks: number;
    upcomingDeadlines: any[];
    newAssignments: any[];
  }> {
    try {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      // Get completed tasks today
      const completedTasks = await this.taskService.getTasks(
        {
          assignedTo: userId,
          status: [TaskStatus.COMPLETED],
          completedFrom: startOfDay,
          completedTo: endOfDay,
        },
        { limit: 100 },
        { userId: 'system', timestamp: new Date() }
      );

      // Get upcoming deadlines (next 3 days)
      const threeDaysFromNow = new Date(
        today.getTime() + 3 * 24 * 60 * 60 * 1000
      );
      const upcomingTasks = await this.taskService.getTasks(
        {
          assignedTo: userId,
          dueDateFrom: today,
          dueDateTo: threeDaysFromNow,
          status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
        },
        { limit: 10 },
        { userId: 'system', timestamp: new Date() }
      );

      // Get new assignments today
      const newAssignments = await this.taskService.getTasks(
        {
          assignedTo: userId,
          dueDateFrom: startOfDay,
          dueDateTo: endOfDay,
          status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
        },
        { limit: 10 },
        { userId: 'system', timestamp: new Date() }
      );

      const hasContent =
        completedTasks.data.length > 0 ||
        upcomingTasks.data.length > 0 ||
        newAssignments.data.length > 0;

      return {
        hasContent,
        completedTasks: completedTasks.data.length,
        upcomingDeadlines: upcomingTasks.data,
        newAssignments: newAssignments.data,
      };
    } catch (error) {
      this.logger.error('Error generating user digest', error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'generate-user-digest',
        userId,
      });

      return {
        hasContent: false,
        completedTasks: 0,
        upcomingDeadlines: [],
        newAssignments: [],
      };
    }
  }
}
