import { DomainEvent } from './domain-event';

/**
 * Base class for all domain entities
 * Provides common functionality like identity, timestamps, and domain events
 */
export abstract class BaseEntity<T = string> {
  protected _id: T;
  protected _createdAt: Date;
  protected _updatedAt: Date;
  protected _version: number;
  protected _domainEvents: DomainEvent[] = [];

  constructor(id: T, createdAt?: Date, updatedAt?: Date, version: number = 1) {
    this._id = id;
    this._createdAt = createdAt || new Date();
    this._updatedAt = updatedAt || new Date();
    this._version = version;
  }

  /**
   * Get entity ID
   */
  get id(): T {
    return this._id;
  }

  /**
   * Get creation timestamp
   */
  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Get last update timestamp
   */
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Get entity version for optimistic locking
   */
  get version(): number {
    return this._version;
  }

  /**
   * Get domain events
   */
  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * Add domain event
   */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Clear domain events (typically called after events are published)
   */
  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Mark entity as updated
   */
  protected markAsUpdated(): void {
    this._updatedAt = new Date();
    this._version += 1;
  }

  /**
   * Check if entity equals another entity
   */
  public equals(entity: BaseEntity<T>): boolean {
    if (!entity) {
      return false;
    }

    if (this === entity) {
      return true;
    }

    return this._id === entity._id;
  }

  /**
   * Get entity hash code
   */
  public hashCode(): string {
    return `${this.constructor.name}:${this._id}`;
  }

  /**
   * Convert entity to plain object for serialization
   */
  public abstract toPlainObject(): Record<string, any>;

  /**
   * Validate entity state
   */
  protected abstract validate(): void;

  /**
   * Check if entity is valid
   */
  public isValid(): boolean {
    try {
      this.validate();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Base class for aggregate roots
 * Aggregate roots are the only entities that can be directly accessed from outside the aggregate
 */
export abstract class AggregateRoot<T = string> extends BaseEntity<T> {
  /**
   * Apply domain event and add it to the events list
   */
  protected applyEvent(event: DomainEvent): void {
    this.addDomainEvent(event);
    this.markAsUpdated();
  }

  /**
   * Get uncommitted domain events
   */
  public getUncommittedEvents(): DomainEvent[] {
    return this.domainEvents;
  }

  /**
   * Mark events as committed
   */
  public markEventsAsCommitted(): void {
    this.clearDomainEvents();
  }
}
