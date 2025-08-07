import { DomainEvent } from '../../shared/events/domain-event';
import { CalendarIntegration } from '../entities/calendar-integration.entity';

export class CalendarIntegrationUpdatedEvent extends DomainEvent {
  public readonly eventName = 'CalendarIntegrationUpdated';

  constructor(
    public readonly calendarIntegration: CalendarIntegration,
    public readonly updatedFields: string[],
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
      syncEnabled: this.calendarIntegration.syncEnabled,
      updatedFields: this.updatedFields,
      lastSyncedAt: this.calendarIntegration.lastSyncedAt?.toISOString(),
      hasErrors: this.calendarIntegration.syncErrors.length > 0,
    };
  }
}
