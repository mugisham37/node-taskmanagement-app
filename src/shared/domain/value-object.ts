/**
 * Base class for Value Objects in Domain-Driven Design
 * Value objects are immutable and defined by their attributes rather than identity
 */
export abstract class ValueObject<T> {
  protected readonly _value: T;

  protected constructor(value: T) {
    this.validate(value);
    this._value = Object.freeze(this.deepFreeze(value));
  }

  /**
   * Gets the value of this value object
   */
  get value(): T {
    return this._value;
  }

  /**
   * Validates the value object's constraints
   * Must be implemented by concrete value objects
   */
  protected abstract validate(value: T): void;

  /**
   * Checks if two value objects are equal
   */
  equals(other: ValueObject<T>): boolean {
    if (!other) return false;
    if (this.constructor !== other.constructor) return false;
    return this.isEqual(this._value, other._value);
  }

  /**
   * Converts the value object to a primitive representation
   */
  toPrimitive(): T {
    return this._value;
  }

  /**
   * Creates a string representation of the value object
   */
  toString(): string {
    return JSON.stringify(this._value);
  }

  /**
   * Creates a hash code for the value object (useful for collections)
   */
  hashCode(): string {
    return this.toString();
  }

  /**
   * Deep equality check for complex values
   */
  private isEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => this.isEqual(item, b[index]));
    }

    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.isEqual(a[key], b[key])) return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Deep freeze an object to ensure immutability
   */
  private deepFreeze(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return Object.freeze(obj.map(item => this.deepFreeze(item)));
    }

    const frozen: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        frozen[key] = this.deepFreeze(obj[key]);
      }
    }

    return Object.freeze(frozen);
  }
}

/**
 * Simple value object for single primitive values
 */
export abstract class SingleValueObject<
  T extends string | number | boolean | Date,
> extends ValueObject<T> {
  protected constructor(value: T) {
    super(value);
  }

  /**
   * Implicit conversion to primitive value
   */
  valueOf(): T {
    return this._value;
  }
}

/**
 * Value object for string values with common validations
 */
export abstract class StringValueObject extends SingleValueObject<string> {
  protected constructor(value: string) {
    super(value);
  }

  protected validate(value: string): void {
    if (typeof value !== 'string') {
      throw new Error('Value must be a string');
    }
    this.validateString(value);
  }

  protected abstract validateString(value: string): void;

  /**
   * Gets the length of the string
   */
  get length(): number {
    return this._value.length;
  }

  /**
   * Checks if the string is empty
   */
  isEmpty(): boolean {
    return this._value.length === 0;
  }

  /**
   * Checks if the string contains only whitespace
   */
  isWhitespace(): boolean {
    return this._value.trim().length === 0;
  }
}

/**
 * Value object for numeric values with common validations
 */
export abstract class NumberValueObject extends SingleValueObject<number> {
  protected constructor(value: number) {
    super(value);
  }

  protected validate(value: number): void {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Value must be a valid number');
    }
    this.validateNumber(value);
  }

  protected abstract validateNumber(value: number): void;

  /**
   * Checks if the number is positive
   */
  isPositive(): boolean {
    return this._value > 0;
  }

  /**
   * Checks if the number is negative
   */
  isNegative(): boolean {
    return this._value < 0;
  }

  /**
   * Checks if the number is zero
   */
  isZero(): boolean {
    return this._value === 0;
  }

  /**
   * Checks if the number is an integer
   */
  isInteger(): boolean {
    return Number.isInteger(this._value);
  }
}

/**
 * Value object for date values with common validations
 */
export abstract class DateValueObject extends SingleValueObject<Date> {
  protected constructor(value: Date) {
    super(value);
  }

  protected validate(value: Date): void {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
      throw new Error('Value must be a valid Date');
    }
    this.validateDate(value);
  }

  protected abstract validateDate(value: Date): void;

  /**
   * Checks if the date is in the past
   */
  isPast(): boolean {
    return this._value < new Date();
  }

  /**
   * Checks if the date is in the future
   */
  isFuture(): boolean {
    return this._value > new Date();
  }

  /**
   * Checks if the date is today
   */
  isToday(): boolean {
    const today = new Date();
    return this._value.toDateString() === today.toDateString();
  }

  /**
   * Gets the ISO string representation
   */
  toISOString(): string {
    return this._value.toISOString();
  }
}

/**
 * Legacy value object base class for backward compatibility
 */
export abstract class LegacyValueObject {
  /**
   * Checks if two value objects are equal based on their properties
   */
  abstract equals(other: LegacyValueObject): boolean;

  /**
   * Converts the value object to a primitive representation
   */
  abstract toPrimitive(): any;

  /**
   * Validates the value object's invariants
   */
  abstract validate(): void;

  /**
   * Helper method for deep equality comparison of objects
   */
  protected deepEquals(a: any, b: any): boolean {
    if (a === b) return true;

    if (a == null || b == null) return false;

    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEquals(a[key], b[key])) return false;
      }

      return true;
    }

    return false;
  }
}

/**
 * Legacy simple value object for single primitive values
 */
export abstract class LegacySingleValueObject<T> extends LegacyValueObject {
  protected constructor(protected readonly value: T) {
    super();
    this.validate();
  }

  getValue(): T {
    return this.value;
  }

  equals(other: LegacyValueObject): boolean {
    if (!(other instanceof LegacySingleValueObject)) return false;
    return this.value === other.value;
  }

  toPrimitive(): T {
    return this.value;
  }

  toString(): string {
    return String(this.value);
  }
}

/**
 * Example implementations of common value objects
 */

export class Email extends LegacySingleValueObject<string> {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(value: string) {
    super(value);
  }

  validate(): void {
    if (!this.value) {
      throw new Error('Email cannot be empty');
    }
    if (!Email.EMAIL_REGEX.test(this.value)) {
      throw new Error('Invalid email format');
    }
  }

  static create(value: string): Email {
    return new Email(value);
  }
}

export class PhoneNumber extends LegacySingleValueObject<string> {
  private static readonly PHONE_REGEX = /^\+?[\d\s\-\(\)]+$/;

  constructor(value: string) {
    super(value);
  }

  validate(): void {
    if (!this.value) {
      throw new Error('Phone number cannot be empty');
    }
    if (!PhoneNumber.PHONE_REGEX.test(this.value)) {
      throw new Error('Invalid phone number format');
    }
  }

  static create(value: string): PhoneNumber {
    return new PhoneNumber(value);
  }
}

export class Money extends LegacyValueObject {
  constructor(
    private readonly amount: number,
    private readonly currency: string
  ) {
    super();
    this.validate();
  }

  getAmount(): number {
    return this.amount;
  }

  getCurrency(): string {
    return this.currency;
  }

  equals(other: LegacyValueObject): boolean {
    if (!(other instanceof Money)) return false;
    return this.amount === other.amount && this.currency === other.currency;
  }

  toPrimitive(): { amount: number; currency: string } {
    return {
      amount: this.amount,
      currency: this.currency,
    };
  }

  validate(): void {
    if (this.amount < 0) {
      throw new Error('Money amount cannot be negative');
    }
    if (!this.currency || this.currency.length !== 3) {
      throw new Error('Currency must be a 3-letter code');
    }
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add money with different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot subtract money with different currencies');
    }
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  static create(amount: number, currency: string): Money {
    return new Money(amount, currency);
  }
}
