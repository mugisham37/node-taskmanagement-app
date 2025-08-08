/**
 * Base Entity class for all domain entities
 * Provides common functionality and enforces domain entity contracts
 */
export abstract class BaseEntity {
  protected constructor(
    public readonly id: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {
    if (!id) {
      throw new Error('Entity ID is required');
    }
    if (!createdAt) {
      throw new Error('Entity createdAt is required');
    }
    if (!updatedAt) {
      throw new Error('Entity updatedAt is required');
    }
  }

  /**
   * Validates the entity's business rules and invariants
   * Must be implemented by concrete entities
   */
  abstract validate(): void;

  /**
   * Converts the entity to a primitive object representation
   * Useful for serialization and data transfer
   */
  abstract toPrimitive(): Record<string, any>;

  /**
   * Checks if two entities are equal based on their ID
   */
  equals(other: BaseEntity): boolean {
    if (!other) return false;
    if (this.constructor !== other.constructor) return false;
    return this.id === other.id;
  }

  /**
   * Creates a copy of the entity with updated timestamp
   */
  protected withUpdatedTimestamp(): this {
    const constructor = this.constructor as new (...args: any[]) => this;
    const primitive = this.toPrimitive();
    return new constructor({
      ...primitive,
      updatedAt: new Date(),
    });
  }
}
