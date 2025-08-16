import { DomainEvent } from '../events/domain-event';
import { ValueObject } from '../value-objects/value-object';

/**
 * Abstract base class for all domain entities
 * Entities have identity and can change over time
 */
export abstract class BaseEntity<TId extends ValueObject<any>> {
  protected readonly _id: TId;
  protected _domainEvents: DomainEvent[] = [];
  protected _createdAt: Date;
  protected _updatedAt: Date;

  constructor(id: TId, createdAt?: Date, updatedAt?: Date) {
    this._id = id;
    this._createdAt = createdAt || new Date();
    this._updatedAt = updatedAt || new Date();
  }

  /**
   * Get the entity's unique identifier
   */
  get id(): TId {
    return this._id;
  }

  /**
   * Get when the entity was created
   */
  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Get when the entity was last updated
   */
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Get all domain events that have occurred on this entity
   */
  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * Add a domain event to this entity
   */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Clear all domain events from this entity
   */
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Mark the entity as updated
   */
  protected markAsUpdated(): void {
    this._updatedAt = new Date();
  }

  /**
   * Check equality with another entity based on ID
   */
  equals(other: BaseEntity<TId>): boolean {
    if (!other || other.constructor !== this.constructor) {
      return false;
    }
    return this._id.equals(other._id);
  }

  /**
   * Get the string representation of the entity ID
   */
  toString(): string {
    return `${this.constructor.name}(${this._id.toString()})`;
  }

  /**
   * Get a hash code for this entity based on its ID
   */
  hashCode(): string {
    return this._id.toString();
  }

  /**
   * Check if this entity is the same as another (same ID and type)
   */
  isSameAs(other: BaseEntity<TId>): boolean {
    return this.equals(other);
  }

  /**
   * Validate the entity's current state
   * To be implemented by concrete entities
   */
  protected abstract validate(): void;

  /**
   * Get the entity's business rules validation errors
   */
  abstract getValidationErrors(): string[];
}
