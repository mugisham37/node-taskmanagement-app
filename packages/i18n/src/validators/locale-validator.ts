import { z } from 'zod';

export interface LocaleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class LocaleValidator {
  private static readonly SUPPORTED_LOCALES = ['en', 'es', 'de', 'fr', 'zh'];
  private static readonly LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

  /**
   * Validate locale code format
   */
  static validateLocaleCode(locale: string): LocaleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check format
    if (!this.LOCALE_PATTERN.test(locale)) {
      errors.push(`Invalid locale format: ${locale}. Expected format: 'en' or 'en-US'`);
    }

    // Check if supported
    const baseLocale = locale.split('-')[0];
    if (!this.SUPPORTED_LOCALES.includes(baseLocale)) {
      warnings.push(`Locale '${locale}' is not in the list of supported locales`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate translation object structure
   */
  static validateTranslationStructure(
    translations: any,
    locale: string
  ): LocaleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic structure validation
      const translationSchema = z.record(
        z.union([
          z.string(),
          z.record(z.any()),
        ])
      );

      translationSchema.parse(translations);

      // Check for empty translations
      this.checkEmptyTranslations(translations, '', errors, warnings);

      // Check for missing interpolation variables
      this.checkInterpolationVariables(translations, '', errors, warnings);

      // Check for HTML content
      this.checkHtmlContent(translations, '', warnings);

    } catch (error) {
      errors.push(`Invalid translation structure for locale '${locale}': ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate translation completeness against reference locale
   */
  static validateTranslationCompleteness(
    translations: any,
    referenceTranslations: any,
    locale: string,
    referenceLocale = 'en'
  ): LocaleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const missingKeys = this.findMissingKeys(referenceTranslations, translations, '');
    const extraKeys = this.findMissingKeys(translations, referenceTranslations, '');

    if (missingKeys.length > 0) {
      errors.push(`Missing translations in '${locale}': ${missingKeys.join(', ')}`);
    }

    if (extraKeys.length > 0) {
      warnings.push(`Extra translations in '${locale}' not found in '${referenceLocale}': ${extraKeys.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate interpolation variables consistency
   */
  static validateInterpolationConsistency(
    translations: any,
    referenceTranslations: any,
    locale: string
  ): LocaleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.compareInterpolationVariables(
      translations,
      referenceTranslations,
      '',
      errors,
      warnings,
      locale
    );

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate pluralization rules
   */
  static validatePluralizationRules(
    translations: any,
    locale: string
  ): LocaleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.checkPluralizationRules(translations, '', locale, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Comprehensive validation of locale data
   */
  static validateLocale(
    locale: string,
    translations: any,
    referenceTranslations?: any
  ): LocaleValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    // Validate locale code
    const localeResult = this.validateLocaleCode(locale);
    allErrors.push(...localeResult.errors);
    allWarnings.push(...localeResult.warnings);

    // Validate translation structure
    const structureResult = this.validateTranslationStructure(translations, locale);
    allErrors.push(...structureResult.errors);
    allWarnings.push(...structureResult.warnings);

    // Validate pluralization
    const pluralResult = this.validatePluralizationRules(translations, locale);
    allErrors.push(...pluralResult.errors);
    allWarnings.push(...pluralResult.warnings);

    // Validate against reference if provided
    if (referenceTranslations) {
      const completenessResult = this.validateTranslationCompleteness(
        translations,
        referenceTranslations,
        locale
      );
      allErrors.push(...completenessResult.errors);
      allWarnings.push(...completenessResult.warnings);

      const interpolationResult = this.validateInterpolationConsistency(
        translations,
        referenceTranslations,
        locale
      );
      allErrors.push(...interpolationResult.errors);
      allWarnings.push(...interpolationResult.warnings);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Find missing keys recursively
   */
  private static findMissingKeys(
    reference: any,
    target: any,
    prefix: string
  ): string[] {
    const missing: string[] = [];

    for (const [key, value] of Object.entries(reference)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (!(key in target)) {
        missing.push(fullKey);
      } else if (typeof value === 'object' && typeof target[key] === 'object') {
        missing.push(...this.findMissingKeys(value, target[key], fullKey));
      }
    }

    return missing;
  }

  /**
   * Check for empty translations
   */
  private static checkEmptyTranslations(
    obj: any,
    prefix: string,
    errors: string[],
    warnings: string[]
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        if (!value.trim()) {
          warnings.push(`Empty translation at key: ${fullKey}`);
        }
      } else if (typeof value === 'object') {
        this.checkEmptyTranslations(value, fullKey, errors, warnings);
      }
    }
  }

  /**
   * Check interpolation variables
   */
  private static checkInterpolationVariables(
    obj: any,
    prefix: string,
    errors: string[],
    warnings: string[]
  ): void {
    const interpolationPattern = /{{(.*?)}}/g;

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        const matches = value.match(interpolationPattern);
        if (matches) {
          for (const match of matches) {
            const variable = match.slice(2, -2).trim();
            if (!variable) {
              errors.push(`Empty interpolation variable in: ${fullKey}`);
            }
          }
        }
      } else if (typeof value === 'object') {
        this.checkInterpolationVariables(value, fullKey, errors, warnings);
      }
    }
  }

  /**
   * Check for HTML content
   */
  private static checkHtmlContent(
    obj: any,
    prefix: string,
    warnings: string[]
  ): void {
    const htmlPattern = /<[^>]*>/;

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        if (htmlPattern.test(value)) {
          warnings.push(`HTML content detected in: ${fullKey}`);
        }
      } else if (typeof value === 'object') {
        this.checkHtmlContent(value, fullKey, warnings);
      }
    }
  }

