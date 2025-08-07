import { ValueObject } from '../../shared/value-objects/ValueObject';
import { cuid } from '@paralleldrive/cuid2';

export interface WorkspaceIdProps {
  value: string;
}

export class WorkspaceId extends ValueObject<WorkspaceIdProps> {
  private constructor(props: WorkspaceIdProps) {
    super(props);
  }

  public static create(value: string): WorkspaceId {
    if (!value || value.trim().length === 0) {
      throw new Error('WorkspaceId cannot be empty');
    }

    if (!this.isValid(value)) {
      throw new Error('Invalid WorkspaceId format');
    }

    return new WorkspaceId({ value: value.trim() });
  }

  public static generate(): WorkspaceId {
    return new WorkspaceId({ value: cuid() });
  }

  public static fromString(value: string): WorkspaceId {
    return this.create(value);
  }

  get value(): string {
    return this.props.value;
  }

  public equals(other: WorkspaceId): boolean {
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
