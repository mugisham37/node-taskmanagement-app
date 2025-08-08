import { ValueObject } from '../../shared/value-objects/ValueObject';
import { cuid } from '@paralleldrive/cuid2';

export interface AccountIdProps {
  value: string;
}

export class AccountId extends ValueObject<AccountIdProps> {
  private constructor(props: AccountIdProps) {
    super(props);
  }

  public static create(value: string): AccountId {
    if (!value || value.trim().length === 0) {
      throw new Error('AccountId cannot be empty');
    }

    if (!this.isValid(value)) {
      throw new Error('Invalid AccountId format');
    }

    return new AccountId({ value: value.trim() });
  }

  public static generate(): AccountId {
    return new AccountId({ value: cuid() });
  }

  public static fromString(value: string): AccountId {
    return this.create(value);
  }

  get value(): string {
    return this.props.value;
  }

  public equals(other: AccountId): boolean {
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
