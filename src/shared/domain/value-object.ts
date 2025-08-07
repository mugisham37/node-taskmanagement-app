/**
 * Base class for value objects
 * Value objects are immutable and are compared by their values, not identity
 */
export abstract class ValueObject<T> {
  protected readonly _value: T;

  constructor(value: T) {
    this.validate(value);
    this._value = Object.freeze(this.clone(value));
  }

  /**
   * Get the value
   */
  get value(): T {
    return this._value;
  }

  /**
   * Validate the value
   */
  protected abstract validate(value: T): void;

  /**
   * Clone the value to ensure immutability
   */
  protected clone(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return [...value] as T;
      }
      return { ...value } as T;
    }

    return value;
  }

  /**
   * Check if this value object equals another
   */
  public equals(other: ValueObject<T>): boolean {
    if (!other) {
      return false;
    }

    if (this === other) {
      return true;
    }

    return this.deepEquals(this._value, other._value);
  }

  /**
   * Deep equality check for complex values
   */
  private deepEquals(a: any, b: any): boolean {
    if (a === b) {
      return true;
    }

    if (a === null || b === null || a === undefined || b === undefined) {
      return a === b;
    }

    if (typeof a !== typeof b) {
      return false;
    }

    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) {
        return false;
      }

      if (Array.isArray(a)) {
        if (a.length !== b.length) {
          return false;
        }
        return a.every((item, index) => this.deepEquals(item, b[index]));
      }

      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) {
        return false;
      }

      return keysA.every(key => this.deepEquals(a[key], b[key]));
    }

    return false;
  }

  /**
   * Get hash code for the value object
   */
  public hashCode(): string {
    return this.generateHash(this._value);
  }

  /**
   * Generate hash for complex values
   */
  private generateHash(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[${value.map(item => this.generateHash(item)).join(',')}]`;
      }

      const keys = Object.keys(value).sort();
      const pairs = keys.map(key => `${key}:${this.generateHash(value[key])}`);
      return `{${pairs.join(',')}}`;
    }

    return String(value);
  }

  /**
   * Convert to string representation
   */
  public toString(): string {
    return this.hashCode();
  }

  /**
   * Convert to plain object for serialization
   */
  public toPlainObject(): T {
    return this.clone(this._value);
  }
}

/**
 * Simple value object for primitive values
 */
export class SimpleValueObject<
  T extends string | number | boolean,
> extends ValueObject<T> {
  protected validate(value: T): void {
    if (value === null || value === undefined) {
      throw new Error('Value cannot be null or undefined');
    }
  }
}

/**
 * Email value object
 */
export class Email extends ValueObject<string> {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  protected validate(value: string): void {
    if (!value || typeof value !== 'string') {
      throw new Error('Email must be a non-empty string');
    }

    if (!Email.EMAIL_REGEX.test(value)) {
      throw new Error('Invalid email format');
    }

    if (value.length > 254) {
      throw new Error('Email is too long');
    }
  }

  public getDomain(): string {
    return this._value.split('@')[1];
  }

  public getLocalPart(): string {
    return this._value.split('@')[0];
  }
}

/**
 * URL value object
 */
export class Url extends ValueObject<string> {
  protected validate(value: string): void {
    if (!value || typeof value !== 'string') {
      throw new Error('URL must be a non-empty string');
    }

    try {
      new URL(value);
    } catch {
      throw new Error('Invalid URL format');
    }
  }

  public getProtocol(): string {
    return new URL(this._value).protocol;
  }

  public getHost(): string {
    return new URL(this._value).host;
  }

  public getPathname(): string {
    return new URL(this._value).pathname;
  }
}

/**
 * Money value object
 */
export interface MoneyProps {
  amount: number;
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  private static readonly CURRENCY_REGEX = /^[A-Z]{3}$/;

  protected validate(value: MoneyProps): void {
    if (!value || typeof value !== 'object') {
      throw new Error('Money value must be an object');
    }

    if (typeof value.amount !== 'number' || isNaN(value.amount)) {
      throw new Error('Amount must be a valid number');
    }

    if (value.amount < 0) {
      throw new Error('Amount cannot be negative');
    }

    if (!value.currency || typeof value.currency !== 'string') {
      throw new Error('Currency must be a non-empty string');
    }

    if (!Money.CURRENCY_REGEX.test(value.currency)) {
      throw new Error('Currency must be a valid 3-letter ISO code');
    }
  }

  public getAmount(): number {
    return this._value.amount;
  }

  public getCurrency(): string {
    return this._value.currency;
  }

  public add(other: Money): Money {
    if (this._value.currency !== other._value.currency) {
      throw new Error('Cannot add money with different currencies');
    }

    return new Money({
      amount: this._value.amount + other._value.amount,
      currency: this._value.currency,
    });
  }

  public subtract(other: Money): Money {
    if (this._value.currency !== other._value.currency) {
      throw new Error('Cannot subtract money with different currencies');
    }

    return new Money({
      amount: this._value.amount - other._value.amount,
      currency: this._value.currency,
    });
  }

  public multiply(factor: number): Money {
    if (typeof factor !== 'number' || isNaN(factor)) {
      throw new Error('Factor must be a valid number');
    }

    return new Money({
      amount: this._value.amount * factor,
      currency: this._value.currency,
    });
  }

  public isZero(): boolean {
    return this._value.amount === 0;
  }

  public isPositive(): boolean {
    return this._value.amount > 0;
  }

  public isNegative(): boolean {
    return this._value.amount < 0;
  }
}
