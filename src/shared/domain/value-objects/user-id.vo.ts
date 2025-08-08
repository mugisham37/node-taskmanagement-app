import { SingleValueObject } from '../value-object';
import { randomUUID } from 'crypto';

export class UserId extends SingleValueObject<string> {
  constructor(value: string) {
    super(value);
  }

  validate(): void {
    if (!this.value) {
      throw new Error('User ID cannot be empty');
    }
    if (typeof this.value !== 'string') {
      throw new Error('User ID must be a string');
    }
  }

  static create(): UserId {
    return new UserId(randomUUID());
  }

  static fromString(value: string): UserId {
    return new UserId(value);
  }
}
