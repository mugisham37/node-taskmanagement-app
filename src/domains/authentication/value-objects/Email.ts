import { StringValueObject } from '../../../shared/domain/value-object';

export class Email extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }

  public static create(value: string): Email {
    const normalizedEmail = value.trim().toLowerCase();
    return new Email(normalizedEmail);
  }

  protected validateString(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('Email cannot be empty');
    }

    if (!this.isValid(value)) {
      throw new Error('Invalid email format');
    }
  }

  get domain(): string {
    return this.value.split('@')[1];
  }

  get localPart(): string {
    return this.value.split('@')[0];
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

  private isValid(email: string): boolean {
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
