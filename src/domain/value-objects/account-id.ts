import { ValueObject } from './value-object';

export interface AccountIdProps {
  value: string;
}

export class AccountId extends ValueObject<AccountIdProps> {
  constructor(props: AccountIdProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(value?: string): AccountId {
    return new AccountId({
      value: value || crypto.randomUUID(),
    });
  }

  public static fromString(value: string): AccountId {
    if (!value || value.trim().length === 0) {
      throw new Error('AccountId cannot be empty');
    }
    return new AccountId({ value: value.trim() });
  }

  public equals(other: AccountId): boolean {
    return this.props.value === other.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
