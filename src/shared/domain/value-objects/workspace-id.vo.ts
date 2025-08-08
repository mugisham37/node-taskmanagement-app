import { SingleValueObject } from '../value-object';
import { randomUUID } from 'crypto';

export class WorkspaceId extends SingleValueObject<string> {
  constructor(value: string) {
    super(value);
  }

  validate(): void {
    if (!this.value) {
      throw new Error('Workspace ID cannot be empty');
    }
    if (typeof this.value !== 'string') {
      throw new Error('Workspace ID must be a string');
    }
  }

  static create(): WorkspaceId {
    return new WorkspaceId(randomUUID());
  }

  static fromString(value: string): WorkspaceId {
    return new WorkspaceId(value);
  }
}
