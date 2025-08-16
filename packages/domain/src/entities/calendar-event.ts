import { DomainError } from '@taskmanagement/core';
import { CalendarEventId } from '../value-objects/calendar-event-id';
import { ProjectId } from '../value-objects/project-id';
import { RecurrenceRule } from '../value-objects/recurrence-rule';
import { UserId } from '../value-objects/user-id';
import { BaseEntity } from './base-entity';

export enum CalendarEventStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  DRAFT = 'draft'
}

export enum EventType {
  MEETING = 'meeting',
  TASK_DEADLINE = 'task_deadline',
  PROJECT_MILESTONE = 'project_milestone',
  REMINDER = 'reminder',
  PERSONAL = 'personal',
  TEAM_EVENT = 'team_event'
}

export enum AttendeeStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  TENTATIVE = 'tentative'
}

export interface CalendarEventAttendee {
  userId: string;
  status: AttendeeStatus;
}

export interface CalendarEventReminder {
  id: string;
  minutesBefore: number;
  method: 'notification' | 'email' | 'sms';
  sent: boolean;
  sentAt?: Date;
}

export interface CalendarEventProps {
  title: string;
  description?: string | undefined;
  type: EventType;
  startDate: Date;
  startTime: Date;
  endDate?: Date | undefined;
  endTime: Date;
  allDay?: boolean;
  location?: string | undefined;
  url?: string | undefined;
  color?: string | undefined;
  userId: string;
  workspaceId?: string | undefined;
  projectId?: string | undefined;
  taskId?: string | undefined;
  createdBy: string;
  attendees: CalendarEventAttendee[];
  isAllDay: boolean;
  recurrenceRule?: string | undefined;
  isRecurring?: boolean;
  reminders: CalendarEventReminder[];
  visibility: string;
  metadata?: Record<string, any>;
}

export class CalendarEvent extends BaseEntity<CalendarEventId> {
  private _title: string;
  private _description?: string | undefined;
  private _type: EventType;
  private _startTime: Date;
  private _endTime: Date;
  private _projectId?: ProjectId | undefined;
  private _taskId?: string | undefined;
  private _workspaceId?: string | undefined;
  private _createdBy: UserId;
  private _attendees: CalendarEventAttendee[];
  private _location?: string | undefined;
  private _url?: string | undefined;
  private _color?: string | undefined;
  private _allDay: boolean;
  private _recurrenceRule?: RecurrenceRule | undefined;
  private _isRecurring: boolean;
  private _reminders: CalendarEventReminder[];
  private _visibility: string;
  private _status: CalendarEventStatus;
  private _metadata?: Record<string, any>;

