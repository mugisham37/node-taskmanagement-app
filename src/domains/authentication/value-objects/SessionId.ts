import { ValueObject } from '../../shared/value-objects/ValueObject';
import { cuid } from '@paralleldrive/cuid2';

export interface SessionIdProps {
  value: string;
}

export class SessionId extends ValueObject<SessionIdProps> {
  private constructor(props: SessionIdProps) {
    super(props);
  }

  public static create(value: string): SessionId {
    if (!value || value.trim().length === 0) {
      throw new Error('SessionId cannot be empty');
    }

    if (!this.isValid(value)) {
      throw new Error('Invalid SessionId format');
    }

    return new SessionId({ value: value.trim() });
  }

  public static generate(): SessionId {
    return new SessionId({ value: cuid() });
  }

  public static fromString(value: string): SessionId {
    return this.create(value);
  }

  get value(): string {
    return this.props.value;
  }

  public equals(other: SessionId): boolean {
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
