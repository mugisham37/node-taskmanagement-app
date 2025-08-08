import { BaseEntity } from './base-entity';
import { DomainEvent } from './domain-event';

/**
 * Base class for Aggregate Roots in Domain-Driven Design
 * Aggregate roots are the only entities that can be referenced from outside the aggregate
 * They manage domain events and ensure consistency within the aggregate boundary
 */
export abstract class AggregateRoot extends BaseEntity {
  private _domainEvents: DomainEvent[] = [];

  protected constructor(id: string, createdAt: Date, updatedAt: Date) {
    super(id, createdAt, updatedAt);
  }

  /**
   * Gets all domain events that have been raised by this aggregate
   */
  getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * Clears all domain events from this aggregate
   */
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Raises a domain event
   */
  protected raiseDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Checks if the aggregate has any pending domain events
   */
  hasDomainEvents(): boolean {
    return this._domainEvents.length > 0;
  }

  /**
   * Gets the number of pending domain events
   */
  getDomainEventCount(): number {
    return this._domainEvents.length;
  }
}
