import { Logger } from '../monitoring/logging-service';
import { JobHandler } from './job-types';

export interface RecurringTaskJobPayload {
  type: 'process_all' | 'process_specific';
  recurringTaskId?: string;
  userId?: string;
}

export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval: number;
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  dayOfMonth?: number; // 1-31
  monthOfYear?: number; // 1-12
  customCron?: string;
}

export interface RecurringTask {
  id: string;
  title: string;
  description?: string;
  userId: string;
  projectId?: string;
  pattern: RecurrencePattern;
  isActive: boolean;
  lastCreated?: Date;
  nextDue?: Date;
  templateData: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class RecurringTaskJobHandler implements JobHandler {
  name = 'recurring-task-job';

  constructor(
    private logger: Logger,
    private recurringTaskService: any, // Will be injected
    private taskService: any // Will be injected
  ) {}

  /**
   * Execute recurring task job
   */
  async execute(payload: RecurringTaskJobPayload): Promise<any> {
    this.logger.info('Processing recurring task job', {
      operation: 'recurring-task-job',
      type: payload.type,
      ...(payload.recurringTaskId && { recurringTaskId: payload.recurringTaskId }),
      ...(payload.userId && { userId: payload.userId }),
    });

    switch (payload.type) {
      case 'process_all':
        return await this.processAllRecurringTasks();
      case 'process_specific':
        if (!payload.recurringTaskId) {
          throw new Error(
            'recurringTaskId is required for process_specific type'
          );
        }
        return await this.processSpecificRecurringTask(payload.recurringTaskId);
      default:
        throw new Error(`Unknown recurring task job type: ${payload.type}`);
    }
  }

  /**
   * Validate recurring task job payload
   */
  validate(payload: RecurringTaskJobPayload): boolean {
    if (!payload.type) {
      return false;
    }

    const validTypes = ['process_all', 'process_specific'];
    if (!validTypes.includes(payload.type)) {
      return false;
    }

    if (payload.type === 'process_specific' && !payload.recurringTaskId) {
      return false;
    }

    return true;
  }

  /**
   * Handle successful recurring task processing
   */
  async onSuccess(result: any): Promise<void> {
    this.logger.info('Recurring task job completed successfully', {
      tasksCreated: result.tasksCreated,
      recurringTasksProcessed: result.recurringTasksProcessed,
    });
  }

  /**
   * Handle recurring task processing failure
   */
  async onFailure(error: Error): Promise<void> {
    this.logger.error('Recurring task job failed', error, {
      operation: 'recurring-task-job-failure',
    });
  }

  /**
   * Handle recurring task job retry
   */
  async onRetry(attempt: number): Promise<void> {
    this.logger.warn('Retrying recurring task job', {
      attempt,
      maxRetries: 3,
    });
  }

  /**
   * Process all active recurring tasks
   */
  private async processAllRecurringTasks(): Promise<any> {
    const startTime = Date.now();
    let tasksCreated = 0;
    let recurringTasksProcessed = 0;
    const errors: string[] = [];

    try {
      this.logger.debug('Processing all recurring tasks');

      // Get all active recurring tasks that are due
      const recurringTasks = await this.getActiveRecurringTasks();

      for (const recurringTask of recurringTasks) {
        try {
          const created = await this.processRecurringTask(recurringTask);
          if (created) {
            tasksCreated++;
          }
          recurringTasksProcessed++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Recurring task ${recurringTask.id}: ${errorMessage}`);

          this.logger.error('Failed to process recurring task', error instanceof Error ? error : new Error(errorMessage), {
            operation: 'process-recurring-task',
            recurringTaskId: recurringTask.id,
          });
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        type: 'process_all',
        tasksCreated,
        recurringTasksProcessed,
        errors,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error processing all recurring tasks', error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'process-all-recurring-tasks',
      });
      throw error;
    }
  }

  /**
   * Process a specific recurring task
   */
  private async processSpecificRecurringTask(
    recurringTaskId: string
  ): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.debug('Processing specific recurring task', {
        recurringTaskId,
      });

      const recurringTask = await this.getRecurringTask(recurringTaskId);
      if (!recurringTask) {
        throw new Error(`Recurring task not found: ${recurringTaskId}`);
      }

      const created = await this.processRecurringTask(recurringTask);
      const processingTime = Date.now() - startTime;

      return {
        type: 'process_specific',
        recurringTaskId,
        tasksCreated: created ? 1 : 0,
        recurringTasksProcessed: 1,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error processing specific recurring task', error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'process-specific-recurring-task',
        recurringTaskId,
      });
      throw error;
    }
  }

  /**
   * Process a single recurring task
   */
  private async processRecurringTask(
    recurringTask: RecurringTask
  ): Promise<boolean> {
    try {
      // Check if task is due
      if (!this.isRecurringTaskDue(recurringTask)) {
        this.logger.debug('Recurring task not due yet', {
          recurringTaskId: recurringTask.id,
          nextDue: recurringTask.nextDue,
        });
        return false;
      }

      // Create new task instance
      const newTask = await this.createTaskFromRecurringTask(recurringTask);

      // Update recurring task's last created and next due dates
      await this.updateRecurringTaskSchedule(recurringTask);

      this.logger.info('Created task from recurring task', {
        recurringTaskId: recurringTask.id,
        newTaskId: newTask.id,
        nextDue: recurringTask.nextDue,
      });

      return true;
    } catch (error) {
      this.logger.error('Error processing recurring task', error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'process-recurring-task',
        recurringTaskId: recurringTask.id,
      });
      throw error;
    }
  }

  /**
   * Check if recurring task is due for creation
   */
  private isRecurringTaskDue(recurringTask: RecurringTask): boolean {
    if (!recurringTask.isActive) {
      return false;
    }

    const now = new Date();

    // If no nextDue date, calculate it
    if (!recurringTask.nextDue) {
      recurringTask.nextDue = this.calculateNextDueDate(recurringTask);
    }

    return recurringTask.nextDue <= now;
  }

  /**
   * Create a new task from recurring task template
   */
  private async createTaskFromRecurringTask(
    recurringTask: RecurringTask
  ): Promise<any> {
    const dueDate = this.calculateTaskDueDate(recurringTask);

    const taskData = {
      title: recurringTask.title,
      description: recurringTask.description,
      assignedTo: recurringTask.userId,
      projectId: recurringTask.projectId,
      dueDate,
      priority: recurringTask.templateData['priority'] || 'medium',
      tags: recurringTask.templateData['tags'] || [],
      estimatedHours: recurringTask.templateData['estimatedHours'],
      metadata: {
        ...recurringTask.templateData['metadata'],
        recurringTaskId: recurringTask.id,
        createdFromRecurring: true,
      },
    };

    return await this.taskService.createTask(taskData, {
      userId: 'system',
      timestamp: new Date(),
    });
  }

  /**
   * Update recurring task schedule after creating instance
   */
  private async updateRecurringTaskSchedule(
    recurringTask: RecurringTask
  ): Promise<void> {
    const now = new Date();
    const nextDue = this.calculateNextDueDate(recurringTask);

    await this.recurringTaskService.updateRecurringTask(
      recurringTask.id,
      {
        lastCreated: now,
        nextDue,
      },
      {
        userId: 'system',
        timestamp: new Date(),
      }
    );

    recurringTask.lastCreated = now;
    recurringTask.nextDue = nextDue;
  }

  /**
   * Calculate next due date based on recurrence pattern
   */
  private calculateNextDueDate(recurringTask: RecurringTask): Date {
    const pattern = recurringTask.pattern;
    const baseDate = recurringTask.lastCreated || recurringTask.createdAt;

    switch (pattern.type) {
      case 'daily':
        return new Date(
          baseDate.getTime() + pattern.interval * 24 * 60 * 60 * 1000
        );

      case 'weekly':
        const weeklyNext = new Date(
          baseDate.getTime() + pattern.interval * 7 * 24 * 60 * 60 * 1000
        );
        if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
          return this.getNextWeekdayOccurrence(weeklyNext, pattern.daysOfWeek);
        }
        return weeklyNext;

      case 'monthly':
        const monthlyNext = new Date(baseDate);
        monthlyNext.setMonth(monthlyNext.getMonth() + pattern.interval);
        if (pattern.dayOfMonth) {
          monthlyNext.setDate(
            Math.min(pattern.dayOfMonth, this.getDaysInMonth(monthlyNext))
          );
        }
        return monthlyNext;

      case 'yearly':
        const yearlyNext = new Date(baseDate);
        yearlyNext.setFullYear(yearlyNext.getFullYear() + pattern.interval);
        if (pattern.monthOfYear) {
          yearlyNext.setMonth(pattern.monthOfYear - 1);
        }
        if (pattern.dayOfMonth) {
          yearlyNext.setDate(
            Math.min(pattern.dayOfMonth, this.getDaysInMonth(yearlyNext))
          );
        }
        return yearlyNext;

      case 'custom':
        if (pattern.customCron) {
          return this.calculateNextCronDate(pattern.customCron, baseDate);
        }
        throw new Error(
          'Custom cron expression required for custom recurrence type'
        );

      default:
        throw new Error(`Unknown recurrence pattern type: ${pattern.type}`);
    }
  }

  /**
   * Calculate task due date (when the created task should be due)
   */
  private calculateTaskDueDate(recurringTask: RecurringTask): Date | null {
    const templateData = recurringTask.templateData;

    if (!templateData['dueAfterDays'] && !templateData['dueTime']) {
      return null; // No due date
    }

    const now = new Date();

    if (templateData['dueAfterDays']) {
      return new Date(
        now.getTime() + templateData['dueAfterDays'] * 24 * 60 * 60 * 1000
      );
    }

    if (templateData['dueTime']) {
      const dueDate = new Date(now);
      const [hours, minutes] = templateData['dueTime'].split(':').map(Number);
      dueDate.setHours(hours, minutes, 0, 0);

      // If time has passed today, set for tomorrow
      if (dueDate <= now) {
        dueDate.setDate(dueDate.getDate() + 1);
      }

      return dueDate;
    }

    return null;
  }

  /**
   * Get next occurrence of specified weekdays
   */
  private getNextWeekdayOccurrence(fromDate: Date, daysOfWeek: number[]): Date {
    const result = new Date(fromDate);
    const currentDay = result.getDay();

    // Find next occurrence of any specified weekday
    let daysToAdd = 7; // Default to next week if no match

    for (const targetDay of daysOfWeek.sort()) {
      let days = targetDay - currentDay;
      if (days <= 0) {
        days += 7; // Next week
      }

      if (days < daysToAdd) {
        daysToAdd = days;
      }
    }

    result.setDate(result.getDate() + daysToAdd);
    return result;
  }

  /**
   * Get number of days in month
   */
  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  /**
   * Calculate next date based on cron expression
   */
  private calculateNextCronDate(_cronExpression: string, fromDate: Date): Date {
    // This would require a cron parser library
    // For now, return a simple fallback
    return new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
  }

  /**
   * Get all active recurring tasks that might be due
   */
  private async getActiveRecurringTasks(): Promise<RecurringTask[]> {
    // This would be implemented to fetch from database
    // For now, return empty array
    return [];
  }

  /**
   * Get specific recurring task
   */
  private async getRecurringTask(_id: string): Promise<RecurringTask | null> {
    // This would be implemented to fetch from database
    // For now, return null
    return null;
  }
}
