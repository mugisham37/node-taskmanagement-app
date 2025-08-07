import { ValueObject } from '../../shared/value-objects/ValueObject';
import { cuid } from '@paralleldrive/cuid2';

export interface UserIdProps {
  value: string;
}

export class UserId extends ValueObject<UserIdProps> {
  private constructor(props: UserIdProps) {
    super(props);
  }

  public static create(value: string): UserId {
    if (!value || value.trim().length === 0) {
      throw new Error('UserId cannot be empty');
    }

    if (!this.isValid(value)) {
      throw new Error('Invalid UserId format');
    }

    return new UserId({ value: value.trim() });
  }

  public static generate(): UserId {
    return new UserId({ value: cuid() });
  }

  public static fromString(value: string): UserId {
    return this.create(value);
  }

  get value(): string {
    return this.props.value;
  }

  public equals(other: UserId): boolean {
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
