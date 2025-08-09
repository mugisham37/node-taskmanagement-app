import { BaseEntity } from '../entities/base-entity';
import { DomainEvent } from '../events/domain-event';
import { DomainEventPublisher } from '../events/domain-event-publisher';
import { ValueObject } from '../value-objects/value-object';

/**
 * Abstract base class for aggregate roots
 * Aggregate roots are the only entities that can be directly accessed from outside the aggregate
 * They are responsible for maintaining consistency within the aggregate boundary
 */
export abstract class AggregateRoot<
  TId extends ValueObject<any>,
> extends BaseEntity<TId> {
  private _version: number = 0;

  constructor(id: TId, createdAt?: Date, updatedAt?: Date, version?: number) {
    super(id, createdAt, updatedAt);
    this._version = version || 0;
  }

  /**
   * Get the aggregate version for optimistic concurrency control
   */
  get version(): number {
    return this._version;
  }

  /**
   * Increment the aggregate version
   */
  protected incrementVersion(): void {
    this._version++;
    this.markAsUpdated();
  }

  /**
   * Add a domain event and increment version
   */
  protected override addDomainEvent(event: DomainEvent): void {
    super.addDomainEvent(event);
    this.incrementVersion();
  }

  /**
   * Publish all domain events that have occurred on this aggregate
   */
  async publishDomainEvents(): Promise<void> {
    const events = this.domainEvents;
    if (events.length === 0) {
      return;
    }

    const publisher = DomainEventPublisher.getInstance();
    await publisher.publishAll(events);
    this.clearDomainEvents();
  }

  /**
   * Apply a domain event to the aggregate
   * This is used for event sourcing scenarios
   */
  protected abstract applyEvent(event: DomainEvent): void;

  /**
   * Replay events to rebuild the aggregate state
   * Used in event sourcing scenarios
   */
  replayEvents(events: DomainEvent[]): void {
    for (const event of events) {
      this.applyEvent(event);
      this._version++;
    }
  }

  /**
   * Check if the aggregate has uncommitted changes
   */
  hasUncommittedChanges(): boolean {
    return this._domainEvents.length > 0;
  }

  /**
   * Get the aggregate's invariants - business rules that must always be true
   */
  protected abstract checkInvariants(): void;

  /**
   * Validate the aggregate's state including all invariants
   */
  protected override validate(): void {
    this.checkInvariants();
  }

  /**
   * Mark the aggregate as committed (events have been persisted)
   */
  markAsCommitted(): void {
    this.clearDomainEvents();
  }

  /**
   * Create a snapshot of the aggregate's current state
   * Useful for event sourcing optimizations
   */
  abstract createSnapshot(): Record<string, any>;

  /**
   * Restore the aggregate from a snapshot
   * Useful for event sourcing optimizations
   */
  abstract restoreFromSnapshot(snapshot: Record<string, any>): void;
}
