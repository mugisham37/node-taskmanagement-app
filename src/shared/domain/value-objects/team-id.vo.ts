import { SingleValueObject } from '../value-object';
import { randomUUID } from 'crypto';

export class TeamId extends SingleValueObject<string> {
  constructor(value: string) {
    super(value);
  }

  validate(): void {
    if (!this.value) {
      throw new Error('Team ID cannot be empty');
    }
    if (typeof this.value !== 'string') {
      throw new Error('Team ID must be a string');
    }
  }

  static create(): TeamId {
    return new TeamId(randomUUID());
  }

  static fromString(value: string): TeamId {
    return new TeamId(value);
  }
}
