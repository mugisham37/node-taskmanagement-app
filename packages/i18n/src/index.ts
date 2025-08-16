// Core i18n functionality
export { I18nManager, i18nManager } from './i18n-manager';
export type {
    LocaleConfig, TranslationMetadata, TranslationOptions, TranslationResource
} from './i18n-manager';
export { TranslationLoader, translationLoader } from './translation-loader';
export type { LoaderOptions, TranslationFile } from './translation-loader';

// Formatters
export { DateFormatter } from './formatters/date-formatter';
export type { DateFormatterOptions } from './formatters/date-formatter';
export { NumberFormatter } from './formatters/number-formatter';
export type { NumberFormatterOptions } from './formatters/number-formatter';

// Validators
export { LocaleValidator } from './validators/locale-validator';
export type { LocaleValidationResult } from './validators/locale-validator';

// Middleware
export { createLocaleMiddleware, detectLocaleFromDevice, detectLocaleFromNextRequest, LocaleMiddleware } from './middleware/locale-middleware';
export type { LocaleMiddlewareOptions, LocaleRequest } from './middleware/locale-middleware';

// Language Detection
export { LanguageDetector } from './detectors/language-detector';
export type { DetectionOptions, DetectionResult } from './detectors/language-detector';

// Pluralization
export { PluralRules } from './pluralization/plural-rules';
export type { PluralForm, PluralRule } from './pluralization/plural-rules';

// Interpolation
export { Interpolator } from './interpolation/interpolator';
export type { FormatFunction, InterpolationContext, InterpolationOptions } from './interpolation/interpolator';

import { i18nManager } from './i18n-manager';
import { translationLoader } from './translation-loader';

// Initialize the i18n system with default configuration
export async function initializeI18n(config?: {
  defaultLocale?: string;
  fallbackLocale?: string;
  translationsPath?: string;
  autoLoad?: boolean;
}): Promise<void> {
  const {
    defaultLocale = 'en',
    fallbackLocale = 'en',
    translationsPath = './locales',
    autoLoad = true,
  } = config || {};

  const initConfig: Parameters<typeof i18nManager.initialize>[0] = {
    defaultLocale,
    fallbackLocale,
    namespaces: ['translation'],
  };

  if (autoLoad && translationsPath) {
    initConfig.translationsPath = translationsPath;
  }

  await i18nManager.initialize(initConfig);

  if (autoLoad) {
    await translationLoader.loadFromDirectory(translationsPath);
  }
}

// Convenience function for translations
export function t(key: string, options?: any, locale?: string): string {
  return i18nManager.t(key, options, locale);
}

// Convenience function for checking if translation exists
export function exists(key: string, locale?: string): boolean {
  return i18nManager.exists(key, locale);
}

// Convenience function for setting locale
export function setLocale(locale: string): void {
  i18nManager.setLocale(locale);
}

// Convenience function for getting current locale
export function getCurrentLocale(): string {
  return i18nManager.getCurrentLocale();
}

// Convenience function for getting available locales
export function getAvailableLocales() {
  return i18nManager.getAvailableLocales();
}

// Convenience function for formatting dates
export function formatDate(
  date: Date,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  return i18nManager.formatDate(date, locale, options);
}

// Convenience function for formatting numbers
export function formatNumber(
  number: number,
  locale?: string,
  options?: Intl.NumberFormatOptions
): string {
  return i18nManager.formatNumber(number, locale, options);
}

// Convenience function for formatting currency
export function formatCurrency(
  amount: number,
  currency: string,
  locale?: string
): string {
  return i18nManager.formatCurrency(amount, currency, locale);
}
