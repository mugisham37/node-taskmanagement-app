/**
 * Base Value Object interface and abstract class
 */

export interface ValueObject {
  equals(other: ValueObject): boolean;
}

/**
 * Abstract base class for value objects
 */
export abstract class BaseValueObject implements ValueObject {
  /**
   * Check if two value objects are equal
   * Value objects are equal if all their properties are equal
   */
  equals(other: ValueObject): boolean {
    if (!other || other.constructor !== this.constructor) {
      return false;
    }

    return this.deepEquals(this, other);
  }

  /**
   * Deep equality check for value objects
   */
  private deepEquals(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) {
      return true;
    }

    if (obj1 == null || obj2 == null) {
      return false;
    }

    if (typeof obj1 !== typeof obj2) {
      return false;
    }

    if (typeof obj1 === 'object') {
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);

      if (keys1.length !== keys2.length) {
        return false;
      }

      for (const key of keys1) {
        if (!keys2.includes(key)) {
          return false;
        }

        if (!this.deepEquals(obj1[key], obj2[key])) {
          return false;
        }
      }

      return true;
    }

    return obj1 === obj2;
  }
}