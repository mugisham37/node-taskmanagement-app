import { ValueObject } from '../../shared/value-objects/ValueObject';
import { cuid } from '@paralleldrive/cuid2';

export interface WebAuthnCredentialIdProps {
  value: string;
}

export class WebAuthnCredentialId extends ValueObject<WebAuthnCredentialIdProps> {
  private constructor(props: WebAuthnCredentialIdProps) {
    super(props);
  }

  public static create(value: string): WebAuthnCredentialId {
    if (!value || value.trim().length === 0) {
      throw new Error('WebAuthnCredentialId cannot be empty');
    }

    if (!this.isValid(value)) {
      throw new Error('Invalid WebAuthnCredentialId format');
    }

    return new WebAuthnCredentialId({ value: value.trim() });
  }

  public static generate(): WebAuthnCredentialId {
    return new WebAuthnCredentialId({ value: cuid() });
  }

  public static fromString(value: string): WebAuthnCredentialId {
    return this.create(value);
  }

  get value(): string {
    return this.props.value;
  }

  public equals(other: WebAuthnCredentialId): boolean {
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
