import { ValueObject } from '../../shared/value-objects/ValueObject';
import { cuid } from '@paralleldrive/cuid2';

export interface ProjectIdProps {
  value: string;
}

export class ProjectId extends ValueObject<ProjectIdProps> {
  private constructor(props: ProjectIdProps) {
    super(props);
  }

  public static create(value: string): ProjectId {
    if (!value || value.trim().length === 0) {
      throw new Error('ProjectId cannot be empty');
    }

    if (!this.isValid(value)) {
      throw new Error('Invalid ProjectId format');
    }

    return new ProjectId({ value: value.trim() });
  }

  public static generate(): ProjectId {
    return new ProjectId({ value: cuid() });
  }

  public static fromString(value: string): ProjectId {
    return this.create(value);
  }

  get value(): string {
    return this.props.value;
  }

  public equals(other: ProjectId): boolean {
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
