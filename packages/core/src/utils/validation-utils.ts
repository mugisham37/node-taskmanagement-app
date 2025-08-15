/**
 * Enhanced validation utilities with comprehensive validation functions
 * Combines existing functionality with advanced validation from older version
 */
export class ValidationUtils {
  /**
   * Email validation regex
   */
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Strong password regex (at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)
   */
  private static readonly STRONG_PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  /**
   * UUID v4 regex
   */
  private static readonly UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }
    return this.EMAIL_REGEX.test(email.trim());
  }

  /**
   * Validate password strength
   */
  static isStrongPassword(password: string): boolean {
    if (!password || typeof password !== 'string') {
      return false;
    }
    return this.STRONG_PASSWORD_REGEX.test(password);
  }

  /**
   * Validate UUID v4 format
   */
  static isValidUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') {
      return false;
    }
    return this.UUID_V4_REGEX.test(uuid);
  }

  /**
   * Check if string is not empty or whitespace only
   */
  static isNotEmpty(value: string): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Check if string length is within range
   */
  static isLengthInRange(value: string, min: number, max: number): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }
    const length = value.trim().length;
    return length >= min && length <= max;
  }

  /**
   * Check if number is within range
   */
  static isNumberInRange(value: number, min: number, max: number): boolean {
    return (
      typeof value === 'number' && !isNaN(value) && value >= min && value <= max
    );
  }

  /**
   * Check if value is a positive integer
   */
  static isPositiveInteger(value: number): boolean {
    return Number.isInteger(value) && value > 0;
  }

  /**
   * Check if value is a non-negative integer
   */
  static isNonNegativeInteger(value: number): boolean {
    return Number.isInteger(value) && value >= 0;
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize string by removing HTML tags and trimming
   */
  static sanitizeString(value: string): string {
    if (!value || typeof value !== 'string') {
      return '';
    }
    return value.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Check if array is not empty
   */
  static isNotEmptyArray<T>(array: T[]): boolean {
    return Array.isArray(array) && array.length > 0;
  }

  /**
   * Check if object is not empty
   */
  static isNotEmptyObject(obj: object): boolean {
    return (
      obj !== null && typeof obj === 'object' && Object.keys(obj).length > 0
    );
  }

  /**
   * Validate that all required fields are present in an object
   */
  static hasRequiredFields(
    obj: Record<string, any>,
    requiredFields: string[]
  ): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    return requiredFields.every(
      field => obj.hasOwnProperty(field) && obj[field] !== undefined
    );
  }

  /**
   * Check if value is one of the allowed values
   */
  static isOneOf<T>(value: T, allowedValues: T[]): boolean {
    return allowedValues.includes(value);
  }

  /**
   * Validate phone number format (basic validation)
   */
  static isValidPhoneNumber(phone: string): boolean {
    if (!phone || typeof phone !== 'string') {
      return false;
    }
    // Basic phone number validation - digits, spaces, hyphens, parentheses, plus sign
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone.trim());
  }

  /**
   * Check if date string is valid ISO format
   */
  static isValidISODate(dateString: string): boolean {
    if (!dateString || typeof dateString !== 'string') {
      return false;
    }
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && dateString === date.toISOString();
  }

  /**
   * Validate that a value is within an enum
   */
  static isValidEnumValue<T extends Record<string, string | number>>(
    value: any,
    enumObject: T
  ): value is T[keyof T] {
    return Object.values(enumObject).includes(value);
  }

  // Enhanced functionality from older version

  /**
   * Check if value is null or undefined
   */
  static isNullOrUndefined(value: any): value is null | undefined {
    return value === null || value === undefined;
  }

  /**
   * Check if string is empty or whitespace
   */
  static isEmptyString(value: string): boolean {
    return !value || value.trim().length === 0;
  }

  /**
   * Check if value is a positive number
   */
  static isPositiveNumber(value: number): boolean {
    return typeof value === 'number' && value > 0;
  }

  /**
   * Check if value is a non-negative number
   */
  static isNonNegativeNumber(value: number): boolean {
    return typeof value === 'number' && value >= 0;
  }

  /**
   * Check if array is not empty (with type guard)
   */
  static isNonEmptyArray<T>(array: T[]): array is [T, ...T[]] {
    return Array.isArray(array) && array.length > 0;
  }

  /**
   * Check if object has required properties
   */
  static hasRequiredProperties<T extends Record<string, any>>(
    obj: any,
    requiredProps: (keyof T)[]
  ): obj is T {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    return requiredProps.every(
      prop => prop in obj && !ValidationUtils.isNullOrUndefined(obj[prop])
    );
  }
}