import { ValueObject } from './ValueObject';

export interface PhoneProps {
  value: string;
  countryCode: string;
  nationalNumber: string;
}

export class Phone extends ValueObject<PhoneProps> {
  private static readonly PHONE_REGEX = /^\+[1-9]\d{1,14}$/;
  private static readonly COUNTRY_CODE_REGEX = /^\+[1-9]\d{0,3}$/;

  private constructor(props: PhoneProps) {
    super(props);
  }

  public static create(phoneNumber: string): Phone {
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      throw new Error('Phone number cannot be empty');
    }

    // Remove all non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');

    if (!cleaned.startsWith('+')) {
      throw new Error('Phone number must include country code starting with +');
    }

    if (!this.PHONE_REGEX.test(cleaned)) {
      throw new Error('Invalid phone number format');
    }

    if (cleaned.length < 7 || cleaned.length > 16) {
      throw new Error(
        'Phone number must be between 7 and 16 digits including country code'
      );
    }

    // Extract country code and national number
    const { countryCode, nationalNumber } = this.parsePhoneNumber(cleaned);

    return new Phone({
      value: cleaned,
      countryCode,
      nationalNumber,
    });
  }

  public static createWithCountryCode(
    countryCode: string,
    nationalNumber: string
  ): Phone {
    if (!countryCode.startsWith('+')) {
      countryCode = '+' + countryCode;
    }

    if (!this.COUNTRY_CODE_REGEX.test(countryCode)) {
      throw new Error('Invalid country code format');
    }

    const cleanedNational = nationalNumber.replace(/[^\d]/g, '');
    if (cleanedNational.length < 4 || cleanedNational.length > 12) {
      throw new Error('National number must be between 4 and 12 digits');
    }

    const fullNumber = countryCode + cleanedNational;
    return this.create(fullNumber);
  }

  private static parsePhoneNumber(phoneNumber: string): {
    countryCode: string;
    nationalNumber: string;
  } {
    // Simple parsing - in production, you'd use a library like libphonenumber
    const countryCodeMatch = phoneNumber.match(/^\+(\d{1,3})/);
    if (!countryCodeMatch) {
      throw new Error('Could not parse country code');
    }

    const countryCode = '+' + countryCodeMatch[1];
    const nationalNumber = phoneNumber.substring(countryCode.length);

    return { countryCode, nationalNumber };
  }

  get value(): string {
    return this.props.value;
  }

  get countryCode(): string {
    return this.props.countryCode;
  }

  get nationalNumber(): string {
    return this.props.nationalNumber;
  }

  public equals(other: Phone): boolean {
    return this.props.value === other.props.value;
  }

  public toString(): string {
    return this.props.value;
  }

  public toInternationalFormat(): string {
    return this.props.value;
  }

  public toNationalFormat(): string {
    // Simple formatting - in production, use proper formatting library
    const national = this.props.nationalNumber;
    if (national.length === 10) {
      return `(${national.substring(0, 3)}) ${national.substring(3, 6)}-${national.substring(6)}`;
    }
    return national;
  }

  public maskForDisplay(): string {
    const masked = this.props.nationalNumber.replace(/\d(?=\d{4})/g, '*');
    return this.props.countryCode + masked;
  }

  public isFromCountry(countryCode: string): boolean {
    if (!countryCode.startsWith('+')) {
      countryCode = '+' + countryCode;
    }
    return this.props.countryCode === countryCode;
  }

  public isMobile(): boolean {
    // Simple heuristic - in production, use proper mobile detection
    const cc = this.props.countryCode;
    const national = this.props.nationalNumber;

    // US mobile numbers typically start with certain area codes
    if (cc === '+1') {
      const areaCode = national.substring(0, 3);
      const mobileAreaCodes = [
        '201',
        '202',
        '203',
        '212',
        '213',
        '214',
        '215',
        '216',
        '217',
        '218',
      ];
      return mobileAreaCodes.includes(areaCode);
    }

    // For other countries, assume mobile if length is typical for mobile
    return national.length >= 9;
  }
}
