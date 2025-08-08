import { BaseEntity } from '../../shared/entities/base.entity';
import { CalendarEventId } from '../value-objects/calendar-event-id.vo';
import { EventTitle } from '../value-objects/event-title.vo';
import { EventDescription } from '../value-objects/event-description.vo';
import { EventDateTime } from '../value-objects/event-datetime.vo';
import { EventLocation } from '../value-objects/event-location.vo';
import { EventColor } from '../value-objects/event-color.vo';
import { RecurrenceRule } from '../value-objects/recurrence-rule.vo';
import { UserId } from '../../shared/value-objects/user-id.vo';
import { WorkspaceId } from '../../shared/value-objects/workspace-id.vo';
import { ProjectId } from '../../shared/value-objects/project-id.vo';
import { TaskId } from '../../shared/value-objects/task-id.vo';
import { TeamId } from '../../shared/value-objects/team-id.vo';
import { DomainEvent } from '../../shared/events/domain-event';
import { CalendarEventCreatedEvent } from '../events/calendar-event-created.event';
import { CalendarEventUpdatedEvent } from '../events/calendar-event-updated.event';
import { CalendarEventDeletedEvent } from '../events/calendar-event-deleted.event';

export enum EventType {
  TASK = 'task',
  MEETING = 'meeting',
  DEADLINE = 'deadline',
  OTHER = 'other',
}

export enum AttendeeStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  TENTATIVE = 'tentative',
}

export interface CalendarEventAttendee {
  userId: UserId;
  status: AttendeeStatus;
  responseAt?: Date;
}

export interface CalendarEventReminder {
  id: string;
  minutesBefore: number;
  method: 'notification' | 'email' | 'sms';
  sent: boolean;
  sentAt?: Date;
}

export interface CalendarEventProps {
  id: CalendarEventId;
  title: EventTitle;
  description?: EventDescription;
  type: EventType;
  startDate: EventDateTime;
  endDate?: EventDateTime;
  allDay: boolean;
  location?: EventLocation;
  url?: string;
  color: EventColor;
  userId: UserId;
  workspaceId?: WorkspaceId;
  teamId?: TeamId;
  projectId?: ProjectId;
  taskId?: TaskId;
  isRecurring: boolean;
  recurrenceRule?: RecurrenceRule;
  attendees: CalendarEventAttendee[];
  reminders: CalendarEventReminder[];
  externalCalendarId?: string;
  externalEventId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCalendarEventProps {
  title: string;
  description?: string;
  type: EventType;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  location?: string;
  url?: string;
  color?: string;
  userId: string;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  taskId?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  attendees?: Array<{ userId: string; status?: AttendeeStatus }>;
  reminders?: Array<{
    minutesBefore: number;
    method?: 'notification' | 'email' | 'sms';
  }>;
  metadata?: Record<string, any>;
}

export interface UpdateCalendarEventProps {
  title?: string;
  description?: string;
  type?: EventType;
  startDate?: Date;
  endDate?: Date;
  allDay?: boolean;
  location?: string;
  url?: string;
  color?: string;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  taskId?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  metadata?: Record<string, any>;
}

export class CalendarEvent extends BaseEntity<CalendarEventProps> {
  private constructor(props: CalendarEventProps) {
    super(props, props.id.value);
  }

  public static create(props: CreateCalendarEventProps): CalendarEvent {
    const id = CalendarEventId.create();
    const title = EventTitle.create(props.title);
    const description = props.description
      ? EventDescription.create(props.description)
      : undefined;
    const startDate = EventDateTime.create(props.startDate);
    const endDate = props.endDate
      ? EventDateTime.create(props.endDate)
      : undefined;
    const location = props.location
      ? EventLocation.create(props.location)
      : undefined;
    const color = EventColor.create(props.color || '#4f46e5');
    const userId = UserId.create(props.userId);
    const workspaceId = props.workspaceId
      ? WorkspaceId.create(props.workspaceId)
      : undefined;
    const teamId = props.teamId ? TeamId.create(props.teamId) : undefined;
    const projectId = props.projectId
      ? ProjectId.create(props.projectId)
      : undefined;
    const taskId = props.taskId ? TaskId.create(props.taskId) : undefined;
    const recurrenceRule = props.recurrenceRule
      ? RecurrenceRule.create(props.recurrenceRule)
      : undefined;

    // Validate business rules
    this.validateEventDates(startDate.value, endDate?.value);
    this.validateEventType(props.type);

    // Process attendees
    const attendees: CalendarEventAttendee[] = (props.attendees || []).map(
      attendee => ({
        userId: UserId.create(attendee.userId),
        status: attendee.status || AttendeeStatus.PENDING,
        responseAt: undefined,
      })
    );

    // Process reminders
    const reminders: CalendarEventReminder[] = (props.reminders || []).map(
      (reminder, index) => ({
        id: `${id.value}-reminder-${index}`,
        minutesBefore: reminder.minutesBefore,
        method: reminder.method || 'notification',
        sent: false,
        sentAt: undefined,
      })
    );

    const now = new Date();
    const calendarEvent = new CalendarEvent({
      id,
      title,
      description,
      type: props.type,
      startDate,
      endDate,
      allDay: props.allDay || false,
      location,
      url: props.url,
      color,
      userId,
      workspaceId,
      teamId,
      projectId,
      taskId,
      isRecurring: props.isRecurring || false,
      recurrenceRule,
      attendees,
      reminders,
      metadata: props.metadata || {},
      createdAt: now,
      updatedAt: now,
    });

    // Add domain event
    calendarEvent.addDomainEvent(new CalendarEventCreatedEvent(calendarEvent));

    return calendarEvent;
  }

