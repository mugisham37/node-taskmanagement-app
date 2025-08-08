import { PhoneNumber as CorePhoneNumber } from '../value-object';

/**
 * Re-export PhoneNumber as Phone for backward compatibility
 */
export class Phone extends CorePhoneNumber {
  constructor(value: string) {
    super(value);
  }

  static create(value: string): Phone {
    return new Phone(value);
  }
}
