/**
 * Input sanitization utilities
 */

export class InputSanitizer {
  /**
   * Sanitize HTML content by removing dangerous tags and attributes
   */
  static sanitizeHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove object tags
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '') // Remove embed tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/vbscript:/gi, '') // Remove vbscript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Sanitize string by removing control characters and normalizing whitespace
   */
  static sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Sanitize email by normalizing and validating format
   */
  static sanitizeEmail(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ''); // Remove any whitespace
  }

  /**
   * Sanitize phone number by removing non-digit characters except + and spaces
   */
  static sanitizePhoneNumber(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[^\d\+\s\-\(\)]/g, '') // Keep only digits, +, spaces, hyphens, parentheses
      .trim();
  }

  /**
   * Sanitize URL by validating and normalizing
   */
  static sanitizeUrl(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    try {
      const url = new URL(input.trim());
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(url.protocol)) {
        return '';
      }
      return url.toString();
    } catch {
      return '';
    }
  }

  /**
   * Sanitize slug by converting to lowercase and replacing invalid characters
   */
  static sanitizeSlug(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s\-]/g, '') // Remove invalid characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Sanitize filename by removing invalid characters
   */
  static sanitizeFilename(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove invalid filename characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 255); // Limit length
  }

  /**
   * Sanitize JSON string by parsing and re-stringifying
   */
  static sanitizeJson(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    try {
      const parsed = JSON.parse(input);
      return JSON.stringify(parsed);
    } catch {
      return '';
    }
  }

  /**
   * Sanitize SQL input by escaping dangerous characters
   */
  static sanitizeSql(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/'/g, "''") // Escape single quotes
      .replace(/;/g, '') // Remove semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove SQL block comments start
      .replace(/\*\//g, '') // Remove SQL block comments end
      .trim();
  }

  /**
   * Sanitize array of strings
   */
  static sanitizeStringArray(input: string[]): string[] {
    if (!Array.isArray(input)) {
      return [];
    }

    return input
      .filter(item => typeof item === 'string')
      .map(item => this.sanitizeString(item))
      .filter(item => item.length > 0);
  }

  /**
   * Sanitize object by recursively sanitizing string values
   */
  static sanitizeObject(input: Record<string, any>): Record<string, any> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return {};
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(input)) {
      const sanitizedKey = this.sanitizeString(key);
      
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeString(value);
      } else if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.map(item => 
          typeof item === 'string' ? this.sanitizeString(item) : item
        );
      } else if (value && typeof value === 'object') {
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }

    return sanitized;
  }

  /**
   * Remove XSS attempts from input
   */
  static removeXss(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/style\s*=/gi, '')
      .replace(/expression\s*\(/gi, '')
      .replace(/url\s*\(/gi, '')
      .replace(/@import/gi, '')
      .replace(/&lt;script/gi, '')
      .replace(/&lt;\/script/gi, '');
  }

  /**
   * Sanitize input for SQL LIKE queries
   */
  static sanitizeLikeQuery(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[%_\\]/g, '\\$&') // Escape LIKE wildcards
      .replace(/'/g, "''") // Escape single quotes
      .trim();
  }
}