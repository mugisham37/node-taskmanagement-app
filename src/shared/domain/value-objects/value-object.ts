import { ValueObject as CoreValueObject } from '../value-object';

/**
 * Re-export ValueObject for backward compatibility
 */
export abstract class ValueObject extends CoreValueObject {
  abstract equals(other: ValueObject): boolean;
  abstract toPrimitive(): any;
  abstract validate(): void;
}
