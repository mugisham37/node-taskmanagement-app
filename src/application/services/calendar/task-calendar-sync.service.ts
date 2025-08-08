import {
  CalendarEvent,
  EventType,
  CreateCalendarEventProps,
} from '../entities/calendar-event.entity';
import { CalendarEventDomainService } from './calendar-event-domain.service';
import { UserId } from '../../shared/value-objects/user-id.vo';
import { TaskId } from '../../shared/value-objects/task-id.vo';
import { ProjectId } from '../../shared/value-objects/project-id.vo';
import { WorkspaceId } from '../../shared/value-objects/workspace-id.vo';
import { DomainService } from '../../shared/services/domain-service';

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  startDate?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  assigneeId?: string;
  projectId?: string;
  workspaceId?: string;
  estimatedHours?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  workspaceId: string;
  ownerId: string;
}

export interface TaskCalendarSyncOptions {
  createEventsForTasks: boolean;
  createEventsForDeadlines: boolean;
  createEventsForMeetings: boolean;
  autoScheduleWorkSessions: boolean;
  workingHours: {
    start: number; // 24-hour format
    end: number;
    days: number[]; // 0-6, Sunday-Saturday
  };
  defaultEventDuration: number; // minutes
  reminderMinutes: number[];
}

export interface WorkSession {
  taskId: string;
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  type: 'focused_work' | 'review' | 'planning';
}

export interface CapacityPlanningResult {
  availableHours: number;
  scheduledHours: number;
  utilizationRate: number;
  overcommittedHours: number;
  suggestedAdjustments: string[];
}

export class TaskCalendarSyncService extends DomainService {
  constructor(
    private readonly calendarEventDomainService: CalendarEventDomainService
  ) {
    super('TaskCalendarSyncService');
  }

