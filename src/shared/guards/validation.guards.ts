import { DomainError } from '../errors/domain-error';

/**
 * Validation guards for domain logic
 * Enhanced with comprehensive validation guards from older version migration
 */

/**
 * Guard against null or undefined values
 */
export function guardAgainstNullOrUndefined(
  value: any,
  parameterName: string
): void {
  if (value === null || value === undefined) {
    throw new DomainError(`${parameterName} cannot be null or undefined`);
  }
}

/**
 * Guard against empty strings
 */
export function guardAgainstEmptyString(
  value: string,
  parameterName: string
): void {
  guardAgainstNullOrUndefined(value, parameterName);
  if (value.trim().length === 0) {
    throw new DomainError(`${parameterName} cannot be empty`);
  }
}

/**
 * Guard against invalid length
 */
export function guardAgainstInvalidLength(
  value: string,
  parameterName: string,
  minLength?: number,
  maxLength?: number
): void {
  guardAgainstNullOrUndefined(value, parameterName);

  if (minLength !== undefined && value.length < minLength) {
    throw new DomainError(
      `${parameterName} must be at least ${minLength} characters long`
    );
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new DomainError(
      `${parameterName} cannot exceed ${maxLength} characters`
    );
  }
}

/**
 * Guard against negative numbers
 */
export function guardAgainstNegativeNumber(
  value: number,
  parameterName: string
): void {
  guardAgainstNullOrUndefined(value, parameterName);
  if (value < 0) {
    throw new DomainError(`${parameterName} cannot be negative`);
  }
}

/**
 * Guard against invalid range
 */
export function guardAgainstInvalidRange(
  value: number,
  parameterName: string,
  min?: number,
  max?: number
): void {
  guardAgainstNullOrUndefined(value, parameterName);

  if (min !== undefined && value < min) {
    throw new DomainError(`${parameterName} must be at least ${min}`);
  }

  if (max !== undefined && value > max) {
    throw new DomainError(`${parameterName} cannot exceed ${max}`);
  }
}

/**
 * Guard against empty arrays
 */
export function guardAgainstEmptyArray<T>(
  value: T[],
  parameterName: string
): void {
  guardAgainstNullOrUndefined(value, parameterName);
  if (!Array.isArray(value) || value.length === 0) {
    throw new DomainError(`${parameterName} cannot be empty`);
  }
}

/**
 * Guard against invalid email format
 */
export function guardAgainstInvalidEmail(
  email: string,
  parameterName: string = 'email'
): void {
  guardAgainstEmptyString(email, parameterName);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new DomainError(`${parameterName} must be a valid email address`);
  }
}

/**
 * Guard against invalid UUID format
 */
export function guardAgainstInvalidUuid(
  uuid: string,
  parameterName: string
): void {
  guardAgainstEmptyString(uuid, parameterName);
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    throw new DomainError(`${parameterName} must be a valid UUID`);
  }
}

/**
 * Guard against invalid URL format
 */
export function guardAgainstInvalidUrl(
  url: string,
  parameterName: string
): void {
  guardAgainstEmptyString(url, parameterName);
  try {
    new URL(url);
  } catch {
    throw new DomainError(`${parameterName} must be a valid URL`);
  }
}

/**
 * Guard against invalid phone number format
 */
export function guardAgainstInvalidPhoneNumber(
  phone: string,
  parameterName: string = 'phone'
): void {
  guardAgainstEmptyString(phone, parameterName);
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  if (!phoneRegex.test(phone)) {
    throw new DomainError(`${parameterName} must be a valid phone number`);
  }
}

/**
 * Guard against invalid date
 */
export function guardAgainstInvalidDate(
  date: Date,
  parameterName: string
): void {
  guardAgainstNullOrUndefined(date, parameterName);
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new DomainError(`${parameterName} must be a valid date`);
  }
}

/**
 * Guard against past dates
 */
export function guardAgainstPastDate(date: Date, parameterName: string): void {
  guardAgainstInvalidDate(date, parameterName);
  if (date < new Date()) {
    throw new DomainError(`${parameterName} cannot be in the past`);
  }
}

/**
 * Guard against future dates
 */
export function guardAgainstFutureDate(
  date: Date,
  parameterName: string
): void {
  guardAgainstInvalidDate(date, parameterName);
  if (date > new Date()) {
    throw new DomainError(`${parameterName} cannot be in the future`);
  }
}

/**
 * Guard against invalid enum value
 */
export function guardAgainstInvalidEnumValue<
  T extends Record<string, string | number>,
