import { SingleValueObject } from '../value-object';
import { randomUUID } from 'crypto';

export class TaskId extends SingleValueObject<string> {
  constructor(value: string) {
    super(value);
  }

  validate(): void {
    if (!this.value) {
      throw new Error('Task ID cannot be empty');
    }
    if (typeof this.value !== 'string') {
      throw new Error('Task ID must be a string');
    }
  }

  static create(): TaskId {
    return new TaskId(randomUUID());
  }

  static fromString(value: string): TaskId {
    return new TaskId(value);
  }
}
