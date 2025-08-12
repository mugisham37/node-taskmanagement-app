import { BaseEntity } from './base-entity';
import { CalendarEventId } from '../value-objects/calendar-event-id';
import { ProjectId } from '../value-objects/project-id';
import { UserId } from '../value-objects/user-id';
import { RecurrenceRule } from '../value-objects/recurrence-rule';
import { DomainError } from '../../shared/errors/domain-error';

export enum CalendarEventStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  DRAFT = 'draft'
}

export interface CalendarEventAttendee {
  userId: string;
  status: 'pending' | 'accepted' | 'declined' | 'tentative';
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
  startTime: Date;
  endTime: Date;
  projectId?: string | undefined;
  createdBy: string;
  attendees: CalendarEventAttendee[];
  location?: string | undefined;
  isAllDay: boolean;
  recurrenceRule?: string | undefined;
  reminders: CalendarEventReminder[];
  visibility: string;
}

export class CalendarEvent extends BaseEntity<CalendarEventId> {
  private _title: string;
  private _description?: string | undefined;
  private _startTime: Date;
  private _endTime: Date;
  private _projectId?: ProjectId | undefined;
  private _createdBy: UserId;
  private _attendees: CalendarEventAttendee[];
  private _location?: string | undefined;
  private _allDay: boolean;
  private _recurrenceRule?: RecurrenceRule | undefined;
  private _reminders: CalendarEventReminder[];
  private _visibility: string;
  private _status: CalendarEventStatus;

  constructor(
    id: CalendarEventId,
    props: CalendarEventProps,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt);
    this._title = props.title;
    this._description = props.description;
    this._startTime = props.startTime;
    this._endTime = props.endTime;
    this._projectId = props.projectId ? new ProjectId(props.projectId) : undefined;
    this._createdBy = new UserId(props.createdBy);
    this._attendees = props.attendees || [];
    this._location = props.location;
    this._allDay = props.isAllDay;
    this._recurrenceRule = props.recurrenceRule ? RecurrenceRule.create(JSON.parse(props.recurrenceRule)) : undefined;
    this._reminders = props.reminders || [];
    this._visibility = props.visibility;
    this._status = CalendarEventStatus.ACTIVE;
    this.validate();
  }

  // Getters
  get title(): string { return this._title; }
  get description(): string | undefined { return this._description; }
  get startTime(): Date { return this._startTime; }
  get endTime(): Date { return this._endTime; }
  get projectId(): ProjectId | undefined { return this._projectId; }
  get createdBy(): UserId { return this._createdBy; }
  get attendees(): CalendarEventAttendee[] { return this._attendees; }
  get location(): string | undefined { return this._location; }
  get allDay(): boolean { return this._allDay; }
  get isAllDay(): boolean { return this._allDay; }
  get recurrenceRule(): RecurrenceRule | undefined { return this._recurrenceRule; }
  get reminders(): CalendarEventReminder[] { return this._reminders; }
  get visibility(): string { return this._visibility; }
  get status(): CalendarEventStatus { return this._status; }

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
      status: 'pending'
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

  static create(props: CalendarEventProps): CalendarEvent {
    const id = CalendarEventId.create();
    return new CalendarEvent(id, props);
  }
}
