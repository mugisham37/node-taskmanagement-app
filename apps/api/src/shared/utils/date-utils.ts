/**
 * Enhanced utility functions for date manipulation and validation
 * Combines existing functionality with advanced date operations
 */
export class DateUtils {
  /**
   * Check if a date is in the past
   */
  static isPast(date: Date): boolean {
    return date < new Date();
  }

  /**
   * Check if a date is in the future
   */
  static isFuture(date: Date): boolean {
    return date > new Date();
  }

  /**
   * Check if a date is today
   */
  static isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  /**
   * Check if a date is within a certain number of days from now
   */
  static isWithinDays(date: Date, days: number): boolean {
    const now = new Date();
    const diffTime = Math.abs(date.getTime() - now.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days;
  }

  /**
   * Add days to a date
   */
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Add hours to a date
   */
  static addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  /**
   * Add minutes to a date
   */
  static addMinutes(date: Date, minutes: number): Date {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  /**
   * Get the start of day for a date
   */
  static startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get the end of day for a date
   */
  static endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Format a date as ISO string
   */
  static toISOString(date: Date): string {
    return date.toISOString();
  }

  /**
   * Parse an ISO string to date
   */
  static fromISOString(isoString: string): Date {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid ISO date string: ${isoString}`);
    }
    return date;
  }

  /**
   * Get the difference in days between two dates
   */
  static daysBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get the difference in hours between two dates
   */
  static hoursBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60));
  }

  /**
   * Check if a date is a valid date object
   */
  static isValidDate(date: any): date is Date {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Get the current timestamp
   */
  static now(): Date {
    return new Date();
  }

  /**
   * Get the current timestamp as ISO string
   */
  static nowISO(): string {
    return new Date().toISOString();
  }

  /**
   * Create a date from timestamp
   */
  static fromTimestamp(timestamp: number): Date {
    return new Date(timestamp);
  }

  /**
   * Get timestamp from date
   */
  static toTimestamp(date: Date): number {
    return date.getTime();
  }

  // Enhanced functionality from older version

  /**
   * Get current timestamp (alias for now)
   */
  static getCurrentTimestamp(): Date {
    return new Date();
  }

  /**
   * Format date to ISO string (alias for toISOString)
   */
  static formatToISOString(date: Date): string {
    return date.toISOString();
  }

  /**
   * Parse ISO string to date (alias for fromISOString)
   */
  static parseISOString(isoString: string): Date {
    return new Date(isoString);
  }

  /**
   * Check if date is in the past (alias for isPast)
   */
  static isInPast(date: Date): boolean {
    return date < new Date();
  }

  /**
   * Check if date is in the future (alias for isFuture)
   */
  static isInFuture(date: Date): boolean {
    return date > new Date();
  }

  /**
   * Get start of day (alias for startOfDay)
   */
  static getStartOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get end of day (alias for endOfDay)
   */
  static getEndOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }
}
