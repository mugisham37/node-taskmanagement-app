/**
 * Validation utilities
 */

/**
 * Check if value is null or undefined
 */
export function isNullOrUndefined(value: any): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Check if string is empty or whitespace
 */
export function isEmptyString(value: string): boolean {
  return !value || value.trim().length === 0;
}

/**
 * Check if email is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if phone number is valid (basic validation)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
}

/**
 * Check if value is a positive number
 */
export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && value > 0;
}

/**
 * Check if value is a non-negative number
 */
export function isNonNegativeNumber(value: number): boolean {
  return typeof value === 'number' && value >= 0;
}

/**
 * Check if array is not empty
 */
export function isNonEmptyArray<T>(array: T[]): array is [T, ...T[]] {
  return Array.isArray(array) && array.length > 0;
}

/**
 * Check if object has required properties
 */
export function hasRequiredProperties<T extends Record<string, any>>(
  obj: any,
  requiredProps: (keyof T)[]
): obj is T {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  return requiredProps.every(
    prop => prop in obj && !isNullOrUndefined(obj[prop])
  );
}
