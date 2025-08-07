import { ValueObject } from '../../shared/value-objects/ValueObject';
import { cuid } from '@paralleldrive/cuid2';

export interface TeamIdProps {
  value: string;
}

export class TeamId extends ValueObject<TeamIdProps> {
  private constructor(props: TeamIdProps) {
    super(props);
  }

  public static create(value: string): TeamId {
    if (!value || value.trim().length === 0) {
      throw new Error('TeamId cannot be empty');
    }

    if (!this.isValid(value)) {
      throw new Error('Invalid TeamId format');
    }

    return new TeamId({ value: value.trim() });
  }

  public static generate(): TeamId {
    return new TeamId({ value: cuid() });
  }

  public static fromString(value: string): TeamId {
    return this.create(value);
  }

  get value(): string {
    return this.props.value;
  }

  public equals(other: TeamId): boolean {
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
