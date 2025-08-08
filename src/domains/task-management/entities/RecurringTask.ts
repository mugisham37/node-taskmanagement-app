import { BaseEntity } from '../../shared/entities/BaseEntity';
import { DomainEvent } from '../../shared/events/DomainEvent';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { ProjectId } from '../value-objects/ProjectId';
import { UserId } from '../../authentication/value-objects/UserId';
import { TaskId } from '../value-objects/TaskId';
import { Priority, PriorityEnum } from '../value-objects/Priority';
import { cuid } from '@paralleldrive/cuid2';

export enum RecurrencePattern {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export interface TaskTemplateData {
  title: string;
  description?: string;
  priority: PriorityEnum;
  estimatedHours?: number;
  storyPoints?: number;
  tags: string[];
  labels: string[];
  assigneeId?: UserId;
  customFields: Record<string, any>;
}

export interface RecurringTaskProps {
  id: string;
  workspaceId: WorkspaceId;
  projectId?: ProjectId;
  pattern: RecurrencePattern;
  interval: number; // Every N days/weeks/months/years
  daysOfWeek: number[]; // 0-6, Sunday to Saturday (for weekly)
  daysOfMonth: number[]; // 1-31 (for monthly)
  monthsOfYear: number[]; // 1-12 (for yearly)
  startDate: Date;
  endDate?: Date;
  nextDueDate?: Date;
  taskTemplate: TaskTemplateData;
  isActive: boolean;
  createdBy: UserId;
  createdAt: Date;
  updatedAt: Date;
}

// Domain Events
export class RecurringTaskCreatedEvent extends DomainEvent {
  constructor(
    public readonly recurringTaskId: string,
    public readonly workspaceId: WorkspaceId,
    public readonly pattern: RecurrencePattern,
    public readonly createdBy: UserId
  ) {
    super('RecurringTaskCreated', {
      recurringTaskId,
      workspaceId: workspaceId.value,
      pattern,
      createdBy: createdBy.value,
    });
  }
}

export class RecurringTaskUpdatedEvent extends DomainEvent {
  constructor(
    public readonly recurringTaskId: string,
    public readonly changes: Partial<RecurringTaskProps>
  ) {
    super('RecurringTaskUpdated', {
      recurringTaskId,
      changes,
    });
  }
}

export class RecurringTaskInstanceCreatedEvent extends DomainEvent {
  constructor(
    public readonly recurringTaskId: string,
    public readonly taskId: TaskId,
    public readonly dueDate: Date
  ) {
    super('RecurringTaskInstanceCreated', {
      recurringTaskId,
      taskId: taskId.value,
      dueDate: dueDate.toISOString(),
    });
  }
}

export class RecurringTaskDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly recurringTaskId: string,
    public readonly deactivatedBy: UserId,
    public readonly reason?: string
  ) {
    super('RecurringTaskDeactivated', {
      recurringTaskId,
      deactivatedBy: deactivatedBy.value,
      reason,
    });
  }
}

export class RecurringTask extends BaseEntity<RecurringTaskProps> {
  private constructor(props: RecurringTaskProps) {
    super(props);
  }

