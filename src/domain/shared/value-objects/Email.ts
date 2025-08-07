import { ValueObject } from './ValueObject';

export interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly MAX_LENGTH = 254; // RFC 5321 limit

  private constructor(props: EmailProps) {
    super(props);
  }

  public static create(email: string): Email {
    if (!email || email.trim().length === 0) {
      throw new Error('Email cannot be empty');
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedEmail.length > this.MAX_LENGTH) {
      throw new Error(`Email cannot exceed ${this.MAX_LENGTH} characters`);
    }

    if (!this.EMAIL_REGEX.test(trimmedEmail)) {
      throw new Error('Invalid email format');
    }

    // Additional validation rules
    if (trimmedEmail.includes('..')) {
      throw new Error('Email cannot contain consecutive dots');
    }

    if (trimmedEmail.startsWith('.') || trimmedEmail.endsWith('.')) {
      throw new Error('Email cannot start or end with a dot');
    }

    return new Email({ value: trimmedEmail });
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

  public isFromDomains(domains: string[]): boolean {
    return domains.some(domain => this.isFromDomain(domain));
  }

  public isCorporateEmail(): boolean {
    const personalDomains = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'aol.com',
      'icloud.com',
      'protonmail.com',
      'mail.com',
    ];
    return !this.isFromDomains(personalDomains);
  }

  public maskForDisplay(): string {
    const [local, domain] = this.props.value.split('@');
    if (local.length <= 2) {
      return `${local[0]}*@${domain}`;
    }
    return `${local.substring(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`;
  }
}
