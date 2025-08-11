import { ValueObject } from './value-object';
import { ValidationError } from '../../shared/errors';
import { USER_VALIDATION } from '../../shared/constants/user-constants';

/**
 * Email value object
 * Represents a valid email address with domain extraction capabilities
 */
export class Email extends ValueObject<string> {
  private static readonly EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  protected validate(value: string): void {
    if (!value) {
      throw ValidationError.forField('email', 'Email cannot be empty', value);
    }

    if (typeof value !== 'string') {
      throw ValidationError.forField('email', 'Email must be a string', value);
    }

    if (value.length > USER_VALIDATION.EMAIL_MAX_LENGTH) {
      throw ValidationError.forField(
        'email',
        `Email cannot exceed ${USER_VALIDATION.EMAIL_MAX_LENGTH} characters`,
        value
      );
    }

    if (!Email.EMAIL_PATTERN.test(value)) {
      throw ValidationError.forField(
        'email',
        'Email must be a valid email address',
        value
      );
    }

    // Additional validation for common email issues
    if (value.includes('..')) {
      throw ValidationError.forField(
        'email',
        'Email cannot contain consecutive dots',
        value
      );
    }

    if (value.startsWith('.') || value.endsWith('.')) {
      throw ValidationError.forField(
        'email',
        'Email cannot start or end with a dot',
        value
      );
    }
  }

  /**
   * Create a new Email from a string
   */
  static create(email: string): Email {
    return new Email(email.toLowerCase().trim());
  }

  /**
   * Get the domain part of the email
   */
  get domain(): string {
    return this._value.split('@')[1];
  }

  /**
   * Get the local part (username) of the email
   */
  get localPart(): string {
    return this._value.split('@')[0];
  }

  /**
   * Check if the email belongs to a specific domain
   */
  isFromDomain(domain: string): boolean {
    return this.domain.toLowerCase() === domain.toLowerCase();
  }

  /**
   * Check if a string is a valid email format
   */
  static isValid(email: string): boolean {
    try {
      new Email(email);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Mask the email for privacy (e.g., j***@example.com)
   */
  getMasked(): string {
    const [local, domain] = this._value.split('@');
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
  }
}
