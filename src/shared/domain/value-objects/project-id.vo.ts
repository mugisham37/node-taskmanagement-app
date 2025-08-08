import { SingleValueObject } from '../value-object';
import { randomUUID } from 'crypto';

export class ProjectId extends SingleValueObject<string> {
  constructor(value: string) {
    super(value);
  }

  validate(): void {
    if (!this.value) {
      throw new Error('Project ID cannot be empty');
    }
    if (typeof this.value !== 'string') {
      throw new Error('Project ID must be a string');
    }
  }

  static create(): ProjectId {
    return new ProjectId(randomUUID());
  }

  static fromString(value: string): ProjectId {
    return new ProjectId(value);
  }
}
