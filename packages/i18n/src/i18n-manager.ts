import { z } from 'zod';

export interface TranslationResource {
  [key: string]: string | TranslationResource;
}

export interface LocaleConfig {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  dateFormat: string;
  timeFormat: string;
  numberFormat: {
    decimal: string;
    thousands: string;
    currency: string;
  };
  pluralRules?: (count: number) => string;
}

export interface TranslationOptions {
  count?: number;
  context?: string;
  defaultValue?: string;
  interpolation?: Record<string, any>;
  escapeValue?: boolean;
}

export interface TranslationMetadata {
  key: string;
  locale: string;
  namespace: string;
  lastModified: Date;
  version: string;
  translator?: string;
  status: 'draft' | 'review' | 'approved' | 'deprecated';
}

export class I18nManager {
  private translations: Map<string, Map<string, TranslationResource>> =
    new Map();
  private locales: Map<string, LocaleConfig> = new Map();
  private currentLocale: string = 'en';
  private fallbackLocale: string = 'en';
  private namespaces: Set<string> = new Set(['common']);
  private interpolationPattern = /{{(.*?)}}/g;
  private metadata: Map<string, TranslationMetadata> = new Map();

  constructor() {
    this.setupDefaultLocales();
  }

  /**
   * Initialize the i18n manager with configuration
   */
  async initialize(config: {
    defaultLocale?: string;
    fallbackLocale?: string;
    namespaces?: string[];
    translationsPath?: string;
  }): Promise<void> {
    this.currentLocale = config.defaultLocale || 'en';
    this.fallbackLocale = config.fallbackLocale || 'en';

    if (config.namespaces) {
      config.namespaces.forEach(ns => this.namespaces.add(ns));
    }

    if (config.translationsPath) {
      await this.loadTranslationsFromPath(config.translationsPath);
    }
  }

  /**
   * Add a new locale configuration
   */
  addLocale(locale: LocaleConfig): void {
    this.locales.set(locale.code, locale);

    if (!this.translations.has(locale.code)) {
      this.translations.set(locale.code, new Map());
    }
  }

  /**
   * Load translations for a specific locale and namespace
   */
  loadTranslations(
    locale: string,
    namespace: string,
    translations: TranslationResource,
    metadata?: Partial<TranslationMetadata>
  ): void {
    if (!this.translations.has(locale)) {
      this.translations.set(locale, new Map());
    }

    const localeTranslations = this.translations.get(locale)!;
    localeTranslations.set(namespace, translations);
    this.namespaces.add(namespace);

    // Store metadata if provided
    if (metadata) {
      const key = `${locale}:${namespace}`;
      this.metadata.set(key, {
        key,
        locale,
        namespace,
        lastModified: new Date(),
        version: '1.0.0',
        status: 'approved',
        ...metadata,
      });
    }
  }

  /**
   * Get translation for a key
   */
  t(key: string, options: TranslationOptions = {}, locale?: string): string {
    const targetLocale = locale || this.currentLocale;
    const { namespace, translationKey } = this.parseKey(key);

    let translation = this.getTranslationValue(
      targetLocale,
      namespace,
      translationKey
    );

    // Fallback to default locale if translation not found
    if (translation === undefined && targetLocale !== this.fallbackLocale) {
      translation = this.getTranslationValue(
        this.fallbackLocale,
        namespace,
        translationKey
      );
    }

    // Use default value if still not found
    if (translation === undefined) {
      translation = options.defaultValue || key;
    }

    // Handle pluralization
    if (options.count !== undefined && typeof translation === 'object') {
      translation = this.handlePluralization(
        translation,
        options.count,
        targetLocale
      );
    }

    // Handle interpolation
    if (typeof translation === 'string' && options.interpolation) {
      translation = this.interpolate(
        translation,
        options.interpolation,
        options.escapeValue
      );
    }

    return typeof translation === 'string' ? translation : key;
  }

