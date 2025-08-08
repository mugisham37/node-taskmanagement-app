/**
 * Date and time utilities
 */

/**
 * Get current timestamp
 */
export function getCurrentTimestamp(): Date {
  return new Date();
}

/**
 * Format date to ISO string
 */
export function formatToISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Parse ISO string to date
 */
export function parseISOString(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Add days to date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add hours to date
 */
export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Add minutes to date
 */
export function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/**
 * Check if date is in the past
 */
export function isInPast(date: Date): boolean {
  return date < new Date();
}

/**
 * Check if date is in the future
 */
export function isInFuture(date: Date): boolean {
  return date > new Date();
}

/**
 * Get start of day
 */
export function getStartOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day
 */
export function getEndOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}
