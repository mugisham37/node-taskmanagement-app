/**
 * Calendar Domain Layer Exports
 * This module exports all calendar domain components
 */

// Aggregates
export {
  CalendarEventAggregate,
  CalendarEventProps,
} from './aggregates/calendar-event.aggregate';

// Value Objects
export { CalendarEventId } from './value-objects/calendar-event-id';

// Domain Services
export { CalendarDomainService } from './services/calendar-domain.service';

// Repository Interfaces
export { ICalendarEventRepository } from './repositories/calendar-event.repository.interface';

// Domain Events
export { CalendarEventCreatedEvent } from './aggregates/calendar-event.aggregate';