  /**
   * Check if a translation exists
   */
  exists(key: string, locale?: string): boolean {
    const targetLocale = locale || this.currentLocale;
    const { namespace, translationKey } = this.parseKey(key);

    return (
      this.getTranslationValue(targetLocale, namespace, translationKey) !==
      undefined
    );
  }

  /**
   * Get all available locales
   */
  getAvailableLocales(): LocaleConfig[] {
    return Array.from(this.locales.values());
  }

  /**
   * Get current locale
   */
  getCurrentLocale(): string {
    return this.currentLocale;
  }

  /**
   * Set current locale
   */
  setLocale(locale: string): void {
    if (this.locales.has(locale)) {
      this.currentLocale = locale;
    } else {
      throw new Error(`Locale '${locale}' is not available`);
    }
  }

  /**
   * Get locale configuration
   */
  getLocaleConfig(locale?: string): LocaleConfig | undefined {
    return this.locales.get(locale || this.currentLocale);
  }

  /**
   * Format date according to locale
   */
  formatDate(
    date: Date,
    locale?: string,
    options?: Intl.DateTimeFormatOptions
  ): string {
    const targetLocale = locale || this.currentLocale;
    const config = this.getLocaleConfig(targetLocale);

    if (config) {
      return new Intl.DateTimeFormat(targetLocale, {
        dateStyle: 'medium',
        ...options,
      }).format(date);
    }

    return date.toLocaleDateString();
  }

  /**
   * Format number according to locale
   */
  formatNumber(
    number: number,
    locale?: string,
    options?: Intl.NumberFormatOptions
  ): string {
    const targetLocale = locale || this.currentLocale;
    return new Intl.NumberFormat(targetLocale, options).format(number);
  }

  /**
   * Format currency according to locale
   */
  formatCurrency(amount: number, currency: string, locale?: string): string {
    const targetLocale = locale || this.currentLocale;
    return new Intl.NumberFormat(targetLocale, {
      style: 'currency',
      currency,
    }).format(amount);
  }

  /**
   * Get missing translations for a locale
   */
  getMissingTranslations(
    locale: string,
    referenceLocale: string = this.fallbackLocale
  ): string[] {
    const missing: string[] = [];
    const reference = this.translations.get(referenceLocale);
    const target = this.translations.get(locale);

    if (!reference || !target) {
      return missing;
    }

    for (const [namespace, translations] of reference) {
      const targetNamespace = target.get(namespace);
      if (!targetNamespace) {
        missing.push(`${namespace}:*`);
        continue;
      }

      this.findMissingKeys(translations, targetNamespace, namespace, missing);
    }

    return missing;
  }

  /**
   * Export translations for a locale
   */
  exportTranslations(
    locale: string,
    namespace?: string
  ): TranslationResource | null {
    const localeTranslations = this.translations.get(locale);
    if (!localeTranslations) {
      return null;
    }

    if (namespace) {
      return localeTranslations.get(namespace) || null;
    }

    const exported: TranslationResource = {};
    for (const [ns, translations] of localeTranslations) {
      exported[ns] = translations;
    }

    return exported;
  }

  /**
   * Import translations from JSON
   */
  async importTranslations(
    locale: string,
    data: TranslationResource,
    options: {
      namespace?: string;
      merge?: boolean;
      validate?: boolean;
    } = {}
  ): Promise<void> {
    const { namespace = 'common', merge = true, validate = true } = options;

    if (validate) {
      this.validateTranslations(data);
    }

    if (!this.translations.has(locale)) {
      this.translations.set(locale, new Map());
    }

    const localeTranslations = this.translations.get(locale)!;

    if (merge && localeTranslations.has(namespace)) {
      const existing = localeTranslations.get(namespace)!;
      const merged = this.mergeTranslations(existing, data);
      localeTranslations.set(namespace, merged);
    } else {
      localeTranslations.set(namespace, data);
    }

    this.namespaces.add(namespace);
  }