  /**
   * Compare interpolation variables between locales
   */
  private static compareInterpolationVariables(
    translations: any,
    reference: any,
    prefix: string,
    errors: string[],
    warnings: string[],
    locale: string
  ): void {
    const interpolationPattern = /{{(.*?)}}/g;

    for (const [key, value] of Object.entries(reference)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string' && key in translations) {
        const refVariables = (value.match(interpolationPattern) || [])
          .map(match => match.slice(2, -2).trim());
        
        const transValue = translations[key];
        if (typeof transValue === 'string') {
          const transVariables = (transValue.match(interpolationPattern) || [])
            .map(match => match.slice(2, -2).trim());

          const missingVars = refVariables.filter(v => !transVariables.includes(v));
          const extraVars = transVariables.filter(v => !refVariables.includes(v));

          if (missingVars.length > 0) {
            errors.push(`Missing interpolation variables in '${locale}' at ${fullKey}: ${missingVars.join(', ')}`);
          }

          if (extraVars.length > 0) {
            warnings.push(`Extra interpolation variables in '${locale}' at ${fullKey}: ${extraVars.join(', ')}`);
          }
        }
      } else if (typeof value === 'object' && key in translations && typeof translations[key] === 'object') {
        this.compareInterpolationVariables(
          translations[key],
          value,
          fullKey,
          errors,
          warnings,
          locale
        );
      }
    }
  }

  /**
   * Check pluralization rules
   */
  private static checkPluralizationRules(
    obj: any,
    prefix: string,
    locale: string,
    errors: string[],
    warnings: string[]
  ): void {
    const pluralForms = ['zero', 'one', 'two', 'few', 'many', 'other'];

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object') {
        const keys = Object.keys(value);
        const hasPluralForms = keys.some(k => pluralForms.includes(k));

        if (hasPluralForms) {
          // Check if required plural forms are present
          if (!keys.includes('other')) {
            errors.push(`Missing required plural form 'other' in: ${fullKey}`);
          }

          // Check for invalid plural forms
          const invalidForms = keys.filter(k => !pluralForms.includes(k));
          if (invalidForms.length > 0) {
            warnings.push(`Invalid plural forms in ${fullKey}: ${invalidForms.join(', ')}`);
          }
        } else {
          // Recursively check nested objects
          this.checkPluralizationRules(value, fullKey, locale, errors, warnings);
        }
      }
    }
  }
}