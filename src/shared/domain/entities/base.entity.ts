import { BaseEntity as CoreBaseEntity } from '../base-entity';

/**
 * Re-export BaseEntity for backward compatibility
 * This allows existing imports to continue working while we migrate to the new structure
 */
export class BaseEntity extends CoreBaseEntity {
  protected constructor(id: string, createdAt: Date, updatedAt: Date) {
    super(id, createdAt, updatedAt);
  }
}