  /**
   * Sync a task with calendar events
   */
  async syncTaskToCalendar(
    task: Task,
    userId: string,
    options: TaskCalendarSyncOptions
  ): Promise<{ events: CalendarEvent[]; warnings: string[] }> {
    const events: CalendarEvent[] = [];
    const warnings: string[] = [];

    try {
      // Create deadline event if task has due date
      if (task.dueDate && options.createEventsForDeadlines) {
        const deadlineEvent = await this.createDeadlineEvent(
          task,
          userId,
          options
        );
        if (deadlineEvent) {
          events.push(deadlineEvent);
        }
      }

      // Create work session events if auto-scheduling is enabled
      if (
        options.autoScheduleWorkSessions &&
        task.estimatedHours &&
        task.status !== 'completed'
      ) {
        const workSessions = await this.scheduleWorkSessions(
          task,
          userId,
          options
        );
        for (const session of workSessions) {
          const sessionEvent = await this.createWorkSessionEvent(
            task,
            session,
            userId,
            options
          );
          if (sessionEvent) {
            events.push(sessionEvent);
          }
        }
      }

      // Create task event for high-priority tasks
      if (task.priority === 'urgent' && options.createEventsForTasks) {
        const taskEvent = await this.createTaskEvent(task, userId, options);
        if (taskEvent) {
          events.push(taskEvent);
        }
      }

      return { events, warnings };
    } catch (error) {
      warnings.push(
        `Failed to sync task ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return { events, warnings };
    }
  }

  /**
   * Create a deadline event for a task
   */
  private async createDeadlineEvent(
    task: Task,
    userId: string,
    options: TaskCalendarSyncOptions
  ): Promise<CalendarEvent | null> {
    if (!task.dueDate) {
      return null;
    }

    // Check if deadline event already exists
    const existingEvents =
      await this.calendarEventDomainService.findCalendarEvents({
        userId: UserId.create(userId),
        taskId: TaskId.create(task.id),
        type: EventType.DEADLINE,
      });

    if (existingEvents.data.length > 0) {
      // Update existing event if task was modified
      const existingEvent = existingEvents.data[0];
      if (task.updatedAt > existingEvent.updatedAt) {
        const { event } =
          await this.calendarEventDomainService.updateCalendarEvent(
            existingEvent.id,
            {
              title: `Deadline: ${task.title}`,
              description: this.buildTaskDescription(task),
              startDate: task.dueDate,
              allDay: true,
            }
          );
        return event;
      }
      return existingEvent;
    }

    // Create new deadline event
    const eventProps: CreateCalendarEventProps = {
      title: `Deadline: ${task.title}`,
      description: this.buildTaskDescription(task),
      type: EventType.DEADLINE,
      startDate: task.dueDate,
      allDay: true,
      color: this.getColorForPriority(task.priority),
      userId,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      taskId: task.id,
      reminders: options.reminderMinutes.map(minutes => ({
        minutesBefore: minutes,
        method: 'notification' as const,
      })),
      metadata: {
        taskPriority: task.priority,
        taskStatus: task.status,
        syncedFromTask: true,
      },
    };

    const { event } =
      await this.calendarEventDomainService.createCalendarEvent(eventProps);
    return event;
  }

  /**
   * Create a general task event
   */
  private async createTaskEvent(
    task: Task,
    userId: string,
    options: TaskCalendarSyncOptions
  ): Promise<CalendarEvent | null> {
    // Check if task event already exists
    const existingEvents =
      await this.calendarEventDomainService.findCalendarEvents({
        userId: UserId.create(userId),
        taskId: TaskId.create(task.id),
        type: EventType.TASK,
      });

    if (existingEvents.data.length > 0) {
      return existingEvents.data[0];
    }

    const startDate = task.startDate || new Date();
    const endDate = new Date(
      startDate.getTime() + options.defaultEventDuration * 60 * 1000
    );

    const eventProps: CreateCalendarEventProps = {
      title: task.title,
      description: this.buildTaskDescription(task),
      type: EventType.TASK,
      startDate,
      endDate,
      color: this.getColorForPriority(task.priority),
      userId,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      taskId: task.id,
      reminders: options.reminderMinutes.map(minutes => ({
        minutesBefore: minutes,
        method: 'notification' as const,
      })),
      metadata: {
        taskPriority: task.priority,
        taskStatus: task.status,
        syncedFromTask: true,
      },
    };

    const { event } =
      await this.calendarEventDomainService.createCalendarEvent(eventProps);
    return event;
  }

  /**
   * Schedule work sessions for a task
   */
  async scheduleWorkSessions(
    task: Task,
    userId: string,
    options: TaskCalendarSyncOptions
  ): Promise<WorkSession[]> {
    if (!task.estimatedHours || task.estimatedHours <= 0) {
      return [];
    }

    const sessions: WorkSession[] = [];
    const totalMinutes = task.estimatedHours * 60;
    const sessionDuration = Math.min(120, totalMinutes); // Max 2 hours per session
    const numberOfSessions = Math.ceil(totalMinutes / sessionDuration);

    // Find available time slots
    const startDate = task.startDate || new Date();
    const endDate =
      task.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 1 week

    const availableSlots =
      await this.calendarEventDomainService.findOptimalTimeSlots(
        UserId.create(userId),
        sessionDuration,
        startDate,
        endDate,
        options.workingHours
      );

    // Create work sessions
    for (
      let i = 0;
      i < Math.min(numberOfSessions, availableSlots.length);
      i++
    ) {
      const slot = availableSlots[i];
      const sessionType = this.determineSessionType(i, numberOfSessions);

      sessions.push({
        taskId: task.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: sessionDuration,
        type: sessionType,
      });
    }

    return sessions;
  }

  /**
   * Create a work session event
   */
  private async createWorkSessionEvent(
    task: Task,
    session: WorkSession,
    userId: string,
    options: TaskCalendarSyncOptions
  ): Promise<CalendarEvent | null> {
    const sessionTitle = `Work Session: ${task.title}`;
    const sessionDescription = `${this.getSessionTypeDescription(session.type)}\n\n${this.buildTaskDescription(task)}`;

    const eventProps: CreateCalendarEventProps = {
      title: sessionTitle,
      description: sessionDescription,
      type: EventType.TASK,
      startDate: session.startTime,
      endDate: session.endTime,
      color: this.getColorForSessionType(session.type),
      userId,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      taskId: task.id,
      reminders: [
        { minutesBefore: 15, method: 'notification' },
        { minutesBefore: 5, method: 'notification' },
      ],
      metadata: {
        taskPriority: task.priority,
        taskStatus: task.status,
        sessionType: session.type,
        sessionDuration: session.duration,
        syncedFromTask: true,
        isWorkSession: true,
      },
    };

    const { event } =
      await this.calendarEventDomainService.createCalendarEvent(eventProps);
    return event;
  }

  /**
   * Analyze calendar capacity for task planning
   */
  async analyzeCapacity(
    userId: string,
    startDate: Date,
    endDate: Date,
    workingHours: { start: number; end: number; days: number[] }
  ): Promise<CapacityPlanningResult> {
    // Calculate total available hours
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    const workingDaysCount = this.countWorkingDays(
      startDate,
      endDate,
      workingHours.days
    );
    const dailyWorkingHours = workingHours.end - workingHours.start;
    const availableHours = workingDaysCount * dailyWorkingHours;

    // Get existing calendar events
    const existingEvents =
      await this.calendarEventDomainService.findCalendarEvents({
        userId: UserId.create(userId),
        startDate,
        endDate,
      });

    // Calculate scheduled hours
    let scheduledHours = 0;
    for (const event of existingEvents.data) {
      const duration = event.getDuration() / 60; // Convert minutes to hours
      scheduledHours += duration;
    }

    const utilizationRate = (scheduledHours / availableHours) * 100;
    const overcommittedHours = Math.max(0, scheduledHours - availableHours);

    const suggestedAdjustments: string[] = [];
    if (utilizationRate > 90) {
      suggestedAdjustments.push(
        'Calendar is nearly full. Consider extending deadlines or reducing scope.'
      );
    }
    if (overcommittedHours > 0) {
      suggestedAdjustments.push(
        `Overcommitted by ${overcommittedHours.toFixed(1)} hours. Reschedule some tasks.`
      );
    }
    if (utilizationRate < 50) {
      suggestedAdjustments.push(
        'Low utilization. Consider taking on additional tasks or projects.'
      );
    }

    return {
      availableHours,
      scheduledHours,
      utilizationRate,
      overcommittedHours,
      suggestedAdjustments,
    };
  }

  /**
   * Create time blocking for focused work
   */
  async createTimeBlocks(
    userId: string,
    tasks: Task[],
    startDate: Date,
    endDate: Date,
    options: TaskCalendarSyncOptions
  ): Promise<CalendarEvent[]> {
    const timeBlocks: CalendarEvent[] = [];

    // Group tasks by priority and project
    const highPriorityTasks = tasks.filter(
      t => t.priority === 'urgent' || t.priority === 'high'
    );
    const projectGroups = this.groupTasksByProject(highPriorityTasks);

    // Create focused work blocks for each project
    for (const [projectId, projectTasks] of projectGroups) {
      const totalHours = projectTasks.reduce(
        (sum, task) => sum + (task.estimatedHours || 2),
        0
      );
      const blockDuration = Math.min(240, totalHours * 60); // Max 4 hours per block

      // Find optimal time slot for this project block
      const optimalSlots =
        await this.calendarEventDomainService.findOptimalTimeSlots(
          UserId.create(userId),
          blockDuration,
          startDate,
          endDate,
          options.workingHours
        );

      if (optimalSlots.length > 0) {
        const slot = optimalSlots[0];
        const projectName = projectTasks[0].projectId
          ? `Project ${projectTasks[0].projectId}`
          : 'General Tasks';

        const blockEvent = await this.createTimeBlockEvent(
          userId,
          projectName,
          projectTasks,
          slot.startTime,
          slot.endTime,
          options
        );

        if (blockEvent) {
          timeBlocks.push(blockEvent);
        }
      }
    }

    return timeBlocks;
  }

  /**
   * Create a time block event
   */
  private async createTimeBlockEvent(
    userId: string,
    blockTitle: string,
    tasks: Task[],
    startTime: Date,
    endTime: Date,
    options: TaskCalendarSyncOptions
  ): Promise<CalendarEvent | null> {
    const taskTitles = tasks.map(t => `• ${t.title}`).join('\n');
    const description = `Focused work session for:\n\n${taskTitles}`;

    const eventProps: CreateCalendarEventProps = {
      title: `🎯 Focus Block: ${blockTitle}`,
      description,
      type: EventType.OTHER,
      startDate: startTime,
      endDate: endTime,
      color: '#FF6B6B', // Red for focus blocks
      userId,
      workspaceId: tasks[0]?.workspaceId,
      projectId: tasks[0]?.projectId,
      reminders: [
        { minutesBefore: 15, method: 'notification' },
        { minutesBefore: 5, method: 'notification' },
      ],
      metadata: {
        isTimeBlock: true,
        taskIds: tasks.map(t => t.id),
        blockType: 'focused_work',
        syncedFromTasks: true,
      },
    };

    const { event } =
      await this.calendarEventDomainService.createCalendarEvent(eventProps);
    return event;
  }

  // Helper methods
  private buildTaskDescription(task: Task): string {
    let description = task.description || '';

    description += `\n\nTask Details:`;
    description += `\nPriority: ${task.priority}`;
    description += `\nStatus: ${task.status}`;

    if (task.estimatedHours) {
      description += `\nEstimated Hours: ${task.estimatedHours}`;
    }

    if (task.tags.length > 0) {
      description += `\nTags: ${task.tags.join(', ')}`;
    }

    return description.trim();
  }

  private getColorForPriority(priority: string): string {
    switch (priority) {
      case 'urgent':
        return '#FF4444'; // Red
      case 'high':
        return '#FF8800'; // Orange
      case 'medium':
        return '#4CAF50'; // Green
      case 'low':
        return '#2196F3'; // Blue
      default:
        return '#9E9E9E'; // Gray
    }
  }

  private getColorForSessionType(sessionType: string): string {
    switch (sessionType) {
      case 'focused_work':
        return '#8E24AA'; // Purple
      case 'review':
        return '#00ACC1'; // Cyan
      case 'planning':
        return '#FB8C00'; // Orange
      default:
        return '#4CAF50'; // Green
    }
  }

  private determineSessionType(
    sessionIndex: number,
    totalSessions: number
  ): 'focused_work' | 'review' | 'planning' {
    if (sessionIndex === 0) {
      return 'planning';
    } else if (sessionIndex === totalSessions - 1) {
      return 'review';
    } else {
      return 'focused_work';
    }
  }

  private getSessionTypeDescription(sessionType: string): string {
    switch (sessionType) {
      case 'focused_work':
        return '🎯 Focused work session - Deep work time with minimal distractions';
      case 'review':
        return '📋 Review session - Review progress and plan next steps';
      case 'planning':
        return '📝 Planning session - Break down tasks and plan approach';
      default:
        return '💼 Work session';
    }
  }

  private countWorkingDays(
    startDate: Date,
    endDate: Date,
    workingDays: number[]
  ): number {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      if (workingDays.includes(current.getDay())) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  private groupTasksByProject(tasks: Task[]): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();

    for (const task of tasks) {
      const projectId = task.projectId || 'no-project';
      if (!groups.has(projectId)) {
        groups.set(projectId, []);
      }
      groups.get(projectId)!.push(task);
    }

    return groups;
  }
}