  public static reconstitute(props: CalendarEventProps): CalendarEvent {
    return new CalendarEvent(props);
  }

  public update(props: UpdateCalendarEventProps): void {
    const updates: Partial<CalendarEventProps> = {};

    if (props.title !== undefined) {
      updates.title = EventTitle.create(props.title);
    }

    if (props.description !== undefined) {
      updates.description = props.description
        ? EventDescription.create(props.description)
        : undefined;
    }

    if (props.type !== undefined) {
      this.validateEventType(props.type);
      updates.type = props.type;
    }

    if (props.startDate !== undefined) {
      updates.startDate = EventDateTime.create(props.startDate);
    }

    if (props.endDate !== undefined) {
      updates.endDate = props.endDate
        ? EventDateTime.create(props.endDate)
        : undefined;
    }

    if (props.allDay !== undefined) {
      updates.allDay = props.allDay;
    }

    if (props.location !== undefined) {
      updates.location = props.location
        ? EventLocation.create(props.location)
        : undefined;
    }

    if (props.url !== undefined) {
      updates.url = props.url;
    }

    if (props.color !== undefined) {
      updates.color = EventColor.create(props.color);
    }

    if (props.workspaceId !== undefined) {
      updates.workspaceId = props.workspaceId
        ? WorkspaceId.create(props.workspaceId)
        : undefined;
    }

    if (props.teamId !== undefined) {
      updates.teamId = props.teamId ? TeamId.create(props.teamId) : undefined;
    }

    if (props.projectId !== undefined) {
      updates.projectId = props.projectId
        ? ProjectId.create(props.projectId)
        : undefined;
    }

    if (props.taskId !== undefined) {
      updates.taskId = props.taskId ? TaskId.create(props.taskId) : undefined;
    }

    if (props.isRecurring !== undefined) {
      updates.isRecurring = props.isRecurring;
    }

    if (props.recurrenceRule !== undefined) {
      updates.recurrenceRule = props.recurrenceRule
        ? RecurrenceRule.create(props.recurrenceRule)
        : undefined;
    }

    if (props.metadata !== undefined) {
      updates.metadata = { ...this.props.metadata, ...props.metadata };
    }

    // Validate updated dates if both are provided
    const newStartDate = updates.startDate?.value || this.props.startDate.value;
    const newEndDate = updates.endDate?.value || this.props.endDate?.value;
    this.validateEventDates(newStartDate, newEndDate);

    // Apply updates
    Object.assign(this.props, updates, { updatedAt: new Date() });

    // Add domain event
    this.addDomainEvent(
      new CalendarEventUpdatedEvent(this, Object.keys(updates))
    );
  }

  public addAttendee(
    userId: string,
    status: AttendeeStatus = AttendeeStatus.PENDING
  ): void {
    const attendeeUserId = UserId.create(userId);

    // Check if attendee already exists
    const existingAttendee = this.props.attendees.find(a =>
      a.userId.equals(attendeeUserId)
    );
    if (existingAttendee) {
      throw new Error('Attendee already exists for this event');
    }

    this.props.attendees.push({
      userId: attendeeUserId,
      status,
      responseAt: undefined,
    });

    this.props.updatedAt = new Date();
  }

  public removeAttendee(userId: string): void {
    const attendeeUserId = UserId.create(userId);
    const index = this.props.attendees.findIndex(a =>
      a.userId.equals(attendeeUserId)
    );

    if (index === -1) {
      throw new Error('Attendee not found for this event');
    }

    this.props.attendees.splice(index, 1);
    this.props.updatedAt = new Date();
  }

  public updateAttendeeStatus(userId: string, status: AttendeeStatus): void {
    const attendeeUserId = UserId.create(userId);
    const attendee = this.props.attendees.find(a =>
      a.userId.equals(attendeeUserId)
    );

    if (!attendee) {
      throw new Error('Attendee not found for this event');
    }

    attendee.status = status;
    attendee.responseAt = new Date();
    this.props.updatedAt = new Date();
  }

