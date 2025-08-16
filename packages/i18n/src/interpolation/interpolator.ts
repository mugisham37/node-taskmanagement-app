export interface InterpolationOptions {
  escapeValue?: boolean;
  prefix?: string;
  suffix?: string;
  formatSeparator?: string;
  unescapePrefix?: string;
  unescapeSuffix?: string;
  nestingPrefix?: string;
  nestingSuffix?: string;
  maxReplaces?: number;
  skipOnVariables?: boolean;
}

export interface InterpolationContext {
  [key: string]: any;
}

export interface FormatFunction {
  (value: any, format: string, lng: string, options: InterpolationOptions): string;
}

export class Interpolator {
  private options: Required<InterpolationOptions>;
  private formatters: Map<string, FormatFunction> = new Map();
  private nestingRegex: RegExp;
  private interpolationRegex: RegExp;
  private unescapeRegex: RegExp;

  constructor(options: InterpolationOptions = {}) {
    this.options = {
      escapeValue: true,
      prefix: '{{',
      suffix: '}}',
      formatSeparator: ',',
      unescapePrefix: '-',
      unescapeSuffix: '',
      nestingPrefix: '$t(',
      nestingSuffix: ')',
      maxReplaces: 1000,
      skipOnVariables: true,
      ...options,
    };

    this.updateRegexes();
    this.initializeDefaultFormatters();
  }

  /**
   * Interpolate variables in a string
   */
  interpolate(
    str: string,
    data: InterpolationContext = {},
    lng = 'en',
    options: Partial<InterpolationOptions> = {}
  ): string {
    const opts = { ...this.options, ...options };
    let result = str;
    let replaceCount = 0;

    // Handle nesting first
    result = this.handleNesting(result, data, lng, opts);

    // Handle interpolation
    result = this.handleInterpolation(result, data, lng, opts, replaceCount);

    return result;
  }

  /**
   * Handle variable interpolation
   */
  private handleInterpolation(
    str: string,
    data: InterpolationContext,
    lng: string,
    options: Required<InterpolationOptions>,
    replaceCount: number
  ): string {
    return str.replace(this.interpolationRegex, (match, key, format) => {
      if (replaceCount >= options.maxReplaces) {
        return match;
      }
      replaceCount++;

      const trimmedKey = key.trim();
      
      // Check for unescape prefix
      let shouldEscape = options.escapeValue;
      let actualKey = trimmedKey;
      
      if (trimmedKey.startsWith(options.unescapePrefix)) {
        shouldEscape = false;
        actualKey = trimmedKey.slice(options.unescapePrefix.length);
      }

      // Get value from data
      let value = this.getValueFromData(data, actualKey);

      if (value === undefined || value === null) {
        if (options.skipOnVariables) {
          return match;
        }
        value = '';
      }

      // Apply formatting if specified
      if (format && this.formatters.has(format)) {
        const formatter = this.formatters.get(format)!;
        value = formatter(value, format, lng, options);
      }

      // Convert to string
      let stringValue = String(value);

      // Apply escaping
      if (shouldEscape) {
        stringValue = this.escapeValue(stringValue);
      }

      return stringValue;
    });
  }

  /**
   * Handle nesting (calling other translation keys)
   */
  private handleNesting(
    str: string,
    data: InterpolationContext,
    lng: string,
    options: Required<InterpolationOptions>
  ): string {
    // This would need access to the translation function
    // For now, we'll just return the string as-is
    // In a real implementation, this would resolve nested translation keys
    return str;
  }

