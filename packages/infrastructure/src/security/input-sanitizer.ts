export interface SanitizationOptions {
  allowHtml?: boolean;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  maxLength?: number;
  stripWhitespace?: boolean;
}

export interface InputSanitizer {
  /**
   * Sanitize a string input
   */
  sanitizeString(input: string, options?: SanitizationOptions): string;

  /**
   * Sanitize an object recursively
   */
  sanitizeObject<T>(obj: T, options?: SanitizationOptions): T;

  /**
   * Validate and sanitize email
   */
  sanitizeEmail(email: string): string | null;

  /**
   * Validate and sanitize URL
   */
  sanitizeUrl(url: string): string | null;

  /**
   * Remove potentially dangerous characters
   */
  removeDangerousChars(input: string): string;
}

export class DefaultInputSanitizer implements InputSanitizer {
  private readonly dangerousChars = /[<>'"&\x00-\x1f\x7f-\x9f]/g;
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private readonly urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

  sanitizeString(input: string, options: SanitizationOptions = {}): string {
    if (typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Strip whitespace if requested
    if (options.stripWhitespace) {
      sanitized = sanitized.trim();
    }

    // Apply max length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    // Handle HTML
    if (!options.allowHtml) {
      sanitized = this.stripHtml(sanitized);
    } else if (options.allowedTags) {
      sanitized = this.sanitizeHtml(sanitized, options.allowedTags, options.allowedAttributes);
    }

    // Remove dangerous characters
    sanitized = this.removeDangerousChars(sanitized);

    return sanitized;
  }

  sanitizeObject<T>(obj: T, options: SanitizationOptions = {}): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj, options) as T;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, options)) as T;
    }

    if (typeof obj === 'object') {
      const sanitized = {} as T;
      for (const [key, value] of Object.entries(obj)) {
        (sanitized as any)[key] = this.sanitizeObject(value, options);
      }
      return sanitized;
    }

    return obj;
  }

  sanitizeEmail(email: string): string | null {
    if (typeof email !== 'string') {
      return null;
    }

    const sanitized = email.trim().toLowerCase();
    
    if (!this.emailRegex.test(sanitized)) {
      return null;
    }

    // Additional email sanitization
    const cleaned = sanitized.replace(/[^\w@.-]/g, '');
    
    return this.emailRegex.test(cleaned) ? cleaned : null;
  }

  sanitizeUrl(url: string): string | null {
    if (typeof url !== 'string') {
      return null;
    }

    const sanitized = url.trim();
    
    if (!this.urlRegex.test(sanitized)) {
      return null;
    }

    try {
      const urlObj = new URL(sanitized);
      
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return null;
      }

      return urlObj.toString();
    } catch {
      return null;
    }
  }

  removeDangerousChars(input: string): string {
    return input.replace(this.dangerousChars, '');
  }

  private stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '');
  }

  private sanitizeHtml(
    input: string,
    allowedTags: string[],
    allowedAttributes: Record<string, string[]> = {}
  ): string {
    // Simple HTML sanitization (in production, use a proper library like DOMPurify)
    let sanitized = input;

    // Remove all tags except allowed ones
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    sanitized = sanitized.replace(tagRegex, (match, tagName) => {
      if (allowedTags.includes(tagName.toLowerCase())) {
        // Sanitize attributes if tag is allowed
        return this.sanitizeAttributes(match, tagName, allowedAttributes);
      }
      return '';
    });

    return sanitized;
  }

  private sanitizeAttributes(
    tag: string,
    tagName: string,
    allowedAttributes: Record<string, string[]>
  ): string {
    const allowedAttrs = allowedAttributes[tagName.toLowerCase()] || [];
    
    if (allowedAttrs.length === 0) {
      // Return tag without attributes
      return `<${tagName}>`;
    }

    // Simple attribute sanitization (in production, use a proper parser)
    const attrRegex = /(\w+)=["']([^"']*)["']/g;
    let sanitizedTag = `<${tagName}`;
    
    let match;
    while ((match = attrRegex.exec(tag)) !== null) {
      const [, attrName, attrValue] = match;
      if (allowedAttrs.includes(attrName.toLowerCase())) {
        const sanitizedValue = this.sanitizeString(attrValue);
        sanitizedTag += ` ${attrName}="${sanitizedValue}"`;
      }
    }
    
    sanitizedTag += '>';
    return sanitizedTag;
  }
}

/**
 * Create default input sanitizer
 */
export function createInputSanitizer(): DefaultInputSanitizer {
  return new DefaultInputSanitizer();
}