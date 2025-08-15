/**
 * Base Entity interface and abstract class
 */

export interface Entity<T> {
  readonly id: T;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  equals(other: Entity<T>): boolean;
}

/**
 * Abstract base class for entities
 */
export abstract class BaseEntity<T> implements Entity<T> {
  public readonly id: T;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(id: T, createdAt?: Date, updatedAt?: Date) {
    this.id = id;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  /**
   * Check if two entities are equal based on their ID
   */
  equals(other: Entity<T>): boolean {
    if (!other || other.constructor !== this.constructor) {
      return false;
    }
    return this.id === other.id;
  }

  /**
   * Update the updatedAt timestamp
   */
  protected touch(): void {
    this.updatedAt = new Date();
  }
}