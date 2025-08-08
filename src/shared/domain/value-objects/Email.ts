import { Email as CoreEmail } from '../value-object';

/**
 * Re-export Email for backward compatibility
 */
export class Email extends CoreEmail {
  constructor(value: string) {
    super(value);
  }

  static create(value: string): Email {
    return new Email(value);
  }
}