  public addReminder(
    minutesBefore: number,
    method: 'notification' | 'email' | 'sms' = 'notification'
  ): void {
    if (minutesBefore < 0) {
      throw new Error('Reminder minutes before must be non-negative');
    }

    const reminderId = `${this.props.id.value}-reminder-${Date.now()}`;
    this.props.reminders.push({
      id: reminderId,
      minutesBefore,
      method,
      sent: false,
      sentAt: undefined,
    });

    this.props.updatedAt = new Date();
  }

  public removeReminder(reminderId: string): void {
    const index = this.props.reminders.findIndex(r => r.id === reminderId);

    if (index === -1) {
      throw new Error('Reminder not found for this event');
    }

    this.props.reminders.splice(index, 1);
    this.props.updatedAt = new Date();
  }

  public markReminderSent(reminderId: string): void {
    const reminder = this.props.reminders.find(r => r.id === reminderId);

    if (!reminder) {
      throw new Error('Reminder not found for this event');
    }

    reminder.sent = true;
    reminder.sentAt = new Date();
    this.props.updatedAt = new Date();
  }

  public checkSchedulingConflict(otherEvent: CalendarEvent): boolean {
    // Skip if different users
    if (!this.props.userId.equals(otherEvent.props.userId)) {
      return false;
    }

    // Skip if same event
    if (this.props.id.equals(otherEvent.props.id)) {
      return false;
    }

    const thisStart = this.props.startDate.value;
    const thisEnd =
      this.props.endDate?.value ||
      new Date(thisStart.getTime() + 60 * 60 * 1000); // Default 1 hour
    const otherStart = otherEvent.props.startDate.value;
    const otherEnd =
      otherEvent.props.endDate?.value ||
      new Date(otherStart.getTime() + 60 * 60 * 1000);

    // Check for overlap
    return thisStart < otherEnd && thisEnd > otherStart;
  }

  public isUpcoming(): boolean {
    return this.props.startDate.value > new Date();
  }

  public isPast(): boolean {
    const endTime = this.props.endDate?.value || this.props.startDate.value;
    return endTime < new Date();
  }

  public getDuration(): number {
    if (!this.props.endDate) {
      return 60; // Default 1 hour in minutes
    }

    const durationMs =
      this.props.endDate.value.getTime() - this.props.startDate.value.getTime();
    return Math.floor(durationMs / (1000 * 60)); // Convert to minutes
  }

  public delete(): void {
    this.addDomainEvent(new CalendarEventDeletedEvent(this));
  }

  // Getters
  public get id(): CalendarEventId {
    return this.props.id;
  }

  public get title(): EventTitle {
    return this.props.title;
  }

  public get description(): EventDescription | undefined {
    return this.props.description;
  }

  public get type(): EventType {
    return this.props.type;
  }

  public get startDate(): EventDateTime {
    return this.props.startDate;
  }

  public get endDate(): EventDateTime | undefined {
    return this.props.endDate;
  }

  public get allDay(): boolean {
    return this.props.allDay;
  }

  public get location(): EventLocation | undefined {
    return this.props.location;
  }

  public get url(): string | undefined {
    return this.props.url;
  }

  public get color(): EventColor {
    return this.props.color;
  }

  public get userId(): UserId {
    return this.props.userId;
  }

  public get workspaceId(): WorkspaceId | undefined {
    return this.props.workspaceId;
  }

  public get teamId(): TeamId | undefined {
    return this.props.teamId;
  }

  public get projectId(): ProjectId | undefined {
    return this.props.projectId;
  }

  public get taskId(): TaskId | undefined {
    return this.props.taskId;
  }

  public get isRecurring(): boolean {
    return this.props.isRecurring;
  }

  public get recurrenceRule(): RecurrenceRule | undefined {
    return this.props.recurrenceRule;
  }

  public get attendees(): CalendarEventAttendee[] {
    return [...this.props.attendees];
  }

  public get reminders(): CalendarEventReminder[] {
    return [...this.props.reminders];
  }

  public get externalCalendarId(): string | undefined {
    return this.props.externalCalendarId;
  }

  public get externalEventId(): string | undefined {
    return this.props.externalEventId;
  }

  public get metadata(): Record<string, any> {
    return { ...this.props.metadata };
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  private static validateEventDates(startDate: Date, endDate?: Date): void {
    if (endDate && endDate <= startDate) {
      throw new Error('End date must be after start date');
    }
  }

  private static validateEventType(type: EventType): void {
    if (!Object.values(EventType).includes(type)) {
      throw new Error(`Invalid event type: ${type}`);
    }
  }
}
