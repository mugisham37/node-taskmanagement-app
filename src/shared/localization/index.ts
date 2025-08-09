export { I18nManager, i18nManager } from './i18n-manager';
export { TranslationLoader, translationLoader } from './translation-loader';
export type {
  TranslationResource,
  LocaleConfig,
  TranslationOptions,
  TranslationMetadata,
} from './i18n-manager';
export type { TranslationFile, LoaderOptions } from './translation-loader';

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
    translationsPath = './src/shared/localization/locales',
    autoLoad = true,
  } = config || {};

  await i18nManager.initialize({
    defaultLocale,
    fallbackLocale,
    namespaces: ['translation'],
    translationsPath: autoLoad ? translationsPath : undefined,
  });

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
