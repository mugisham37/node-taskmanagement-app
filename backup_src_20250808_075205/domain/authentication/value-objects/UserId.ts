import { ValueObject } from '../../shared/value-objects/ValueObject';
import { randomUUID } from 'crypto';

export interface UserIdProps {
  value: string;
}

export class UserId extends ValueObject<UserIdProps> {
  private constructor(props: UserIdProps) {
    super(props);
  }

  public static create(id: string): UserId {
    if (!id || id.trim().length === 0) {
      throw new Error('UserId cannot be empty');
    }

    // Validate UUID format (basic validation)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id.trim())) {
      throw new Error('UserId must be a valid UUID');
    }

    return new UserId({ value: id.trim() });
  }

  public static generate(): UserId {
    return new UserId({ value: randomUUID() });
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

  public toShortString(): string {
    return this.props.value.substring(0, 8);
  }
}
