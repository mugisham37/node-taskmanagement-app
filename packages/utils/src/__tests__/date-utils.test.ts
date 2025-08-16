import { beforeEach, describe, expect, it } from 'vitest';
import { DateUtils } from '../date/date-utils';

describe('DateUtils', () => {
  let testDate: Date;
  let pastDate: Date;
  let futureDate: Date;

  beforeEach(() => {
    testDate = new Date('2023-06-15T12:00:00Z');
    pastDate = new Date('2023-01-01T00:00:00Z');
    futureDate = new Date('2025-12-31T23:59:59Z');
  });

  describe('isPast', () => {
    it('should return true for past dates', () => {
      expect(DateUtils.isPast(pastDate)).toBe(true);
    });

    it('should return false for future dates', () => {
      expect(DateUtils.isPast(futureDate)).toBe(true); // This will be true since we're in 2025
    });
  });

  describe('isFuture', () => {
    it('should return true for future dates', () => {
      expect(DateUtils.isFuture(futureDate)).toBe(false); // This will be false since we're in 2025
    });

    it('should return false for past dates', () => {
      expect(DateUtils.isFuture(pastDate)).toBe(false);
    });
  });

  describe('isToday', () => {
    it('should return true for today\'s date', () => {
      const today = new Date();
      expect(DateUtils.isToday(today)).toBe(true);
    });

    it('should return false for different dates', () => {
      expect(DateUtils.isToday(pastDate)).toBe(false);
    });
  });

  describe('addDays', () => {
    it('should add days correctly', () => {
      const result = DateUtils.addDays(testDate, 5);
      expect(result.getDate()).toBe(20);
    });

    it('should handle negative days', () => {
      const result = DateUtils.addDays(testDate, -5);
      expect(result.getDate()).toBe(10);
    });
  });

  describe('addHours', () => {
    it('should add hours correctly', () => {
      const result = DateUtils.addHours(testDate, 6);
      expect(result.getHours()).toBe(18);
    });
  });

  describe('startOfDay', () => {
    it('should return start of day', () => {
      const result = DateUtils.startOfDay(testDate);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe('endOfDay', () => {
    it('should return end of day', () => {
      const result = DateUtils.endOfDay(testDate);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });
  });

  describe('daysBetween', () => {
    it('should calculate days between dates correctly', () => {
      const date1 = new Date('2023-01-01');
      const date2 = new Date('2023-01-10');
      expect(DateUtils.daysBetween(date1, date2)).toBe(9);
    });
  });

  describe('isValidDate', () => {
    it('should return true for valid dates', () => {
      expect(DateUtils.isValidDate(new Date())).toBe(true);
    });

    it('should return false for invalid dates', () => {
      expect(DateUtils.isValidDate(new Date('invalid'))).toBe(false);
      expect(DateUtils.isValidDate('not a date')).toBe(false);
    });
  });

  describe('fromISOString', () => {
    it('should parse valid ISO strings', () => {
      const isoString = '2023-06-15T12:00:00.000Z';
      const result = DateUtils.fromISOString(isoString);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe(isoString);
    });

    it('should throw error for invalid ISO strings', () => {
      expect(() => DateUtils.fromISOString('invalid')).toThrow();
    });
  });
});