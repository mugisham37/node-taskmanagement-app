import { ValueObject } from '../../shared/value-objects/ValueObject';

export interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  public static create(value: string): Email {
    if (!value || value.trim().length === 0) {
      throw new Error('Email cannot be empty');
    }

    const normalizedEmail = value.trim().toLowerCase();

    if (!this.isValid(normalizedEmail)) {
      throw new Error('Invalid email format');
    }

    return new Email({ value: normalizedEmail });
  }

  get value(): string {
    return this.props.value;
  }

  get domain(): string {
    return this.props.value.split('@')[1];
  }

  get localPart(): string {
    return this.props.value.split('@')[0];
  }

  public equals(other: Email): boolean {
    return this.props.value === other.props.value;
  }

  public toString(): string {
    return this.props.value;
  }

  public isFromDomain(domain: string): boolean {
    return this.domain.toLowerCase() === domain.toLowerCase();
  }

  public isPersonalEmail(): boolean {
    const personalDomains = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'icloud.com',
      'aol.com',
      'protonmail.com',
    ];

    return personalDomains.includes(this.domain.toLowerCase());
  }

  public isCorporateEmail(): boolean {
    return !this.isPersonalEmail();
  }

  private static isValid(email: string): boolean {
    // RFC 5322 compliant email regex (simplified)
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!emailRegex.test(email)) {
      return false;
    }

    // Additional validation
    if (email.length > 254) {
      return false;
    }

    const [localPart, domain] = email.split('@');

    if (localPart.length > 64) {
      return false;
    }

    if (domain.length > 253) {
      return false;
    }

    return true;
  }
}
