export type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

export interface PluralRule {
  (count: number): PluralForm;
}

export class PluralRules {
  private static rules: Map<string, PluralRule> = new Map();

  static {
    // Initialize default plural rules for supported languages
    this.initializeDefaultRules();
  }

  /**
   * Get plural form for a number in a specific locale
   */
  static getPluralForm(count: number, locale: string): PluralForm {
    const rule = this.rules.get(locale) || this.rules.get('en');
    return rule ? rule(count) : this.getDefaultPluralForm(count);
  }

  /**
   * Register a custom plural rule for a locale
   */
  static registerRule(locale: string, rule: PluralRule): void {
    this.rules.set(locale, rule);
  }

  /**
   * Get all registered locales
   */
  static getRegisteredLocales(): string[] {
    return Array.from(this.rules.keys());
  }

  /**
   * Check if a locale has a registered rule
   */
  static hasRule(locale: string): boolean {
    return this.rules.has(locale);
  }

  /**
   * Get default plural form (English rules)
   */
  private static getDefaultPluralForm(count: number): PluralForm {
    if (count === 1) return 'one';
    return 'other';
  }

  /**
   * Initialize default plural rules for supported languages
   */
  private static initializeDefaultRules(): void {
    // English (and similar languages)
    this.rules.set('en', (count: number) => {
      if (count === 1) return 'one';
      return 'other';
    });

    // Spanish
    this.rules.set('es', (count: number) => {
      if (count === 1) return 'one';
      return 'other';
    });

    // German
    this.rules.set('de', (count: number) => {
      if (count === 1) return 'one';
      return 'other';
    });

    // French
    this.rules.set('fr', (count: number) => {
      if (count === 0 || count === 1) return 'one';
      return 'other';
    });

    // Chinese (no pluralization)
    this.rules.set('zh', (_count: number) => {
      return 'other';
    });

    // Russian (complex pluralization)
    this.rules.set('ru', (count: number) => {
      const mod10 = count % 10;
      const mod100 = count % 100;

      if (mod10 === 1 && mod100 !== 11) return 'one';
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'few';
      return 'many';
    });

    // Polish (complex pluralization)
    this.rules.set('pl', (count: number) => {
      if (count === 1) return 'one';
      
      const mod10 = count % 10;
      const mod100 = count % 100;
      
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'few';
      return 'many';
    });

    // Arabic (complex pluralization with zero)
    this.rules.set('ar', (count: number) => {
      if (count === 0) return 'zero';
      if (count === 1) return 'one';
      if (count === 2) return 'two';
      
      const mod100 = count % 100;
      if (mod100 >= 3 && mod100 <= 10) return 'few';
      if (mod100 >= 11 && mod100 <= 99) return 'many';
      return 'other';
    });

    // Japanese (no pluralization)
    this.rules.set('ja', (_count: number) => {
      return 'other';
    });

    // Korean (no pluralization)
    this.rules.set('ko', (_count: number) => {
      return 'other';
    });

    // Italian
    this.rules.set('it', (count: number) => {
      if (count === 1) return 'one';
      return 'other';
    });

    // Portuguese
    this.rules.set('pt', (count: number) => {
      if (count === 1) return 'one';
      return 'other';
    });

    // Dutch
    this.rules.set('nl', (count: number) => {
      if (count === 1) return 'one';
      return 'other';
    });

    // Swedish
    this.rules.set('sv', (count: number) => {
      if (count === 1) return 'one';
      return 'other';
    });

    // Norwegian
    this.rules.set('no', (count: number) => {
      if (count === 1) return 'one';
      return 'other';
    });

    // Danish
    this.rules.set('da', (count: number) => {
      if (count === 1) return 'one';
      return 'other';
    });

    // Finnish
    this.rules.set('fi', (count: number) => {
      if (count === 1) return 'one';
      return 'other';
    });

    // Hungarian
    this.rules.set('hu', (count: number) => {
      if (count === 1) return 'one';
      return 'other';
    });

    // Czech (complex pluralization)
    this.rules.set('cs', (count: number) => {
      if (count === 1) return 'one';
      if (count >= 2 && count <= 4) return 'few';
      return 'other';
    });

    // Slovak (same as Czech)
    this.rules.set('sk', (count: number) => {
      if (count === 1) return 'one';
      if (count >= 2 && count <= 4) return 'few';
      return 'other';
    });

    // Ukrainian (same as Russian)
    this.rules.set('uk', (count: number) => {
      const mod10 = count % 10;
      const mod100 = count % 100;

      if (mod10 === 1 && mod100 !== 11) return 'one';
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'few';
      return 'many';
    });
  }

  /**
   * Get plural rule function for a locale
   */
  static getRule(locale: string): PluralRule | undefined {
    return this.rules.get(locale);
  }

  /**
   * Test plural rule with various numbers
   */
  static testRule(locale: string, testNumbers: number[] = [0, 1, 2, 3, 5, 10, 11, 21, 101]): Record<number, PluralForm> {
    const rule = this.rules.get(locale);
    if (!rule) {
      throw new Error(`No plural rule found for locale: ${locale}`);
    }

    const results: Record<number, PluralForm> = {};
    for (const num of testNumbers) {
      results[num] = rule(num);
    }

    return results;
  }

  /**
   * Validate plural forms object
   */
  static validatePluralForms(
    pluralForms: Record<string, string>,
    locale: string
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const validForms: PluralForm[] = ['zero', 'one', 'two', 'few', 'many', 'other'];

    // Check if 'other' form exists (required)
    if (!pluralForms.other) {
      errors.push("Missing required plural form 'other'");
    }

    // Check for invalid forms
    for (const form of Object.keys(pluralForms)) {
      if (!validForms.includes(form as PluralForm)) {
        errors.push(`Invalid plural form: ${form}`);
      }
    }

    // Check if forms are appropriate for the locale
    const rule = this.rules.get(locale);
    if (rule) {
      const testResults = this.testRule(locale);
      const usedForms = new Set(Object.values(testResults));
      
      for (const form of usedForms) {
        if (!pluralForms[form]) {
          errors.push(`Missing plural form '${form}' required for locale '${locale}'`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get recommended plural forms for a locale
   */
  static getRecommendedForms(locale: string): PluralForm[] {
    const rule = this.rules.get(locale);
    if (!rule) {
      return ['one', 'other'];
    }

    const testResults = this.testRule(locale);
    const usedForms = Array.from(new Set(Object.values(testResults)));
    
    // Always include 'other' as it's required
    if (!usedForms.includes('other')) {
      usedForms.push('other');
    }

    return usedForms.sort((a, b) => {
      const order: PluralForm[] = ['zero', 'one', 'two', 'few', 'many', 'other'];
      return order.indexOf(a) - order.indexOf(b);
    });
  }

  /**
   * Create plural forms template for a locale
   */
  static createTemplate(locale: string, baseText: string): Record<string, string> {
    const recommendedForms = this.getRecommendedForms(locale);
    const template: Record<string, string> = {};

    for (const form of recommendedForms) {
      template[form] = `${baseText} (${form})`;
    }

    return template;
  }
}