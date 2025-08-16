import { format, formatDistance, formatRelative, parseISO } from 'date-fns';
import { de, enUS, es, fr, zhCN } from 'date-fns/locale';

export interface DateFormatterOptions {
  locale?: string;
  format?: string;
  relative?: boolean;
  distance?: boolean;
  timezone?: string;
}

export class DateFormatter {
  private static localeMap = {
    en: enUS,
    es: es,
    de: de,
    fr: fr,
    zh: zhCN,
  };

  /**
   * Format date according to locale and options
   */
  static formatDate(
    date: Date | string,
    options: DateFormatterOptions = {}
  ): string {
    const {
      locale = 'en',
      format: formatString = 'PPP',
      relative = false,
      distance = false,
      timezone,
    } = options;

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const localeObj = this.localeMap[locale as keyof typeof this.localeMap] || enUS;

    if (relative) {
      return formatRelative(dateObj, new Date(), { locale: localeObj });
    }

    if (distance) {
      return formatDistance(dateObj, new Date(), {
        locale: localeObj,
        addSuffix: true,
      });
    }

    return format(dateObj, formatString, { locale: localeObj });
  }

  /**
   * Format date range
   */
  static formatDateRange(
    startDate: Date | string,
    endDate: Date | string,
    options: DateFormatterOptions = {}
  ): string {
    const { locale = 'en', format: formatString = 'PPP' } = options;
    const localeObj = this.localeMap[locale as keyof typeof this.localeMap] || enUS;

    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

    const startFormatted = format(start, formatString, { locale: localeObj });
    const endFormatted = format(end, formatString, { locale: localeObj });

    return `${startFormatted} - ${endFormatted}`;
  }

  /**
   * Format time according to locale
   */
  static formatTime(
    date: Date | string,
    options: DateFormatterOptions = {}
  ): string {
    const { locale = 'en', format: formatString = 'p' } = options;
    const localeObj = this.localeMap[locale as keyof typeof this.localeMap] || enUS;

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatString, { locale: localeObj });
  }

  /**
   * Get relative time (e.g., "2 hours ago", "in 3 days")
   */
  static getRelativeTime(
    date: Date | string,
    baseDate: Date = new Date(),
    locale = 'en'
  ): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const localeObj = this.localeMap[locale as keyof typeof this.localeMap] || enUS;

    return formatDistance(dateObj, baseDate, {
      locale: localeObj,
      addSuffix: true,
    });
  }

  /**
   * Check if date is today, yesterday, or tomorrow
   */
  static getDateLabel(
    date: Date | string,
    locale = 'en'
  ): 'today' | 'yesterday' | 'tomorrow' | null {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateString = format(dateObj, 'yyyy-MM-dd');
    const todayString = format(today, 'yyyy-MM-dd');
    const yesterdayString = format(yesterday, 'yyyy-MM-dd');
    const tomorrowString = format(tomorrow, 'yyyy-MM-dd');

    if (dateString === todayString) return 'today';
    if (dateString === yesterdayString) return 'yesterday';
    if (dateString === tomorrowString) return 'tomorrow';
    return null;
  }
}