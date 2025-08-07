import { ValueObject } from './value-object';
import { v4 as uuidv4 } from 'uuid';

export interface UserIdProps {
  value: string;
}

export class UserId extends ValueObject<UserIdProps> {
  private constructor(props: UserIdProps) {
    super(props);
  }

  public static create(id?: string): UserId {
    const value = id || uuidv4();

    if (!this.isValidUuid(value)) {
      throw new Error('Invalid user ID format');
    }

    return new UserId({ value });
  }

  public get value(): string {
    return this.props.value;
  }

  public equals(other: UserId): boolean {
    return this.props.value === other.props.value;
  }

  private static isValidUuid(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
