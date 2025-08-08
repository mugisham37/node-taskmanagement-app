import { StringValueObject } from '../../../shared/domain/value-object';
import { randomUUID } from 'crypto';

export class TaskId extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }

  public static create(id: string): TaskId {
    return new TaskId(id);
  }

  public static generate(): TaskId {
    return new TaskId(randomUUID());
  }

  protected validateString(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('TaskId cannot be empty');
    }

    // Validate UUID format (basic validation)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value.trim())) {
      throw new Error('TaskId must be a valid UUID');
    }
  }

  public toShortString(): string {
    return this.value.substring(0, 8);
  }
}
