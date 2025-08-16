import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { i18nManager, initializeI18n } from '../index';

describe('I18n Integration Tests', () => {
  beforeEach(async () => {
    // Reset i18n manager before each test
    await i18nManager.initialize({
      defaultLocale: 'en',
      fallbackLocale: 'en',
      namespaces: ['translation'],
    });
  });

  afterEach(() => {
    // Clean up after each test
    i18nManager.reset();
  });

  describe('Basic Translation', () => {
    it('should translate basic keys', () => {
      // Add test translations
      i18nManager.addTranslations('en', 'translation', {
        common: {
          success: 'Success',
          error: 'Error',
        },
      });

      expect(i18nManager.t('common.success')).toBe('Success');
      expect(i18nManager.t('common.error')).toBe('Error');
    });

    it('should handle missing translations with fallback', () => {
      const result = i18nManager.t('missing.key');
      expect(result).toBe('missing.key'); // Should return key as fallback
    });

    it('should handle interpolation', () => {
      i18nManager.addTranslations('en', 'translation', {
        greeting: 'Hello, {{name}}!',
      });

      const result = i18nManager.t('greeting', { name: 'John' });
      expect(result).toBe('Hello, John!');
    });
  });

  describe('Locale Management', () => {
    it('should set and get current locale', () => {
      i18nManager.setLocale('es');
      expect(i18nManager.getCurrentLocale()).toBe('es');
    });

    it('should list available locales', () => {
      const locales = i18nManager.getAvailableLocales();
      expect(Array.isArray(locales)).toBe(true);
      expect(locales.length).toBeGreaterThan(0);
    });
  });

  describe('Formatting', () => {
    it('should format dates', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      const formatted = i18nManager.formatDate(date, 'en');
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should format numbers', () => {
      const formatted = i18nManager.formatNumber(1234.56, 'en');
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('1');
    });

    it('should format currency', () => {
      const formatted = i18nManager.formatCurrency(1234.56, 'USD', 'en');
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('1');
    });
  });

  describe('Initialization', () => {
    it('should initialize with custom config', async () => {
      await initializeI18n({
        defaultLocale: 'es',
        fallbackLocale: 'en',
        autoLoad: false,
      });

      expect(i18nManager.getCurrentLocale()).toBe('es');
    });
  });
});