import { DomainEvent } from '../../shared/events/domain-event';
import { CalendarIntegration } from '../entities/calendar-integration.entity';

export class CalendarIntegrationDeletedEvent extends DomainEvent {
  public readonly eventName = 'CalendarIntegrationDeleted';

  constructor(
    public readonly calendarIntegration: CalendarIntegration,
    occurredOn?: Date
  ) {
    super(occurredOn);
  }

  public getAggregateId(): string {
    return this.calendarIntegration.id.value;
  }

  public getEventData(): Record<string, any> {
    return {
      integrationId: this.calendarIntegration.id.value,
      userId: this.calendarIntegration.userId.value,
      provider: this.calendarIntegration.provider.value,
      providerAccountId: this.calendarIntegration.providerAccountId,
      calendarId: this.calendarIntegration.calendarId,
      calendarName: this.calendarIntegration.calendarName.value,
      wasEnabled: this.calendarIntegration.syncEnabled,
      lastSyncedAt: this.calendarIntegration.lastSyncedAt?.toISOString(),
    };
  }
}
