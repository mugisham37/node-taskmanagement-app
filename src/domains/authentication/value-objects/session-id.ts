import { StringValueObject } from '../../../shared/domain/value-object';
import { randomUUID } from 'crypto';

export class SessionId extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }

  public static create(value: string): SessionId {
    return new SessionId(value);
  }

  public static generate(): SessionId {
    return new SessionId(randomUUID());
  }

  public static fromString(value: string): SessionId {
    return this.create(value);
  }

  protected validateString(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('SessionId cannot be empty');
    }

    if (!this.isValid(value)) {
      throw new Error('Invalid SessionId format');
    }
  }

  private isValid(value: string): boolean {
    // Basic validation for UUID format or CUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const cuidRegex = /^[a-z0-9]{24,}$/;

    return uuidRegex.test(value) || cuidRegex.test(value);
  }
}
