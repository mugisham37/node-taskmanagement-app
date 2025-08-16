/**
 * Data transformation utilities for validation
 */

export class DataTransformer {
  /**
   * Transform string to boolean
   */
  static toBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return ['true', '1', 'yes', 'on'].includes(lower);
    }
    
    if (typeof value === 'number') {
      return value !== 0;
    }
    
    return false;
  }

  /**
   * Transform string to number
   */
  static toNumber(value: any): number | null {
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return null;
      
      const parsed = Number(trimmed);
      return isNaN(parsed) ? null : parsed;
    }
    
    return null;
  }

  /**
   * Transform string to integer
   */
  static toInteger(value: any): number | null {
    const num = this.toNumber(value);
    return num !== null ? Math.floor(num) : null;
  }

  /**
   * Transform string to float
   */
  static toFloat(value: any): number | null {
    return this.toNumber(value);
  }

  /**
   * Transform value to string
   */
  static toString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    return String(value);
  }

  /**
   * Transform string to date
   */
  static toDate(value: any): Date | null {
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    
    return null;
  }

  /**
   * Transform string to ISO date string
   */
  static toISOString(value: any): string | null {
    const date = this.toDate(value);
    return date ? date.toISOString() : null;
  }

  /**
   * Transform array-like value to array
   */
  static toArray(value: any): any[] {
    if (Array.isArray(value)) {
      return value;
    }
    
    if (value === null || value === undefined) {
      return [];
    }
    
    if (typeof value === 'string') {
      // Try to parse as JSON array
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        // Split by comma if it contains commas
        return value.includes(',') ? value.split(',').map(s => s.trim()) : [value];
      }
    }
    
    return [value];
  }

  /**
   * Transform value to object
   */
  static toObject(value: any): Record<string, any> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }
    
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    
    return {};
  }

  /**
   * Transform string to slug
   */
  static toSlug(value: any): string {
    const str = this.toString(value);
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Transform string to title case
   */
  static toTitleCase(value: any): string {
    const str = this.toString(value);
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  /**
   * Transform string to camelCase
   */
  static toCamelCase(value: any): string {
    const str = this.toString(value);
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => 
        index === 0 ? word.toLowerCase() : word.toUpperCase()
      )
      .replace(/\s+/g, '');
  }

  /**
   * Transform string to PascalCase
   */
  static toPascalCase(value: any): string {
    const str = this.toString(value);
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
      .replace(/\s+/g, '');
  }

  /**
   * Transform string to snake_case
   */
  static toSnakeCase(value: any): string {
    const str = this.toString(value);
    return str
      .replace(/\W+/g, ' ')
      .split(/ |\B(?=[A-Z])/)
      .map(word => word.toLowerCase())
      .join('_');
  }

  /**
   * Transform string to kebab-case
   */
  static toKebabCase(value: any): string {
    const str = this.toString(value);
    return str
      .replace(/\W+/g, ' ')
      .split(/ |\B(?=[A-Z])/)
      .map(word => word.toLowerCase())
      .join('-');
  }

  /**
   * Trim whitespace from string
   */
  static trim(value: any): string {
    return this.toString(value).trim();
  }

  /**
   * Transform to lowercase
   */
  static toLowerCase(value: any): string {
    return this.toString(value).toLowerCase();
  }

  /**
   * Transform to uppercase
   */
  static toUpperCase(value: any): string {
    return this.toString(value).toUpperCase();
  }

  /**
   * Normalize email address
   */
  static normalizeEmail(value: any): string {
    const email = this.toString(value).toLowerCase().trim();
    
    // Basic email normalization
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) {
      return email;
    }
    
    // Remove dots from Gmail addresses (gmail.com and googlemail.com)
    if (['gmail.com', 'googlemail.com'].includes(domain)) {
      const normalizedLocal = localPart.replace(/\./g, '').split('+')[0];
      return `${normalizedLocal}@gmail.com`;
    }
    
    return email;
  }

  /**
   * Normalize phone number
   */
  static normalizePhoneNumber(value: any): string {
    const phone = this.toString(value);
    
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it starts with +, keep it; otherwise, assume it's a domestic number
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    // Add country code if missing (assuming US +1 for this example)
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    
    return cleaned;
  }

  /**
   * Transform currency string to number (remove currency symbols)
   */
  static toCurrency(value: any): number | null {
    const str = this.toString(value);
    
    // Remove currency symbols and spaces
    const cleaned = str.replace(/[$€£¥₹,\s]/g, '');
    
    return this.toNumber(cleaned);
  }

  /**
   * Transform percentage string to decimal
   */
  static percentageToDecimal(value: any): number | null {
    const str = this.toString(value);
    
    // Remove % symbol
    const cleaned = str.replace(/%/g, '');
    const num = this.toNumber(cleaned);
    
    return num !== null ? num / 100 : null;
  }

  /**
   * Transform decimal to percentage string
   */
  static decimalToPercentage(value: any): string {
    const num = this.toNumber(value);
    return num !== null ? `${(num * 100).toFixed(2)}%` : '0%';
  }

  /**
   * Deep clone an object
   */
  static deepClone<T>(value: T): T {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    if (value instanceof Date) {
      return new Date(value.getTime()) as T;
    }
    
    if (Array.isArray(value)) {
      return value.map(item => this.deepClone(item)) as T;
    }
    
    const cloned = {} as T;
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(value[key]);
      }
    }
    
    return cloned;
  }

  /**
   * Remove null and undefined values from object
   */
  static removeNullish(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          const nested = this.removeNullish(value);
          if (Object.keys(nested).length > 0) {
            result[key] = nested;
          }
        } else {
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  /**
   * Flatten nested object
   */
  static flatten(obj: Record<string, any>, prefix = '', separator = '.'): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}${separator}${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flatten(value, newKey, separator));
      } else {
        result[newKey] = value;
      }
    }
    
    return result;
  }
}