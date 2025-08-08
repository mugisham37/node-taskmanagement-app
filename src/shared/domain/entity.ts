import { BaseEntity } from './base-entity';

/**
 * Entity class for domain entities
 * Extends BaseEntity with additional domain-specific functionality
 */
export abstract class Entity extends BaseEntity {
  protected constructor(id: string, createdAt: Date, updatedAt: Date) {
    super(id, createdAt, updatedAt);
  }

  /**
   * Updates the entity's timestamp
   */
  protected touch(): void {
    (this as any).updatedAt = new Date();
  }

  /**
   * Checks if the entity is new (not persisted yet)
   */
  isNew(): boolean {
    return this.createdAt === this.updatedAt;
  }

  /**
   * Gets the entity's age in milliseconds
   */
  getAge(): number {
    return Date.now() - this.createdAt.getTime();
  }
}
