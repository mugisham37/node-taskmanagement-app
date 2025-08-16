import { beforeEach, describe, expect, it } from 'vitest';
import { I18nManager } from '../i18n-manager';

describe('I18nManager', () => {
  let i18nManager: I18nManager;

  beforeEach(() => {
    i18nManager = new I18nManager();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', async () => {
      await i18nManager.initialize({
        defaultLocale: 'en',
        fallbackLocale: 'en',
        namespaces: ['common'],
      });

      expect(i18nManager.getCurrentLocale()).toBe('en');
      expect(i18nManager.getAvailableLocales()).toHaveLength(5); // Default locales
    });

    it('should set custom locale', async () => {
      await i18nManager.initialize({
        defaultLocale: 'es',
        fallbackLocale: 'en',
      });

      expect(i18nManager.getCurrentLocale()).toBe('es');
    });
  });

  describe('translations', () => {
    beforeEach(async () => {
      await i18nManager.initialize({
        defaultLocale: 'en',
        fallbackLocale: 'en',
      });

      // Load test translations
      i18nManager.loadTranslations('en', 'common', {
        hello: 'Hello',
        welcome: 'Welcome {{name}}',
        items: {
          one: '{{count}} item',
          other: '{{count}} items',
        },
        nested: {
          deep: {
            value: 'Deep nested value',
          },
        },
      });

      i18nManager.loadTranslations('es', 'common', {
        hello: 'Hola',
        welcome: 'Bienvenido {{name}}',
        nested: {
          deep: {
            value: 'Valor anidado profundo',
          },
        },
      });
    });

    it('should translate simple keys', () => {
      expect(i18nManager.t('common:hello')).toBe('Hello');
    });

    it('should translate with interpolation', () => {
      expect(i18nManager.t('common:welcome', { interpolation: { name: 'John' } })).toBe('Welcome John');
    });

    it('should handle nested keys', () => {
      expect(i18nManager.t('common:nested.deep.value')).toBe('Deep nested value');
    });

    it('should handle pluralization', () => {
      expect(i18nManager.t('common:items', { count: 1 })).toBe('1 item');
      expect(i18nManager.t('common:items', { count: 5 })).toBe('5 items');
    });

    it('should fallback to default locale', () => {
      i18nManager.setLocale('es');
      expect(i18nManager.t('common:items', { count: 1 })).toBe('1 item'); // Falls back to English
    });

    it('should use default value when translation not found', () => {
      expect(i18nManager.t('common:nonexistent', { defaultValue: 'Default' })).toBe('Default');
    });

    it('should check if translation exists', () => {
      expect(i18nManager.exists('common:hello')).toBe(true);
      expect(i18nManager.exists('common:nonexistent')).toBe(false);
    });
  });

  describe('locale management', () => {
    beforeEach(async () => {
      await i18nManager.initialize({
        defaultLocale: 'en',
        fallbackLocale: 'en',
      });
    });

    it('should set locale', () => {
      i18nManager.setLocale('es');
      expect(i18nManager.getCurrentLocale()).toBe('es');
    });

    it('should throw error for invalid locale', () => {
      expect(() => i18nManager.setLocale('invalid')).toThrow();
    });

    it('should get locale configuration', () => {
      const config = i18nManager.getLocaleConfig('en');
      expect(config).toBeDefined();
      expect(config?.code).toBe('en');
      expect(config?.name).toBe('English');
    });
  });

  describe('formatting', () => {
    beforeEach(async () => {
      await i18nManager.initialize({
        defaultLocale: 'en',
        fallbackLocale: 'en',
      });
    });

    it('should format dates', () => {
      const date = new Date('2023-12-25');
      const formatted = i18nManager.formatDate(date, 'en');
      expect(formatted).toContain('Dec');
      expect(formatted).toContain('25');
      expect(formatted).toContain('2023');
    });

    it('should format numbers', () => {
      expect(i18nManager.formatNumber(1234.56, 'en')).toBe('1,234.56');
      expect(i18nManager.formatNumber(1234.56, 'de')).toBe('1.234,56');
    });

    it('should format currency', () => {
      const formatted = i18nManager.formatCurrency(1234.56, 'USD', 'en');
      expect(formatted).toContain('$');
      expect(formatted).toContain('1,234.56');
    });
  });

  describe('translation statistics', () => {
    beforeEach(async () => {
      await i18nManager.initialize({
        defaultLocale: 'en',
        fallbackLocale: 'en',
      });

      i18nManager.loadTranslations('en', 'common', {
        key1: 'Value 1',
        key2: 'Value 2',
        nested: {
          key3: 'Value 3',
        },
      });

      i18nManager.loadTranslations('es', 'common', {
        key1: 'Valor 1',
        nested: {
          key3: 'Valor 3',
        },
      });
    });

    it('should get translation statistics', () => {
      const stats = i18nManager.getTranslationStats('es');
      expect(stats.totalKeys).toBe(3);
      expect(stats.translatedKeys).toBe(2);
      expect(stats.missingKeys).toBe(1);
      expect(stats.completionPercentage).toBeCloseTo(66.67);
    });

    it('should get missing translations', () => {
      const missing = i18nManager.getMissingTranslations('es', 'en');
      expect(missing).toContain('common.key2');
    });
  });

  describe('import/export', () => {
    beforeEach(async () => {
      await i18nManager.initialize({
        defaultLocale: 'en',
        fallbackLocale: 'en',
      });
    });

    it('should export translations', () => {
      i18nManager.loadTranslations('en', 'common', {
        hello: 'Hello',
        world: 'World',
      });

      const exported = i18nManager.exportTranslations('en', 'common');
      expect(exported).toEqual({
        hello: 'Hello',
        world: 'World',
      });
    });

    it('should import translations', async () => {
      const translations = {
        hello: 'Hello',
        world: 'World',
      };

      await i18nManager.importTranslations('en', translations, {
        namespace: 'common',
      });

      expect(i18nManager.t('common:hello')).toBe('Hello');
      expect(i18nManager.t('common:world')).toBe('World');
    });

    it('should merge translations on import', async () => {
      i18nManager.loadTranslations('en', 'common', {
        existing: 'Existing value',
      });

      await i18nManager.importTranslations('en', {
        new: 'New value',
      }, {
        namespace: 'common',
        merge: true,
      });

      expect(i18nManager.t('common:existing')).toBe('Existing value');
      expect(i18nManager.t('common:new')).toBe('New value');
    });
  });
});