  public static create(
    props: Omit<
      RecurringTaskProps,
      'id' | 'nextDueDate' | 'createdAt' | 'updatedAt'
    >
  ): RecurringTask {
    // Validate recurrence pattern and related fields
    RecurringTask.validateRecurrencePattern(props.pattern, props);

    // Validate task template
    if (
      !props.taskTemplate.title ||
      props.taskTemplate.title.trim().length === 0
    ) {
      throw new Error('Recurring task template must have a title');
    }

    // Validate dates
    if (props.endDate && props.startDate >= props.endDate) {
      throw new Error('Start date must be before end date');
    }

    // Validate interval
    if (props.interval <= 0) {
      throw new Error('Interval must be greater than 0');
    }

    const recurringTask = new RecurringTask({
      ...props,
      id: cuid(),
      taskTemplate: {
        ...props.taskTemplate,
        title: props.taskTemplate.title.trim(),
        priority: props.taskTemplate.priority || PriorityEnum.MEDIUM,
        tags: props.taskTemplate.tags || [],
        labels: props.taskTemplate.labels || [],
        customFields: props.taskTemplate.customFields || {},
      },
      nextDueDate: RecurringTask.calculateNextDueDate(
        props.startDate,
        props.pattern,
        props
      ),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    recurringTask.addDomainEvent(
      new RecurringTaskCreatedEvent(
        recurringTask.id,
        recurringTask.workspaceId,
        recurringTask.pattern,
        recurringTask.createdBy
      )
    );

    return recurringTask;
  }

  public static fromPersistence(props: RecurringTaskProps): RecurringTask {
    return new RecurringTask(props);
  }

  private static validateRecurrencePattern(
    pattern: RecurrencePattern,
    props: Partial<RecurringTaskProps>
  ): void {
    switch (pattern) {
      case RecurrencePattern.WEEKLY:
        if (!props.daysOfWeek || props.daysOfWeek.length === 0) {
          throw new Error(
            'Weekly recurrence requires at least one day of week'
          );
        }
        if (props.daysOfWeek.some(day => day < 0 || day > 6)) {
          throw new Error(
            'Days of week must be between 0 (Sunday) and 6 (Saturday)'
          );
        }
        break;

      case RecurrencePattern.MONTHLY:
        if (!props.daysOfMonth || props.daysOfMonth.length === 0) {
          throw new Error(
            'Monthly recurrence requires at least one day of month'
          );
        }
        if (props.daysOfMonth.some(day => day < 1 || day > 31)) {
          throw new Error('Days of month must be between 1 and 31');
        }
        break;

      case RecurrencePattern.YEARLY:
        if (!props.monthsOfYear || props.monthsOfYear.length === 0) {
          throw new Error('Yearly recurrence requires at least one month');
        }
        if (props.monthsOfYear.some(month => month < 1 || month > 12)) {
          throw new Error('Months of year must be between 1 and 12');
        }
        break;

      case RecurrencePattern.DAILY:
        // No additional validation needed for daily recurrence
        break;

      default:
        throw new Error(`Invalid recurrence pattern: ${pattern}`);
    }
  }

  private static calculateNextDueDate(
    startDate: Date,
    pattern: RecurrencePattern,
    props: Partial<RecurringTaskProps>
  ): Date {
    const nextDate = new Date(startDate);

    switch (pattern) {
      case RecurrencePattern.DAILY:
        nextDate.setDate(nextDate.getDate() + (props.interval || 1));
        break;

      case RecurrencePattern.WEEKLY:
        // Find the next occurrence of any specified day of week
        const daysOfWeek = props.daysOfWeek || [];
        const currentDay = nextDate.getDay();
        let daysToAdd = 7 * (props.interval || 1);

        // Find the next day of week
        for (let i = 0; i < 7; i++) {
          const checkDay = (currentDay + i) % 7;
          if (daysOfWeek.includes(checkDay)) {
            daysToAdd = i === 0 ? 7 * (props.interval || 1) : i;
            break;
          }
        }

        nextDate.setDate(nextDate.getDate() + daysToAdd);
        break;

      case RecurrencePattern.MONTHLY:
        const daysOfMonth = props.daysOfMonth || [];
        nextDate.setMonth(nextDate.getMonth() + (props.interval || 1));

        // Set to the first specified day of month
        if (daysOfMonth.length > 0) {
          nextDate.setDate(
            Math.min(
              daysOfMonth[0],
              new Date(
                nextDate.getFullYear(),
                nextDate.getMonth() + 1,
                0
              ).getDate()
            )
          );
        }
        break;

      case RecurrencePattern.YEARLY:
        const monthsOfYear = props.monthsOfYear || [];
        nextDate.setFullYear(nextDate.getFullYear() + (props.interval || 1));

        // Set to the first specified month
        if (monthsOfYear.length > 0) {
          nextDate.setMonth(monthsOfYear[0] - 1); // Month is 0-indexed
        }
        break;
    }

    return nextDate;
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get workspaceId(): WorkspaceId {
    return this.props.workspaceId;
  }

  get projectId(): ProjectId | undefined {
    return this.props.projectId;
  }

  get pattern(): RecurrencePattern {
    return this.props.pattern;
  }

  get interval(): number {
    return this.props.interval;
  }

  get daysOfWeek(): number[] {
    return [...this.props.daysOfWeek];
  }

  get daysOfMonth(): number[] {
    return [...this.props.daysOfMonth];
  }

  get monthsOfYear(): number[] {
    return [...this.props.monthsOfYear];
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date | undefined {
    return this.props.endDate;
  }

  get nextDueDate(): Date | undefined {
    return this.props.nextDueDate;
  }

  get taskTemplate(): TaskTemplateData {
    return { ...this.props.taskTemplate };
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdBy(): UserId {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business methods
  public updateTaskTemplate(template: Partial<TaskTemplateData>): void {
    if (template.title !== undefined) {
      if (!template.title || template.title.trim().length === 0) {
        throw new Error('Task template title cannot be empty');
      }
      template.title = template.title.trim();
    }

    this.props.taskTemplate = {
      ...this.props.taskTemplate,
      ...template,
    };
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new RecurringTaskUpdatedEvent(this.id, {
        taskTemplate: this.props.taskTemplate,
      })
    );
  }

  public updateRecurrencePattern(
    pattern: RecurrencePattern,
    interval: number,
    options: {
      daysOfWeek?: number[];
      daysOfMonth?: number[];
      monthsOfYear?: number[];
    } = {}
  ): void {
    // Validate new pattern
    RecurringTask.validateRecurrencePattern(pattern, {
      interval,
      ...options,
    });

    if (interval <= 0) {
      throw new Error('Interval must be greater than 0');
    }

    this.props.pattern = pattern;
    this.props.interval = interval;
    this.props.daysOfWeek = options.daysOfWeek || [];
    this.props.daysOfMonth = options.daysOfMonth || [];
    this.props.monthsOfYear = options.monthsOfYear || [];

    // Recalculate next due date
    this.props.nextDueDate = RecurringTask.calculateNextDueDate(
      this.props.nextDueDate || this.props.startDate,
      pattern,
      this.props
    );

    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new RecurringTaskUpdatedEvent(this.id, {
        pattern,
        interval,
        daysOfWeek: this.props.daysOfWeek,
        daysOfMonth: this.props.daysOfMonth,
        monthsOfYear: this.props.monthsOfYear,
        nextDueDate: this.props.nextDueDate,
      })
    );
  }

  public updateEndDate(endDate?: Date): void {
    if (endDate && endDate <= this.props.startDate) {
      throw new Error('End date must be after start date');
    }

    this.props.endDate = endDate;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new RecurringTaskUpdatedEvent(this.id, { endDate }));
  }

  public createNextInstance(): TaskId {
    if (!this.props.isActive) {
      throw new Error('Cannot create instance from inactive recurring task');
    }

    if (!this.props.nextDueDate) {
      throw new Error('No next due date calculated');
    }

    if (this.props.endDate && this.props.nextDueDate > this.props.endDate) {
      throw new Error('Next due date is beyond end date');
    }

    const taskId = TaskId.generate();
    const currentDueDate = this.props.nextDueDate;

    // Calculate next due date for future instances
    this.props.nextDueDate = RecurringTask.calculateNextDueDate(
      currentDueDate,
      this.props.pattern,
      this.props
    );

    // If next due date exceeds end date, deactivate
    if (this.props.endDate && this.props.nextDueDate > this.props.endDate) {
      this.props.isActive = false;
      this.props.nextDueDate = undefined;
    }

    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new RecurringTaskInstanceCreatedEvent(this.id, taskId, currentDueDate)
    );

    return taskId;
  }

  public deactivate(deactivatedBy: UserId, reason?: string): void {
    if (!this.props.isActive) {
      throw new Error('Recurring task is already inactive');
    }

    this.props.isActive = false;
    this.props.nextDueDate = undefined;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new RecurringTaskDeactivatedEvent(this.id, deactivatedBy, reason)
    );
  }

  public activate(): void {
    if (this.props.isActive) {
      throw new Error('Recurring task is already active');
    }

    // Recalculate next due date from now
    const now = new Date();
    this.props.nextDueDate = RecurringTask.calculateNextDueDate(
      now,
      this.props.pattern,
      this.props
    );

    this.props.isActive = true;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new RecurringTaskUpdatedEvent(this.id, {
        isActive: true,
        nextDueDate: this.props.nextDueDate,
      })
    );
  }

