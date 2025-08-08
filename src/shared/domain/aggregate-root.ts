import { BaseEntity } from './base-entity';
import { DomainEvent } from './domain-event';

/**
 * Base class for Aggregate Roots in Domain-Driven Design
 * Aggregate roots are the only entities that can be referenced from outside the aggregate
 * They manage domain events and ensure consistency within the aggregate boundary
 */
export abstract class AggregateRoot<TProps = any> extends BaseEntity {
  private _domainEvents: DomainEvent[] = [];
  private _version: number = 0;

  protected constructor(
    protected readonly props: TProps,
    id?: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt);
    this.validate();
    this.applyBusinessRules();
  }

  /**
   * Gets all domain events that have been raised by this aggregate
   */
  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * Gets the current version of the aggregate for optimistic concurrency control
   */
  get version(): number {
    return this._version;
  }

  /**
   * Clears all domain events from this aggregate
   */
  clearEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Raises a domain event
   */
  protected addDomainEvent(event: DomainEvent): void {
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

  /**
   * Increments the version for optimistic concurrency control
   */
  protected incrementVersion(): void {
    this._version++;
  }

  /**
   * Sets the version (used when loading from persistence)
   */
  setVersion(version: number): void {
    this._version = version;
  }

  /**
   * Validates the aggregate's business rules and invariants
   * Must be implemented by concrete aggregates
   */
  protected abstract validate(): void;

  /**
   * Applies business rules after construction or modification
   * Must be implemented by concrete aggregates
   */
  protected abstract applyBusinessRules(): void;

  /**
   * Marks the aggregate as modified and increments version
   */
  protected markAsModified(): void {
    this.incrementVersion();
    (this as any).updatedAt = new Date();
  }
}
