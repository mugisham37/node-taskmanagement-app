import { DomainEvent } from '../../shared/events/domain-event';
import { CalendarEvent } from '../entities/calendar-event.entity';

export class CalendarEventCreatedEvent extends DomainEvent {
  public readonly eventName = 'CalendarEventCreated';

  constructor(
    public readonly calendarEvent: CalendarEvent,
    occurredOn?: Date
  ) {
    super(occurredOn);
  }

  public getAggregateId(): string {
    return this.calendarEvent.id.value;
  }

  public getEventData(): Record<string, any> {
    return {
      eventId: this.calendarEvent.id.value,
      title: this.calendarEvent.title.value,
      type: this.calendarEvent.type,
      startDate: this.calendarEvent.startDate.value.toISOString(),
      endDate: this.calendarEvent.endDate?.value.toISOString(),
      userId: this.calendarEvent.userId.value,
      workspaceId: this.calendarEvent.workspaceId?.value,
      teamId: this.calendarEvent.teamId?.value,
      projectId: this.calendarEvent.projectId?.value,
      taskId: this.calendarEvent.taskId?.value,
      attendeeCount: this.calendarEvent.attendees.length,
      reminderCount: this.calendarEvent.reminders.length,
      isRecurring: this.calendarEvent.isRecurring,
    };
  }
}
