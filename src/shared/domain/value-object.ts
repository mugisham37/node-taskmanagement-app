/**
 * Base class for Value Objects in Domain-Driven Design
 * Value objects are immutable objects that represent a descriptive aspect of the domain
 */
export abstract class ValueObject {
  /**
   * Checks if two value objects are equal based on their properties
   */
  abstract equals(other: ValueObject): boolean;

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
 * Simple value object for single primitive values
 */
export abstract class SingleValueObject<T> extends ValueObject {
  protected constructor(protected readonly value: T) {
    super();
    this.validate();
  }

  getValue(): T {
    return this.value;
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof SingleValueObject)) return false;
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

export class Email extends SingleValueObject<string> {
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

export class PhoneNumber extends SingleValueObject<string> {
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

export class Money extends ValueObject {
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

  equals(other: ValueObject): boolean {
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