  constructor(
    id: CalendarEventId,
    props: CalendarEventProps,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt);
    this._title = props.title;
    this._description = props.description;
    this._type = props.type;
    this._startTime = props.startTime || props.startDate;
    this._endTime = props.endTime || props.endDate || props.startDate;
    this._projectId = props.projectId ? new ProjectId(props.projectId) : undefined;
    this._taskId = props.taskId;
    this._workspaceId = props.workspaceId;
    this._createdBy = new UserId(props.createdBy);
    this._attendees = props.attendees || [];
    this._location = props.location;
    this._url = props.url;
    this._color = props.color;
    this._allDay = props.isAllDay || props.allDay || false;
    this._recurrenceRule = props.recurrenceRule ? RecurrenceRule.create(JSON.parse(props.recurrenceRule)) : undefined;
    this._isRecurring = props.isRecurring || !!this._recurrenceRule;
    this._reminders = props.reminders || [];
    this._visibility = props.visibility;
    this._status = CalendarEventStatus.ACTIVE;
    if (props.metadata) {
      this._metadata = props.metadata;
    }
    this.validate();
  }

  // Getters
  get title(): string { return this._title; }
  get description(): string | undefined { return this._description; }
  get type(): EventType { return this._type; }
  get startTime(): Date { return this._startTime; }
  get endTime(): Date { return this._endTime; }
  get startDate(): Date { return this._startTime; } // Alias for compatibility
  get endDate(): Date { return this._endTime; } // Alias for compatibility
  get projectId(): ProjectId | undefined { return this._projectId; }
  get taskId(): string | undefined { return this._taskId; }
  get workspaceId(): string | undefined { return this._workspaceId; }
  get createdBy(): UserId { return this._createdBy; }
  get userId(): string { return this._createdBy.value; } // Alias for compatibility
  get attendees(): CalendarEventAttendee[] { return this._attendees; }
  get location(): string | undefined { return this._location; }
  get url(): string | undefined { return this._url; }
  get color(): string | undefined { return this._color; }
  get allDay(): boolean { return this._allDay; }
  get isAllDay(): boolean { return this._allDay; }
  get recurrenceRule(): RecurrenceRule | undefined { return this._recurrenceRule; }
  get isRecurring(): boolean { return this._isRecurring; }
  get reminders(): CalendarEventReminder[] { return this._reminders; }
  get visibility(): string { return this._visibility; }
  get status(): CalendarEventStatus { return this._status; }
  get metadata(): Record<string, any> | undefined { return this._metadata; }

  protected validate(): void {
    if (!this._title || this._title.trim().length === 0) {
      throw new DomainError('Event title is required');
    }
    
    if (this._startTime >= this._endTime) {
      throw new DomainError('Start time must be before end time');
    }
  }

  getValidationErrors(): string[] {
    const errors: string[] = [];
    try {
      this.validate();
    } catch (error) {
      if (error instanceof DomainError) {
        errors.push(error.message);
      }
    }
    return errors;
  }

  // Business methods
  updateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new DomainError('Event title cannot be empty');
    }
    this._title = title.trim();
    this.markAsUpdated();
  }

  updateDescription(description?: string): void {
    this._description = description;
    this.markAsUpdated();
  }

  updateTimeRange(startTime: Date, endTime: Date): void {
    if (startTime >= endTime) {
      throw new DomainError('Start time must be before end time');
    }
    this._startTime = startTime;
    this._endTime = endTime;
    this.markAsUpdated();
  }

  updateLocation(location?: string): void {
    this._location = location;
    this.markAsUpdated();
  }

  updateAllDay(allDay: boolean): void {
    this._allDay = allDay;
    this.markAsUpdated();
  }

  updateRecurrenceRule(recurrenceRule?: RecurrenceRule): void {
    this._recurrenceRule = recurrenceRule;
    this.markAsUpdated();
  }

  updateReminders(reminders: CalendarEventReminder[]): void {
    this._reminders = reminders;
    this.markAsUpdated();
  }

  updateVisibility(visibility: string): void {
    this._visibility = visibility;
    this.markAsUpdated();
  }

  addAttendee(userId: UserId): void {
    const existingAttendee = this._attendees.find(a => a.userId === userId.value);
    if (existingAttendee) {
      throw new DomainError('User is already an attendee');
    }
    
    this._attendees.push({
      userId: userId.value,
      status: AttendeeStatus.PENDING
    });
    this.markAsUpdated();
  }

  removeAttendee(userId: UserId): void {
    const index = this._attendees.findIndex(a => a.userId === userId.value);
    if (index === -1) {
      throw new DomainError('User is not an attendee');
    }
    
    this._attendees.splice(index, 1);
    this.markAsUpdated();
  }

  cancel(): void {
    this._status = CalendarEventStatus.CANCELLED;
    this.markAsUpdated();
  }

  // Additional methods required by domain service
  update(updates: Partial<CalendarEventProps>): void {
    if (updates.title !== undefined) {
      this.updateTitle(updates.title);
    }
    if (updates.description !== undefined) {
      this.updateDescription(updates.description);
    }
    if (updates.startTime || updates.endTime) {
      const startTime = updates.startTime || this._startTime;
      const endTime = updates.endTime || this._endTime;
      this.updateTimeRange(startTime, endTime);
    }
    if (updates.location !== undefined) {
      this.updateLocation(updates.location);
    }
    if (updates.isAllDay !== undefined) {
      this.updateAllDay(updates.isAllDay);
    }
    if (updates.visibility !== undefined) {
      this.updateVisibility(updates.visibility);
    }
  }

  updateAttendeeStatus(userId: string, status: AttendeeStatus): void {
    const attendee = this._attendees.find(a => a.userId === userId);
    if (!attendee) {
      throw new DomainError('User is not an attendee');
    }
    attendee.status = status;
    this.markAsUpdated();
  }

  markReminderSent(reminderId: string): void {
    const reminder = this._reminders.find(r => r.id === reminderId);
    if (!reminder) {
      throw new DomainError('Reminder not found');
    }
    reminder.sent = true;
    reminder.sentAt = new Date();
    this.markAsUpdated();
  }

  getDuration(): number {
    return this._endTime.getTime() - this._startTime.getTime();
  }

  // Time-based utility methods
  isUpcoming(): boolean {
    const now = new Date();
    return this._startTime > now;
  }

  isPast(): boolean {
    const now = new Date();
    return this._endTime < now;
  }

  isHappening(): boolean {
    const now = new Date();
    return this._startTime <= now && this._endTime >= now;
  }

  // Scheduling conflict detection
  checkSchedulingConflict(otherEvent: CalendarEvent): boolean {
    if (this._allDay && otherEvent._allDay) {
      // For all-day events, check if dates overlap
      const thisStart = new Date(this._startTime.getFullYear(), this._startTime.getMonth(), this._startTime.getDate());
      const thisEnd = new Date(this._endTime.getFullYear(), this._endTime.getMonth(), this._endTime.getDate());
      const otherStart = new Date(otherEvent._startTime.getFullYear(), otherEvent._startTime.getMonth(), otherEvent._startTime.getDate());
      const otherEnd = new Date(otherEvent._endTime.getFullYear(), otherEvent._endTime.getMonth(), otherEvent._endTime.getDate());
      
      return thisStart <= otherEnd && thisEnd >= otherStart;
    }

    if (this._allDay || otherEvent._allDay) {
      // If one is all-day and the other is not, check if they're on the same day
      const thisStart = this._allDay ? 
        new Date(this._startTime.getFullYear(), this._startTime.getMonth(), this._startTime.getDate()) :
        this._startTime;
      const thisEnd = this._allDay ? 
        new Date(this._endTime.getFullYear(), this._endTime.getMonth(), this._endTime.getDate(), 23, 59, 59) :
        this._endTime;
      const otherStart = otherEvent._allDay ? 
        new Date(otherEvent._startTime.getFullYear(), otherEvent._startTime.getMonth(), otherEvent._startTime.getDate()) :
        otherEvent._startTime;
      const otherEnd = otherEvent._allDay ? 
        new Date(otherEvent._endTime.getFullYear(), otherEvent._endTime.getMonth(), otherEvent._endTime.getDate(), 23, 59, 59) :
        otherEvent._endTime;
      
      return thisStart <= otherEnd && thisEnd >= otherStart;
    }

    // For time-specific events, check for time overlap
    return this._startTime < otherEvent._endTime && this._endTime > otherEvent._startTime;
  }

  static create(props: CalendarEventProps): CalendarEvent {
    const id = CalendarEventId.create();
    return new CalendarEvent(id, props);
  }
}

