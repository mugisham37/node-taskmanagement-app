/**
 * Base entity interface that all domain entities must implement
 */
export interface Entity<TId = string> {
  readonly id: TId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Base abstract entity class
 */
export abstract class BaseEntity<TId = string> implements Entity<TId> {
  public readonly id: TId;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  protected constructor(
    id: TId,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    this.id = id;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  /**
   * Check if this entity equals another entity
   */
  public equals(other: Entity<TId>): boolean {
    return this.id === other.id;
  }

  /**
   * Get a plain object representation
   */
  public toPlainObject(): Record<string, any> {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * Aggregate root marker interface
 */
export interface AggregateRoot<TId = string> extends Entity<TId> {
  // Marker interface for aggregate roots
}
