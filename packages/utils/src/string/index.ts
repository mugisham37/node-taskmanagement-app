/**
 * String utility functions
 */

export class StringUtils {
  /**
   * Capitalize the first letter of a string
   */
  static capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Convert string to camelCase
   */
  static toCamelCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, '');
  }

  /**
   * Convert string to kebab-case
   */
  static toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  /**
   * Convert string to snake_case
   */
  static toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  }

  /**
   * Truncate string to specified length
   */
  static truncate(str: string, length: number, suffix: string = '...'): string {
    if (str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
  }

  /**
   * Remove HTML tags from string
   */
  static stripHtml(str: string): string {
    return str.replace(/<[^>]*>/g, '');
  }

  /**
   * Escape HTML characters
   */
  static escapeHtml(str: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, (match) => htmlEscapes[match]);
  }

  /**
   * Generate a random string
   */
  static random(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Check if string is empty or whitespace
   */
  static isEmpty(str: string | null | undefined): boolean {
    return !str || str.trim().length === 0;
  }

  /**
   * Pad string to specified length
   */
  static pad(str: string, length: number, padChar: string = ' '): string {
    if (str.length >= length) return str;
    const padLength = length - str.length;
    const leftPad = Math.floor(padLength / 2);
    const rightPad = padLength - leftPad;
    return padChar.repeat(leftPad) + str + padChar.repeat(rightPad);
  }

  /**
   * Count words in string
   */
  static wordCount(str: string): number {
    return str.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Reverse a string
   */
  static reverse(str: string): string {
    return str.split('').reverse().join('');
  }

  /**
   * Check if string is a valid email
   */
  static isEmail(str: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(str);
  }

  /**
   * Check if string is a valid URL
   */
  static isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Slugify a string for URLs
   */
  static slugify(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}