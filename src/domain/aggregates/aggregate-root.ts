import { DomainEvent } from '../events/domain-event';
import { DomainEventPublisher } from '../events/domain-event-publisher';

/**
 * Interface for aggregate properties
 */
export interface AggregateProps {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Abstract base class for aggregate roots
 * Aggregate roots are the only entities that can be directly accessed from outside the aggregate
 * They are responsible for maintaining consistency within the aggregate boundary
 */
export abstract class AggregateRoot<TProps extends AggregateProps> {
  protected readonly props: TProps;
  private _domainEvents: DomainEvent[] = [];
  private _version: number = 0;

  constructor(props: TProps) {
    this.props = props;
    this._version = 0;
  }

  /**
   * Get the aggregate ID
   */
  get id(): string {
    return this.props.id;
  }

  /**
   * Get the aggregate version for optimistic concurrency control
   */
  get version(): number {
    return this._version;
  }

  /**
   * Get when the aggregate was created
   */
  get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Get when the aggregate was last updated
   */
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Get all domain events that have occurred on this aggregate
   */
  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * Increment the aggregate version
   */
  protected incrementVersion(): void {
    this._version++;
    this.markAsUpdated();
  }

  /**
   * Mark the aggregate as updated
   */
  protected markAsUpdated(): void {
    this.props.updatedAt = new Date();
  }

  /**
   * Add a domain event and increment version
   */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
    this.incrementVersion();
  }

  /**
   * Clear all domain events from this aggregate
   */
  protected clearDomainEvents(): void {
    this._domainEvents = [];
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
  protected validate(): void {
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

  /**
   * Get validation errors for the aggregate
   */
  abstract getValidationErrors(): string[];

  /**
   * Check equality with another aggregate based on ID
   */
  equals(other: AggregateRoot<TProps>): boolean {
    if (!other || other.constructor !== this.constructor) {
      return false;
    }
    return this.id === other.id;
  }

  /**
   * Get the string representation of the aggregate ID
   */
  toString(): string {
    return `${this.constructor.name}(${this.id})`;
  }
}