  /**
   * Get value from data object using dot notation
   */
  private getValueFromData(data: InterpolationContext, key: string): any {
    const keys = key.split('.');
    let current = data;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Escape HTML characters
   */
  private escapeValue(value: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
    };

    return value.replace(/[&<>"'/]/g, (match) => htmlEscapes[match] || match);
  }

  /**
   * Update regex patterns based on current options
   */
  private updateRegexes(): void {
    const { prefix, suffix, formatSeparator, nestingPrefix, nestingSuffix } = this.options;

    // Escape special regex characters
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const escapedPrefix = escapeRegex(prefix);
    const escapedSuffix = escapeRegex(suffix);
    const escapedFormatSeparator = escapeRegex(formatSeparator);
    const escapedNestingPrefix = escapeRegex(nestingPrefix);
    const escapedNestingSuffix = escapeRegex(nestingSuffix);

    // Interpolation regex: {{key}} or {{key, format}}
    this.interpolationRegex = new RegExp(
      `${escapedPrefix}\\s*([^${escapedSuffix}]+?)(?:${escapedFormatSeparator}\\s*([^${escapedSuffix}]+?))?\\s*${escapedSuffix}`,
      'g'
    );

    // Nesting regex: $t(key) or $t(key, options)
    this.nestingRegex = new RegExp(
      `${escapedNestingPrefix}([^${escapedNestingSuffix}]+)${escapedNestingSuffix}`,
      'g'
    );

    // Unescape regex
    this.unescapeRegex = new RegExp(
      `${escapeRegex(this.options.unescapePrefix)}(.+?)${escapeRegex(this.options.unescapeSuffix)}`,
      'g'
    );
  }

  /**
   * Register a custom formatter
   */
  registerFormatter(name: string, formatter: FormatFunction): void {
    this.formatters.set(name, formatter);
  }

  /**
   * Unregister a formatter
   */
  unregisterFormatter(name: string): void {
    this.formatters.delete(name);
  }

  /**
   * Get all registered formatters
   */
  getFormatters(): string[] {
    return Array.from(this.formatters.keys());
  }

  /**
   * Initialize default formatters
   */
  private initializeDefaultFormatters(): void {
    // Number formatter
    this.registerFormatter('number', (value, format, lng) => {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      
      return new Intl.NumberFormat(lng).format(num);
    });

    // Currency formatter
    this.registerFormatter('currency', (value, format, lng) => {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      
      // Extract currency code from format (e.g., "currency:USD")
      const parts = format.split(':');
      const currency = parts[1] || 'USD';
      
      return new Intl.NumberFormat(lng, {
        style: 'currency',
        currency,
      }).format(num);
    });

    // Date formatter
    this.registerFormatter('date', (value, format, lng) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      
      // Extract date format from format (e.g., "date:short")
      const parts = format.split(':');
      const dateStyle = parts[1] as 'short' | 'medium' | 'long' | 'full' || 'medium';
      
      return new Intl.DateTimeFormat(lng, {
        dateStyle,
      }).format(date);
    });

    // Time formatter
    this.registerFormatter('time', (value, format, lng) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      
      // Extract time format from format (e.g., "time:short")
      const parts = format.split(':');
      const timeStyle = parts[1] as 'short' | 'medium' | 'long' | 'full' || 'medium';
      
      return new Intl.DateTimeFormat(lng, {
        timeStyle,
      }).format(date);
    });

    // Relative time formatter
    this.registerFormatter('relative', (value, format, lng) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      
      const now = new Date();
      const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);
      
      return new Intl.RelativeTimeFormat(lng).format(diffInSeconds, 'second');
    });

    // Uppercase formatter
    this.registerFormatter('uppercase', (value) => {
      return String(value).toUpperCase();
    });

    // Lowercase formatter
    this.registerFormatter('lowercase', (value) => {
      return String(value).toLowerCase();
    });

    // Capitalize formatter
    this.registerFormatter('capitalize', (value) => {
      const str = String(value);
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    // Truncate formatter
    this.registerFormatter('truncate', (value, format) => {
      const str = String(value);
      const parts = format.split(':');
      const length = parseInt(parts[1]) || 50;
      const suffix = parts[2] || '...';
      
      if (str.length <= length) return str;
      return str.slice(0, length) + suffix;
    });
  }

  /**
   * Update interpolation options
   */
  updateOptions(newOptions: Partial<InterpolationOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.updateRegexes();
  }

  /**
   * Reset to default options
   */
  reset(): void {
    this.options = {
      escapeValue: true,
      prefix: '{{',
      suffix: '}}',
      formatSeparator: ',',
      unescapePrefix: '-',
      unescapeSuffix: '',
      nestingPrefix: '$t(',
      nestingSuffix: ')',
      maxReplaces: 1000,
      skipOnVariables: true,
    };
    this.updateRegexes();
  }
}