>(value: any, enumObject: T, parameterName: string): void {
  guardAgainstNullOrUndefined(value, parameterName);
  if (!Object.values(enumObject).includes(value)) {
    const validValues = Object.values(enumObject).join(', ');
    throw new DomainError(`${parameterName} must be one of: ${validValues}`);
  }
}

/**
 * Guard against invalid array items
 */
export function guardAgainstInvalidArrayItems<T>(
  array: T[],
  validator: (item: T) => boolean,
  parameterName: string
): void {
  guardAgainstEmptyArray(array, parameterName);
  const invalidItems = array.filter((item, index) => !validator(item));
  if (invalidItems.length > 0) {
    throw new DomainError(`${parameterName} contains invalid items`);
  }
}

/**
 * Guard against duplicate values in array
 */
export function guardAgainstDuplicateValues<T>(
  array: T[],
  parameterName: string,
  keyExtractor?: (item: T) => any
): void {
  guardAgainstNullOrUndefined(array, parameterName);
  if (!Array.isArray(array)) {
    throw new DomainError(`${parameterName} must be an array`);
  }

  const seen = new Set();
  const duplicates: T[] = [];

  for (const item of array) {
    const key = keyExtractor ? keyExtractor(item) : item;
    if (seen.has(key)) {
      duplicates.push(item);
    } else {
      seen.add(key);
    }
  }

  if (duplicates.length > 0) {
    throw new DomainError(`${parameterName} contains duplicate values`);
  }
}

/**
 * Guard against invalid object properties
 */
export function guardAgainstMissingProperties(
  obj: any,
  requiredProperties: string[],
  parameterName: string
): void {
  guardAgainstNullOrUndefined(obj, parameterName);
  if (typeof obj !== 'object') {
    throw new DomainError(`${parameterName} must be an object`);
  }

  const missingProperties = requiredProperties.filter(
    prop => !(prop in obj) || obj[prop] === undefined
  );
  if (missingProperties.length > 0) {
    throw new DomainError(
      `${parameterName} is missing required properties: ${missingProperties.join(', ')}`
    );
  }
}

/**
 * Guard against invalid JSON
 */
export function guardAgainstInvalidJson(
  jsonString: string,
  parameterName: string
): void {
  guardAgainstEmptyString(jsonString, parameterName);
  try {
    JSON.parse(jsonString);
  } catch {
    throw new DomainError(`${parameterName} must be valid JSON`);
  }
}

/**
 * Guard against invalid regex pattern
 */
export function guardAgainstInvalidRegex(
  pattern: string,
  parameterName: string
): void {
  guardAgainstEmptyString(pattern, parameterName);
  try {
    new RegExp(pattern);
  } catch {
    throw new DomainError(
      `${parameterName} must be a valid regular expression`
    );
  }
}

/**
 * Guard against invalid base64 string
 */
export function guardAgainstInvalidBase64(
  base64String: string,
  parameterName: string
): void {
  guardAgainstEmptyString(base64String, parameterName);
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(base64String)) {
    throw new DomainError(`${parameterName} must be a valid base64 string`);
  }
}

/**
 * Guard against invalid hex color
 */
export function guardAgainstInvalidHexColor(
  color: string,
  parameterName: string
): void {
  guardAgainstEmptyString(color, parameterName);
  const hexColorRegex = /^#[0-9A-F]{6}$/i;
  if (!hexColorRegex.test(color)) {
    throw new DomainError(
      `${parameterName} must be a valid hex color (e.g., #FF0000)`
    );
  }
}

/**
 * Guard against invalid IP address
 */
export function guardAgainstInvalidIpAddress(
  ip: string,
  parameterName: string
): void {
  guardAgainstEmptyString(ip, parameterName);
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
    throw new DomainError(`${parameterName} must be a valid IP address`);
  }
}

/**
 * Guard against invalid file extension
 */
export function guardAgainstInvalidFileExtension(
  filename: string,
  allowedExtensions: string[],
  parameterName: string
): void {
  guardAgainstEmptyString(filename, parameterName);
  const extension = filename.toLowerCase().split('.').pop();
  if (!extension || !allowedExtensions.includes(extension)) {
    throw new DomainError(
      `${parameterName} must have one of the following extensions: ${allowedExtensions.join(', ')}`
    );
  }
}

/**
 * Guard against invalid MIME type
 */
export function guardAgainstInvalidMimeType(
  mimeType: string,
  allowedTypes: string[],
  parameterName: string
): void {
  guardAgainstEmptyString(mimeType, parameterName);
  if (!allowedTypes.includes(mimeType)) {
    throw new DomainError(
      `${parameterName} must be one of the following MIME types: ${allowedTypes.join(', ')}`
    );
  }
}