  /**
   * Get translation statistics
   */
  getTranslationStats(locale: string): {
    totalKeys: number;
    translatedKeys: number;
    missingKeys: number;
    completionPercentage: number;
    namespaces: string[];
  } {
    const localeTranslations = this.translations.get(locale);
    const referenceTranslations = this.translations.get(this.fallbackLocale);

    if (!localeTranslations || !referenceTranslations) {
      return {
        totalKeys: 0,
        translatedKeys: 0,
        missingKeys: 0,
        completionPercentage: 0,
        namespaces: [],
      };
    }

    let totalKeys = 0;
    let translatedKeys = 0;
    const namespaces: string[] = [];

    for (const [namespace, refTranslations] of referenceTranslations) {
      namespaces.push(namespace);
      const nsTotal = this.countKeys(refTranslations);
      totalKeys += nsTotal;

      const targetTranslations = localeTranslations.get(namespace);
      if (targetTranslations) {
        translatedKeys += this.countTranslatedKeys(
          refTranslations,
          targetTranslations
        );
      }
    }

    const missingKeys = totalKeys - translatedKeys;
    const completionPercentage =
      totalKeys > 0 ? (translatedKeys / totalKeys) * 100 : 0;

    return {
      totalKeys,
      translatedKeys,
      missingKeys,
      completionPercentage: Math.round(completionPercentage * 100) / 100,
      namespaces,
    };
  }

  /**
   * Setup default locale configurations
   */
  private setupDefaultLocales(): void {
    const defaultLocales: LocaleConfig[] = [
      {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        direction: 'ltr',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: 'HH:mm',
        numberFormat: {
          decimal: '.',
          thousands: ',',
          currency: '$',
        },
      },
      {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch',
        direction: 'ltr',
        dateFormat: 'DD.MM.YYYY',
        timeFormat: 'HH:mm',
        numberFormat: {
          decimal: ',',
          thousands: '.',
          currency: '€',
        },
      },
      {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        direction: 'ltr',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: 'HH:mm',
        numberFormat: {
          decimal: ',',
          thousands: '.',
          currency: '€',
        },
      },
      {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        direction: 'ltr',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: 'HH:mm',
        numberFormat: {
          decimal: ',',
          thousands: ' ',
          currency: '€',
        },
      },
      {
        code: 'zh',
        name: 'Chinese',
        nativeName: '中文',
        direction: 'ltr',
        dateFormat: 'YYYY/MM/DD',
        timeFormat: 'HH:mm',
        numberFormat: {
          decimal: '.',
          thousands: ',',
          currency: '¥',
        },
      },
    ];

    defaultLocales.forEach(locale => this.addLocale(locale));
  }

  /**
   * Parse translation key to extract namespace and key
   */
  private parseKey(key: string): { namespace: string; translationKey: string } {
    const parts = key.split(':');
    if (parts.length > 1) {
      return {
        namespace: parts[0] || 'common',
        translationKey: parts.slice(1).join(':'),
      };
    }
    return {
      namespace: 'common',
      translationKey: key,
    };
  }

  /**
   * Get translation value from nested object
   */
  private getTranslationValue(
    locale: string,
    namespace: string,
    key: string
  ): string | TranslationResource | undefined {
    const localeTranslations = this.translations.get(locale);
    if (!localeTranslations) {
      return undefined;
    }

    const namespaceTranslations = localeTranslations.get(namespace);
    if (!namespaceTranslations) {
      return undefined;
    }

    return this.getNestedValue(namespaceTranslations, key);
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(
    obj: TranslationResource,
    path: string
  ): string | TranslationResource | undefined {
    const keys = path.split('.');
    let current: any = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Handle pluralization
   */
  private handlePluralization(
    translation: TranslationResource,
    count: number,
    locale: string
  ): string {
    const config = this.getLocaleConfig(locale);

    if (config?.pluralRules) {
      const form = config.pluralRules(count);
      if (typeof translation === 'object' && form in translation) {
        return translation[form] as string;
      }
    }

    // Default English pluralization rules
    if (typeof translation === 'object') {
      if (count === 0 && 'zero' in translation) {
        return translation['zero'] as string;
      }
      if (count === 1 && 'one' in translation) {
        return translation['one'] as string;
      }
      if ('other' in translation) {
        return translation['other'] as string;
      }
      if ('many' in translation) {
        return translation['many'] as string;
      }
    }

    return String(translation);
  }

  /**
   * Interpolate variables in translation string
   */
  private interpolate(
    translation: string,
    variables: Record<string, any>,
    escapeValue: boolean = true
  ): string {
    return translation.replace(this.interpolationPattern, (match, key) => {
      const trimmedKey = key?.trim();
      if (trimmedKey && trimmedKey in variables) {
        let value = String(variables[trimmedKey]);
        if (escapeValue) {
          value = this.escapeHtml(value);
        }
        return value;
      }
      return match;
    });
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m] || m);
  }

