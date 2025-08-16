import { describe, expect, it } from 'vitest';
import { DateFormatter } from '../date-formatter';

describe('DateFormatter', () => {
  const formatter = new DateFormatter();
  const testDate = new Date('2023-12-25T15:30:00Z');

  describe('Basic Formatting', () => {
    it('should format date with default options', () => {
      const result = formatter.format(testDate, 'en');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format date with custom options', () => {
      const options = {
        year: 'numeric' as const,
        month: 'long' as const,
        day: 'numeric' as const,
      };
      
      const result = formatter.format(testDate, 'en', options);
      expect(result).toContain('December');
      expect(result).toContain('25');
      expect(result).toContain('2023');
    });

    it('should handle different locales', () => {
      const enResult = formatter.format(testDate, 'en');
      const esResult = formatter.format(testDate, 'es');
      
      expect(typeof enResult).toBe('string');
      expect(typeof esResult).toBe('string');
      // Results should be different for different locales
      expect(enResult).not.toBe(esResult);
    });
  });

  describe('Relative Time', () => {
    it('should format relative time', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60000); // 1 minute ago
      
      const result = formatter.formatRelative(pastDate, 'en');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle future dates', () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 60000); // 1 minute from now
      
      const result = formatter.formatRelative(futureDate, 'en');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Time Zones', () => {
    it('should format with timezone', () => {
      const options = {
        timeZone: 'America/New_York',
        timeZoneName: 'short' as const,
      };
      
      const result = formatter.format(testDate, 'en', options);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid dates', () => {
      const invalidDate = new Date('invalid');
      
      expect(() => {
        formatter.format(invalidDate, 'en');
      }).toThrow();
    });

    it('should handle invalid locales gracefully', () => {
      // Should fallback to default locale behavior
      const result = formatter.format(testDate, 'invalid-locale');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});