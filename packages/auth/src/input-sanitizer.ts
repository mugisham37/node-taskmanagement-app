import { LoggingService } from '@taskmanagement/core';
import DOMPurify from 'isomorphic-dompurify';

export interface SanitizationOptions {
  allowHtml?: boolean;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  maxLength?: number;
  trimWhitespace?: boolean;
  removeNullBytes?: boolean;
  preventXSS?: boolean;
}

export interface SanitizationResult {
  sanitized: string;
  wasModified: boolean;
  removedContent?: string[];
}

export class InputSanitizer {
  private readonly defaultOptions: Required<SanitizationOptions> = {
    allowHtml: false,
    allowedTags: [],
    allowedAttributes: {},
    maxLength: 10000,
    trimWhitespace: true,
    removeNullBytes: true,
    preventXSS: true,
  };

  constructor(private readonly logger: LoggingService) {}

  /**
   * Sanitize a single string input
   */
  sanitizeString(
    input: string,
    options: SanitizationOptions = {}
  ): SanitizationResult {
    if (typeof input !== 'string') {
      return {
        sanitized: '',
        wasModified: true,
        removedContent: ['non-string input'],
      };
    }

    const config = { ...this.defaultOptions, ...options };
    let sanitized = input;
    const removedContent: string[] = [];
    let wasModified = false;

    // Remove null bytes
    if (config.removeNullBytes && sanitized.includes('\0')) {
      sanitized = sanitized.replace(/\0/g, '');
      removedContent.push('null bytes');
      wasModified = true;
    }

    // Trim whitespace
    if (config.trimWhitespace) {
      const trimmed = sanitized.trim();
      if (trimmed !== sanitized) {
        sanitized = trimmed;
        wasModified = true;
      }
    }

    // Enforce max length
    if (config.maxLength && sanitized.length > config.maxLength) {
      sanitized = sanitized.substring(0, config.maxLength);
      removedContent.push(`content exceeding ${config.maxLength} characters`);
      wasModified = true;
    }

    // Handle HTML content
    if (config.allowHtml) {
      const purified = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: config.allowedTags,
        ALLOWED_ATTR: Object.keys(config.allowedAttributes),
      });
      if (purified !== sanitized) {
        sanitized = purified;
        removedContent.push('unsafe HTML content');
        wasModified = true;
      }
    } else {
      // Remove all HTML tags
      const withoutHtml = sanitized.replace(/<[^>]*>/g, '');
      if (withoutHtml !== sanitized) {
        sanitized = withoutHtml;
        removedContent.push('HTML tags');
        wasModified = true;
      }
    }

    // Prevent XSS attacks
    if (config.preventXSS) {
      const xssPatterns = [
        /javascript:/gi,
        /vbscript:/gi,
        /onload=/gi,
        /onerror=/gi,
        /onclick=/gi,
        /onmouseover=/gi,
        /onfocus=/gi,
        /onblur=/gi,
        /onchange=/gi,
        /onsubmit=/gi,
        /<script[^>]*>.*?<\/script>/gi,
        /<iframe[^>]*>.*?<\/iframe>/gi,
        /<object[^>]*>.*?<\/object>/gi,
        /<embed[^>]*>/gi,
        /<link[^>]*>/gi,
        /<meta[^>]*>/gi,
      ];

      for (const pattern of xssPatterns) {
        if (pattern.test(sanitized)) {
          sanitized = sanitized.replace(pattern, '');
          removedContent.push('potential XSS content');
          wasModified = true;
        }
      }
    }

    // Log suspicious content
    if (wasModified && removedContent.length > 0) {
      this.logger.warn('Input sanitization performed', {
        originalLength: input.length,
        sanitizedLength: sanitized.length,
        removedContent,
      });
    }

    const result: SanitizationResult = {
      sanitized,
      wasModified,
    };

    if (removedContent.length > 0) {
      result.removedContent = removedContent;
    }

    return result;
  }

  /**
   * Sanitize an object recursively
   */
  sanitizeObject(
    obj: any,
    options: SanitizationOptions = {}
  ): { sanitized: any; wasModified: boolean } {
    if (obj === null || obj === undefined) {
      return { sanitized: obj, wasModified: false };
    }

    if (typeof obj === 'string') {
      const result = this.sanitizeString(obj, options);
      return { sanitized: result.sanitized, wasModified: result.wasModified };
    }

    if (Array.isArray(obj)) {
      let wasModified = false;
      const sanitized = obj.map(item => {
        const result = this.sanitizeObject(item, options);
        if (result.wasModified) wasModified = true;
        return result.sanitized;
      });
      return { sanitized, wasModified };
    }

    if (typeof obj === 'object') {
      let wasModified = false;
      const sanitized: any = {};

      for (const [key, value] of Object.entries(obj)) {
        // Sanitize the key as well
        const keyResult = this.sanitizeString(key, {
          ...options,
          allowHtml: false,
          maxLength: 100,
        });

        const valueResult = this.sanitizeObject(value, options);

        if (keyResult.wasModified || valueResult.wasModified) {
          wasModified = true;
        }

        sanitized[keyResult.sanitized] = valueResult.sanitized;
      }

      return { sanitized, wasModified };
    }

    return { sanitized: obj, wasModified: false };
  }

  /**
   * Sanitize SQL input to prevent SQL injection
   */
  sanitizeSqlInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove or escape dangerous SQL characters and keywords
    return input
      .replace(/'/g, "''") // Escape single quotes
      .replace(/;/g, '') // Remove semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove block comment start
      .replace(/\*\//g, '') // Remove block comment end
      .replace(/\bUNION\b/gi, '') // Remove UNION keyword
      .replace(/\bSELECT\b/gi, '') // Remove SELECT keyword
      .replace(/\bINSERT\b/gi, '') // Remove INSERT keyword
      .replace(/\bUPDATE\b/gi, '') // Remove UPDATE keyword
      .replace(/\bDELETE\b/gi, '') // Remove DELETE keyword
      .replace(/\bDROP\b/gi, '') // Remove DROP keyword
      .replace(/\bCREATE\b/gi, '') // Remove CREATE keyword
      .replace(/\bALTER\b/gi, '') // Remove ALTER keyword
      .replace(/\bEXEC\b/gi, '') // Remove EXEC keyword
      .replace(/\bEXECUTE\b/gi, ''); // Remove EXECUTE keyword
  }

  /**
   * Validate and sanitize file paths
   */
  sanitizeFilePath(path: string): string {
    if (typeof path !== 'string') {
      return '';
    }

    // Remove dangerous path traversal patterns
    return path
      .replace(/\.\./g, '') // Remove parent directory references
      .replace(/\\/g, '/') // Normalize path separators
      .replace(/\/+/g, '/') // Remove multiple slashes
      .replace(/^\//, '') // Remove leading slash
      .replace(/\/$/, '') // Remove trailing slash
      .replace(/[<>:"|?*]/g, ''); // Remove invalid filename characters
  }

  /**
   * Sanitize email addresses
   */
  sanitizeEmail(email: string): string {
    if (typeof email !== 'string') {
      return '';
    }

    return email
      .toLowerCase()
      .trim()
      .replace(/[^\w@.-]/g, ''); // Keep only valid email characters
  }

  /**
   * Sanitize phone numbers
   */
  sanitizePhoneNumber(phone: string): string {
    if (typeof phone !== 'string') {
      return '';
    }

    return phone
      .replace(/[^\d+()-\s]/g, '') // Keep only valid phone characters
      .trim();
  }

  /**
   * Predefined sanitization configurations
   */
  static readonly STRICT: SanitizationOptions = {
    allowHtml: false,
    maxLength: 1000,
    trimWhitespace: true,
    removeNullBytes: true,
    preventXSS: true,
  };

  static readonly MODERATE: SanitizationOptions = {
    allowHtml: true,
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'],
    allowedAttributes: {},
    maxLength: 5000,
    trimWhitespace: true,
    removeNullBytes: true,
    preventXSS: true,
  };

  static readonly PERMISSIVE: SanitizationOptions = {
    allowHtml: true,
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'ol',
      'ul',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'code',
      'pre',
      'a',
      'img',
    ],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title'],
    },
    maxLength: 10000,
    trimWhitespace: true,
    removeNullBytes: true,
    preventXSS: true,
  };
}
