export interface NumberFormatterOptions {
  locale?: string;
  style?: 'decimal' | 'currency' | 'percent' | 'unit';
  currency?: string;
  unit?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
  notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
}

export class NumberFormatter {
  /**
   * Format number according to locale and options
   */
  static formatNumber(
    number: number,
    options: NumberFormatterOptions = {}
  ): string {
    const {
      locale = 'en',
      style = 'decimal',
      currency = 'USD',
      unit,
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping = true,
      notation = 'standard',
    } = options;

    const formatOptions: Intl.NumberFormatOptions = {
      style,
      useGrouping,
      notation,
    };

    if (style === 'currency') {
      formatOptions.currency = currency;
    }

    if (style === 'unit' && unit) {
      formatOptions.unit = unit;
    }

    if (minimumFractionDigits !== undefined) {
      formatOptions.minimumFractionDigits = minimumFractionDigits;
    }

    if (maximumFractionDigits !== undefined) {
      formatOptions.maximumFractionDigits = maximumFractionDigits;
    }

    return new Intl.NumberFormat(locale, formatOptions).format(number);
  }

  /**
   * Format currency with proper symbol and formatting
   */
  static formatCurrency(
    amount: number,
    currency: string,
    locale = 'en'
  ): string {
    return this.formatNumber(amount, {
      locale,
      style: 'currency',
      currency,
    });
  }

  /**
   * Format percentage
   */
  static formatPercentage(
    value: number,
    locale = 'en',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2
  ): string {
    return this.formatNumber(value / 100, {
      locale,
      style: 'percent',
      minimumFractionDigits,
      maximumFractionDigits,
    });
  }

  /**
   * Format file size in bytes to human readable format
   */
  static formatFileSize(
    bytes: number,
    locale = 'en',
    binary = false
  ): string {
    const base = binary ? 1024 : 1000;
    const units = binary
      ? ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
      : ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

    if (bytes === 0) return '0 B';

    const exponent = Math.floor(Math.log(bytes) / Math.log(base));
    const value = bytes / Math.pow(base, exponent);

    const formattedValue = this.formatNumber(value, {
      locale,
      maximumFractionDigits: exponent === 0 ? 0 : 1,
    });

    return `${formattedValue} ${units[exponent]}`;
  }

  /**
   * Format duration in milliseconds to human readable format
   */
  static formatDuration(
    milliseconds: number,
    locale = 'en',
    options: {
      units?: ('days' | 'hours' | 'minutes' | 'seconds')[];
      compact?: boolean;
    } = {}
  ): string {
    const { units = ['days', 'hours', 'minutes', 'seconds'], compact = false } = options;

    const durations = {
      days: Math.floor(milliseconds / (1000 * 60 * 60 * 24)),
      hours: Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((milliseconds % (1000 * 60)) / 1000),
    };

    const parts: string[] = [];

    for (const unit of units) {
      const value = durations[unit];
      if (value > 0) {
        if (compact) {
          const shortUnit = unit.charAt(0);
          parts.push(`${value}${shortUnit}`);
        } else {
          const unitLabel = value === 1 ? unit.slice(0, -1) : unit;
          parts.push(`${value} ${unitLabel}`);
        }
      }
    }

    return parts.length > 0 ? parts.join(compact ? ' ' : ', ') : '0 seconds';
  }

  /**
   * Format ordinal numbers (1st, 2nd, 3rd, etc.)
   */
  static formatOrdinal(
    number: number,
    locale = 'en'
  ): string {
    const pr = new Intl.PluralRules(locale, { type: 'ordinal' });
    const suffixes = new Map([
      ['one', 'st'],
      ['two', 'nd'],
      ['few', 'rd'],
      ['other', 'th'],
    ]);

    const rule = pr.select(number);
    const suffix = suffixes.get(rule) || 'th';

    return `${number}${suffix}`;
  }

  /**
   * Format compact numbers (1K, 1M, 1B, etc.)
   */
  static formatCompact(
    number: number,
    locale = 'en',
    notation: 'short' | 'long' = 'short'
  ): string {
    return this.formatNumber(number, {
      locale,
      notation: 'compact',
      compactDisplay: notation,
    } as NumberFormatterOptions);
  }
}