  /**
   * Load translations from file system path
   */
  private async loadTranslationsFromPath(
    translationsPath: string
  ): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      const localeDirectories = await fs.readdir(translationsPath);

      for (const localeDir of localeDirectories) {
        const localePath = path.join(translationsPath, localeDir);
        const stat = await fs.stat(localePath);

        if (stat.isDirectory()) {
          const translationFiles = await fs.readdir(localePath);

          for (const file of translationFiles) {
            if (file.endsWith('.json')) {
              const filePath = path.join(localePath, file);
              const content = await fs.readFile(filePath, 'utf8');
              const translations = JSON.parse(content);
              const namespace = path.basename(file, '.json');

              this.loadTranslations(localeDir, namespace, translations);
            }
          }
        }
      }
    } catch (error) {
      console.warn(
        `Failed to load translations from ${translationsPath}:`,
        error
      );
    }
  }

  /**
   * Find missing translation keys recursively
   */
  private findMissingKeys(
    reference: TranslationResource,
    target: TranslationResource,
    prefix: string,
    missing: string[]
  ): void {
    for (const [key, value] of Object.entries(reference)) {
      const fullKey = `${prefix}.${key}`;

      if (!(key in target)) {
        missing.push(fullKey);
      } else if (typeof value === 'object' && typeof target[key] === 'object') {
        this.findMissingKeys(
          value as TranslationResource,
          target[key] as TranslationResource,
          fullKey,
          missing
        );
      }
    }
  }

  /**
   * Count total number of translation keys
   */
  private countKeys(translations: TranslationResource): number {
    let count = 0;

    for (const value of Object.values(translations)) {
      if (typeof value === 'string') {
        count++;
      } else if (typeof value === 'object') {
        count += this.countKeys(value);
      }
    }

    return count;
  }

  /**
   * Count translated keys (non-empty strings)
   */
  private countTranslatedKeys(
    reference: TranslationResource,
    target: TranslationResource
  ): number {
    let count = 0;

    for (const [key, refValue] of Object.entries(reference)) {
      if (key in target) {
        const targetValue = target[key];

        if (
          typeof refValue === 'string' &&
          typeof targetValue === 'string' &&
          targetValue.trim()
        ) {
          count++;
        } else if (
          typeof refValue === 'object' &&
          typeof targetValue === 'object'
        ) {
          count += this.countTranslatedKeys(
            refValue as TranslationResource,
            targetValue as TranslationResource
          );
        }
      }
    }

    return count;
  }

  /**
   * Validate translation structure
   */
  private validateTranslations(translations: TranslationResource): void {
    const schema = z.record(z.union([z.string(), z.record(z.any())]));

    try {
      schema.parse(translations);
    } catch (error) {
      throw new Error(`Invalid translation structure: ${error}`);
    }
  }

  /**
   * Merge two translation objects
   */
  private mergeTranslations(
    existing: TranslationResource,
    incoming: TranslationResource
  ): TranslationResource {
    const result = { ...existing };

    for (const [key, value] of Object.entries(incoming)) {
      if (typeof value === 'object' && typeof existing[key] === 'object') {
        result[key] = this.mergeTranslations(
          existing[key] as TranslationResource,
          value as TranslationResource
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

// Export singleton instance
export const i18nManager = new I18nManager();
