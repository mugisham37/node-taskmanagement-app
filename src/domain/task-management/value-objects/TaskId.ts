import { ValueObject } from '../../shared/value-objects/ValueObject';
import { cuid } from '@paralleldrive/cuid2';

export interface TaskIdProps {
  value: string;
}

export class TaskId extends ValueObject<TaskIdProps> {
  private constructor(props: TaskIdProps) {
    super(props);
  }

  public static create(value: string): TaskId {
    if (!value || value.trim().length === 0) {
      throw new Error('TaskId cannot be empty');
    }

    if (!this.isValid(value)) {
      throw new Error('Invalid TaskId format');
    }

    return new TaskId({ value: value.trim() });
  }

  public static generate(): TaskId {
    return new TaskId({ value: cuid() });
  }

  public static fromString(value: string): TaskId {
    return this.create(value);
  }

  get value(): string {
    return this.props.value;
  }

  public equals(other: TaskId): boolean {
    return this.props.value === other.props.value;
  }

  public toString(): string {
    return this.props.value;
  }

  private static isValid(value: string): boolean {
    // Basic validation for CUID format
    return /^[a-z0-9]{24,}$/.test(value);
  }
}
