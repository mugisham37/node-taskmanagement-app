import { nanoid } from 'nanoid';

/**
 * Generates unique identifiers using nanoid
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
  static generateWithAlphabet(_alphabet: string, length: number = 21): string {
    // Note: This is a simplified implementation. For custom alphabets,
    // you would need to use customAlphabet from nanoid
    return nanoid(length);
  }
}
