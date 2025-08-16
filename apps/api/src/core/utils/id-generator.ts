import { randomUUID } from 'crypto';
import { customAlphabet, nanoid } from 'nanoid';

/**
 * Enhanced unique identifier generator with multiple ID types
 * Combines nanoid with UUID and custom ID generation
 */
export class IdGenerator {
  /**
   * Generate a unique ID with default length (21 characters)
   */
  static generate(): string {
    return nanoid();
  }

  /**
   * Generate a unique ID with custom length
   */
  static generateWithLength(length: number): string {
    return nanoid(length);
  }

  /**
   * Generate a unique ID with custom alphabet
   */
  static generateWithAlphabet(alphabet: string, length: number = 21): string {
    const customNanoid = customAlphabet(alphabet, length);
    return customNanoid();
  }

  // Enhanced functionality from older version

  /**
   * Generate a UUID v4
   */
  static generateUuid(): string {
    return randomUUID();
  }

  /**
   * Generate a short ID (8 characters)
   */
  static generateShortId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  /**
   * Generate a numeric ID
   */
  static generateNumericId(): number {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  /**
   * Validate UUID format
   */
  static isValidUuid(id: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  /**
   * Generate prefixed ID
   */
  static generatePrefixedId(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
  }

  /**
   * Generate URL-safe ID
   */
  static generateUrlSafeId(length: number = 21): string {
    const alphabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const customNanoid = customAlphabet(alphabet, length);
    return customNanoid();
  }

  /**
   * Generate numeric-only ID
   */
  static generateNumericOnlyId(length: number = 10): string {
    const alphabet = '0123456789';
    const customNanoid = customAlphabet(alphabet, length);
    return customNanoid();
  }

  /**
   * Generate alphanumeric ID (no special characters)
   */
  static generateAlphanumericId(length: number = 21): string {
    const alphabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const customNanoid = customAlphabet(alphabet, length);
    return customNanoid();
  }
}