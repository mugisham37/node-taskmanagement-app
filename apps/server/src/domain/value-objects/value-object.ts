/**
 * Abstract base class for all value objects
 * Value objects are immutable and equality is based on their properties
 */
export abstract class ValueObject<T> {
  protected readonly _value: T;

  constructor(value: T) {
    this.validate(value);
    this._value = value;
  }

  /**
   * Get the underlying value
   */
  get value(): T {
    return this._value;
  }

  /**
   * Validate the value - to be implemented by concrete value objects
   */
  protected abstract validate(value: T): void;

  /**
   * Check equality with another value object
   */
  equals(other: ValueObject<T>): boolean {
    if (!other || other.constructor !== this.constructor) {
      return false;
    }
    return this.isEqual(this._value, other._value);
  }

  /**
   * Compare two values for equality
   * Can be overridden for complex value types
   */
  protected isEqual(value1: T, value2: T): boolean {
    if (value1 === value2) {
      return true;
    }

    // Handle null/undefined cases
    if (value1 == null || value2 == null) {
      return value1 === value2;
    }

    // Handle objects and arrays
    if (typeof value1 === 'object' && typeof value2 === 'object') {
      return JSON.stringify(value1) === JSON.stringify(value2);
    }

    return false;
  }

  /**
   * String representation of the value object
   */
  toString(): string {
    return String(this._value);
  }

  /**
   * JSON representation of the value object
   */
  toJSON(): T {
    return this._value;
  }

  /**
   * Create a copy of this value object
   * Since value objects are immutable, this returns the same instance
   */
  clone(): this {
    return this;
  }
}
