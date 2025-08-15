import { DomainEvent } from '../types/event.interface';
import { BaseEntity, Entity } from './entity';

/**
 * Aggregate Root interface
 */
export interface AggregateRoot<T> extends Entity<T> {
  readonly domainEvents: DomainEvent[];
  addDomainEvent(event: DomainEvent): void;
  clearDomainEvents(): void;
  getUncommittedEvents(): DomainEvent[];
  markEventsAsCommitted(): void;
}

/**
 * Abstract base class for aggregate roots
 */
export abstract class BaseAggregateRoot<T> extends BaseEntity<T> implements AggregateRoot<T> {
  private _domainEvents: DomainEvent[] = [];
  private _version: number = 0;

  constructor(id: T, createdAt?: Date, updatedAt?: Date) {
    super(id, createdAt, updatedAt);
  }

  /**
   * Get all domain events
   */
  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * Get the current version of the aggregate
   */
  get version(): number {
    return this._version;
  }

  /**
   * Add a domain event to the aggregate
   */
  addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
    this._version++;
    this.touch();
  }

  /**
   * Clear all domain events
   */
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Get uncommitted events (all events that haven't been marked as committed)
   */
  getUncommittedEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * Mark all events as committed (clear them)
   */
  markEventsAsCommitted(): void {
    this.clearDomainEvents();
  }

  /**
   * Apply an event to the aggregate (for event sourcing)
   */
  protected applyEvent(event: DomainEvent): void {
    this.addDomainEvent(event);
  }
}