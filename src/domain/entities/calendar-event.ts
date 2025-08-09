import { BaseEntity } from './base-entity';

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
  userId: string;
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
  id: string;
  title: string;
  description?: string;
  type: EventType;
  startDate: Date;
  endDate?: Date;
  allDay: boolean;
  location?: string;
  url?: string;
  color: string;
  userId: string;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  taskId?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  attendees: CalendarEventAttendee[];
  reminders: CalendarEventReminder[];
  externalCalendarId?: string;
  externalEventId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class CalendarEvent extends BaseEntity<CalendarEventProps> {
  private constructor(props: CalendarEventProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.props = props;
  }

  public static create(
    props: Omit<CalendarEventProps, 'id' | 'createdAt' | 'updatedAt'>
  ): CalendarEvent {
    // Validate business rules
    this.validateEventDates(props.startDate, props.endDate);
    this.validateEventType(props.type);

    const now = new Date();
    const calendarEvent = new CalendarEvent({
      ...props,
      id: crypto.randomUUID(),
      color: props.color || '#4f46e5',
      allDay: props.allDay || false,
      isRecurring: props.isRecurring || false,
      attendees: props.attendees || [],
      reminders: props.reminders || [],
      metadata: props.metadata || {},
      createdAt: now,
      updatedAt: now,
    });

    return calendarEvent;
  }

  public static fromPersistence(props: CalendarEventProps): CalendarEvent {
    return new CalendarEvent(props);
  }

  public update(
    updates: Partial<Omit<CalendarEventProps, 'id' | 'createdAt' | 'updatedAt'>>
  ): void {
    // Validate updated dates if both are provided
    const newStartDate = updates.startDate || this.props.startDate;
    const newEndDate = updates.endDate || this.props.endDate;
    this.validateEventDates(newStartDate, newEndDate);

    if (updates.type) {
      this.validateEventType(updates.type);
    }

    // Apply updates
    Object.assign(this.props, updates, { updatedAt: new Date() });
  }

  public addAttendee(
    userId: string,
    status: AttendeeStatus = AttendeeStatus.PENDING
  ): void {
    // Check if attendee already exists
    const existingAttendee = this.props.attendees.find(
      a => a.userId === userId
    );
    if (existingAttendee) {
      throw new Error('Attendee already exists for this event');
    }

    this.props.attendees.push({
      userId,
      status,
      responseAt: undefined,
    });

    this.props.updatedAt = new Date();
  }

  public removeAttendee(userId: string): void {
    const index = this.props.attendees.findIndex(a => a.userId === userId);

    if (index === -1) {
      throw new Error('Attendee not found for this event');
    }

    this.props.attendees.splice(index, 1);
    this.props.updatedAt = new Date();
  }

  public updateAttendeeStatus(userId: string, status: AttendeeStatus): void {
    const attendee = this.props.attendees.find(a => a.userId === userId);

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

    const reminderId = `${this.props.id}-reminder-${Date.now()}`;
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
    if (this.props.userId !== otherEvent.props.userId) {
      return false;
    }

    // Skip if same event
    if (this.props.id === otherEvent.props.id) {
      return false;
    }

    const thisStart = this.props.startDate;
    const thisEnd =
      this.props.endDate || new Date(thisStart.getTime() + 60 * 60 * 1000); // Default 1 hour
    const otherStart = otherEvent.props.startDate;
    const otherEnd =
      otherEvent.props.endDate ||
      new Date(otherStart.getTime() + 60 * 60 * 1000);

    // Check for overlap
    return thisStart < otherEnd && thisEnd > otherStart;
  }

  public isUpcoming(): boolean {
    return this.props.startDate > new Date();
  }

  public isPast(): boolean {
    const endTime = this.props.endDate || this.props.startDate;
    return endTime < new Date();
  }

  public getDuration(): number {
    if (!this.props.endDate) {
      return 60; // Default 1 hour in minutes
    }

    const durationMs =
      this.props.endDate.getTime() - this.props.startDate.getTime();
    return Math.floor(durationMs / (1000 * 60)); // Convert to minutes
  }

  // Getters
  get title(): string {
    return this.props.title;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get type(): EventType {
    return this.props.type;
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date | undefined {
    return this.props.endDate;
  }

  get allDay(): boolean {
    return this.props.allDay;
  }

  get location(): string | undefined {
    return this.props.location;
  }

  get url(): string | undefined {
    return this.props.url;
  }

  get color(): string {
    return this.props.color;
  }

  get userId(): string {
    return this.props.userId;
  }

  get workspaceId(): string | undefined {
    return this.props.workspaceId;
  }

  get teamId(): string | undefined {
    return this.props.teamId;
  }

  get projectId(): string | undefined {
    return this.props.projectId;
  }

  get taskId(): string | undefined {
    return this.props.taskId;
  }

  get isRecurring(): boolean {
    return this.props.isRecurring;
  }

  get recurrenceRule(): string | undefined {
    return this.props.recurrenceRule;
  }

  get attendees(): CalendarEventAttendee[] {
    return [...this.props.attendees];
  }

  get reminders(): CalendarEventReminder[] {
    return [...this.props.reminders];
  }

  get externalCalendarId(): string | undefined {
    return this.props.externalCalendarId;
  }

  get externalEventId(): string | undefined {
    return this.props.externalEventId;
  }

  get metadata(): Record<string, any> {
    return { ...this.props.metadata };
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

  protected validate(): void {
    if (!this.props.title) {
      throw new Error('Event title is required');
    }
    if (!this.props.userId) {
      throw new Error('User ID is required');
    }
    if (!this.props.startDate) {
      throw new Error('Start date is required');
    }
  }
}
