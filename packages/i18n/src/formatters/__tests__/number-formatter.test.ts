import { describe, expect, it } from 'vitest';
import { NumberFormatter } from '../number-formatter';

describe('NumberFormatter', () => {
  const formatter = new NumberFormatter();

  describe('Basic Number Formatting', () => {
    it('should format integers', () => {
      const result = formatter.format(1234, 'en');
      expect(typeof result).toBe('string');
      expect(result).toContain('1');
    });

    it('should format decimals', () => {
      const result = formatter.format(1234.56, 'en');
      expect(typeof result).toBe('string');
      expect(result).toContain('1234');
    });

    it('should handle different locales', () => {
      const enResult = formatter.format(1234.56, 'en');
      const deResult = formatter.format(1234.56, 'de');
      
      expect(typeof enResult).toBe('string');
      expect(typeof deResult).toBe('string');
      // Different locales may use different separators
    });
  });

  describe('Currency Formatting', () => {
    it('should format currency', () => {
      const result = formatter.formatCurrency(1234.56, 'USD', 'en');
      expect(typeof result).toBe('string');
      expect(result).toContain('1234');
    });

    it('should handle different currencies', () => {
      const usdResult = formatter.formatCurrency(1234.56, 'USD', 'en');
      const eurResult = formatter.formatCurrency(1234.56, 'EUR', 'en');
      
      expect(typeof usdResult).toBe('string');
      expect(typeof eurResult).toBe('string');
      expect(usdResult).not.toBe(eurResult);
    });

    it('should handle different locales for currency', () => {
      const enResult = formatter.formatCurrency(1234.56, 'USD', 'en');
      const deResult = formatter.formatCurrency(1234.56, 'USD', 'de');
      
      expect(typeof enResult).toBe('string');
      expect(typeof deResult).toBe('string');
    });
  });

  describe('Percentage Formatting', () => {
    it('should format percentages', () => {
      const result = formatter.formatPercentage(0.1234, 'en');
      expect(typeof result).toBe('string');
      expect(result).toContain('%');
    });

    it('should handle different precision', () => {
      const options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
      const result = formatter.formatPercentage(0.1234, 'en', options);
      expect(typeof result).toBe('string');
      expect(result).toContain('%');
    });
  });

  describe('Custom Options', () => {
    it('should respect custom formatting options', () => {
      const options = {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
      };
      
      const result = formatter.format(1234.5, 'en', options);
      expect(typeof result).toBe('string');
      expect(result).toContain('1234');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid numbers', () => {
      const result = formatter.format(NaN, 'en');
      expect(typeof result).toBe('string');
    });

    it('should handle infinity', () => {
      const result = formatter.format(Infinity, 'en');
      expect(typeof result).toBe('string');
    });

    it('should handle invalid locales gracefully', () => {
      const result = formatter.format(1234, 'invalid-locale');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});