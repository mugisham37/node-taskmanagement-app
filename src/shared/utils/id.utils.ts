import { randomUUID } from 'crypto';

/**
 * ID generation utilities
 */

/**
 * Generate a UUID v4
 */
export function generateUuid(): string {
  return randomUUID();
}

/**
 * Generate a short ID (8 characters)
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Generate a numeric ID
 */
export function generateNumericId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

/**
 * Validate UUID format
 */
export function isValidUuid(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Generate prefixed ID
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${generateUuid()}`;
}