  // Query methods
  public isDue(date: Date = new Date()): boolean {
    if (!this.props.isActive || !this.props.nextDueDate) {
      return false;
    }

    return date >= this.props.nextDueDate;
  }

  public isExpired(date: Date = new Date()): boolean {
    return !!(this.props.endDate && date > this.props.endDate);
  }

  public canCreateInstance(date: Date = new Date()): boolean {
    return this.props.isActive && this.isDue(date) && !this.isExpired(date);
  }

  public getNextInstanceDate(): Date | null {
    return this.props.nextDueDate || null;
  }

  public getRecurrenceDescription(): string {
    const intervalText =
      this.props.interval === 1 ? '' : `every ${this.props.interval} `;

    switch (this.props.pattern) {
      case RecurrencePattern.DAILY:
        return `${intervalText}day${this.props.interval === 1 ? '' : 's'}`;

      case RecurrencePattern.WEEKLY:
        const dayNames = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];
        const days = this.props.daysOfWeek.map(d => dayNames[d]).join(', ');
        return `${intervalText}week${this.props.interval === 1 ? '' : 's'} on ${days}`;

      case RecurrencePattern.MONTHLY:
        const monthDays = this.props.daysOfMonth.join(', ');
        return `${intervalText}month${this.props.interval === 1 ? '' : 's'} on day${this.props.daysOfMonth.length === 1 ? '' : 's'} ${monthDays}`;

      case RecurrencePattern.YEARLY:
        const monthNames = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ];
        const months = this.props.monthsOfYear
          .map(m => monthNames[m - 1])
          .join(', ');
        return `${intervalText}year${this.props.interval === 1 ? '' : 's'} in ${months}`;

      default:
        return 'Unknown pattern';
    }
  }

  public isCreatedBy(userId: UserId): boolean {
    return this.props.createdBy.equals(userId);
  }
}
