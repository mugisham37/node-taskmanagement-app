export interface DetectionOptions {
  order?: string[];
  caches?: string[];
  excludeCacheFor?: string[];
  cookieMinutes?: number;
  cookieDomain?: string;
  cookieOptions?: any;
  lookupQuerystring?: string;
  lookupCookie?: string;
  lookupLocalStorage?: string;
  lookupSessionStorage?: string;
  lookupFromPathIndex?: number;
  lookupFromSubdomainIndex?: number;
  checkWhitelist?: boolean;
}

export interface DetectionResult {
  locale: string;
  source: string;
  confidence: number;
}

export class LanguageDetector {
  private options: DetectionOptions;
  private supportedLocales: string[];

  constructor(supportedLocales: string[] = ['en'], options: DetectionOptions = {}) {
    this.supportedLocales = supportedLocales;
    this.options = {
      order: ['querystring', 'cookie', 'localStorage', 'sessionStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
      excludeCacheFor: ['cimode'],
      cookieMinutes: 10080, // 7 days
      cookieDomain: undefined,
      cookieOptions: {},
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      lookupLocalStorage: 'i18nextLng',
      lookupSessionStorage: 'i18nextLng',
      lookupFromPathIndex: 0,
      lookupFromSubdomainIndex: 0,
      checkWhitelist: true,
      ...options,
    };
  }

  /**
   * Detect language from multiple sources
   */
  detect(): DetectionResult {
    const detections: DetectionResult[] = [];

    for (const source of this.options.order || []) {
      const result = this.detectFromSource(source);
      if (result) {
        detections.push(result);
      }
    }

    // Return the highest confidence detection
    detections.sort((a, b) => b.confidence - a.confidence);
    return detections[0] || { locale: 'en', source: 'fallback', confidence: 0 };
  }

  /**
   * Detect language from specific source
   */
  private detectFromSource(source: string): DetectionResult | null {
    switch (source) {
      case 'querystring':
        return this.detectFromQueryString();
      case 'cookie':
        return this.detectFromCookie();
      case 'localStorage':
        return this.detectFromLocalStorage();
      case 'sessionStorage':
        return this.detectFromSessionStorage();
      case 'navigator':
        return this.detectFromNavigator();
      case 'htmlTag':
        return this.detectFromHtmlTag();
      case 'path':
        return this.detectFromPath();
      case 'subdomain':
        return this.detectFromSubdomain();
      default:
        return null;
    }
  }

  /**
   * Detect from URL query string
   */
  private detectFromQueryString(): DetectionResult | null {
    if (typeof window === 'undefined') return null;

    const params = new URLSearchParams(window.location.search);
    const locale = params.get(this.options.lookupQuerystring || 'lng');

    if (locale && this.isValidLocale(locale)) {
      return { locale, source: 'querystring', confidence: 0.9 };
    }

    return null;
  }

  /**
   * Detect from cookie
   */
  private detectFromCookie(): DetectionResult | null {
    if (typeof document === 'undefined') return null;

    const cookieName = this.options.lookupCookie || 'i18next';
    const cookies = document.cookie.split(';');

    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === cookieName && value && this.isValidLocale(value)) {
        return { locale: value, source: 'cookie', confidence: 0.8 };
      }
    }

    return null;
  }

  /**
   * Detect from localStorage
   */
  private detectFromLocalStorage(): DetectionResult | null {
    if (typeof localStorage === 'undefined') return null;

    try {
      const locale = localStorage.getItem(this.options.lookupLocalStorage || 'i18nextLng');
      if (locale && this.isValidLocale(locale)) {
        return { locale, source: 'localStorage', confidence: 0.7 };
      }
    } catch (error) {
      // localStorage might not be available
    }

    return null;
  }

  /**
   * Detect from sessionStorage
   */
  private detectFromSessionStorage(): DetectionResult | null {
    if (typeof sessionStorage === 'undefined') return null;

    try {
      const locale = sessionStorage.getItem(this.options.lookupSessionStorage || 'i18nextLng');
      if (locale && this.isValidLocale(locale)) {
        return { locale, source: 'sessionStorage', confidence: 0.6 };
      }
    } catch (error) {
      // sessionStorage might not be available
    }

    return null;
  }

  /**
   * Detect from navigator language
   */
  private detectFromNavigator(): DetectionResult | null {
    if (typeof navigator === 'undefined') return null;

    const languages = [
      navigator.language,
      ...(navigator.languages || []),
    ];

    for (const lang of languages) {
      const locale = this.normalizeLocale(lang);
      if (this.isValidLocale(locale)) {
        return { locale, source: 'navigator', confidence: 0.5 };
      }
    }

    return null;
  }

  /**
   * Detect from HTML lang attribute
   */
  private detectFromHtmlTag(): DetectionResult | null {
    if (typeof document === 'undefined') return null;

    const htmlLang = document.documentElement.lang;
    if (htmlLang) {
      const locale = this.normalizeLocale(htmlLang);
      if (this.isValidLocale(locale)) {
        return { locale, source: 'htmlTag', confidence: 0.4 };
      }
    }

    return null;
  }

  /**
   * Detect from URL path
   */
  private detectFromPath(): DetectionResult | null {
    if (typeof window === 'undefined') return null;

    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const index = this.options.lookupFromPathIndex || 0;

    if (pathSegments[index]) {
      const locale = this.normalizeLocale(pathSegments[index]);
      if (this.isValidLocale(locale)) {
        return { locale, source: 'path', confidence: 0.8 };
      }
    }

    return null;
  }

  /**
   * Detect from subdomain
   */
  private detectFromSubdomain(): DetectionResult | null {
    if (typeof window === 'undefined') return null;

    const subdomains = window.location.hostname.split('.');
    const index = this.options.lookupFromSubdomainIndex || 0;

    if (subdomains[index]) {
      const locale = this.normalizeLocale(subdomains[index]);
      if (this.isValidLocale(locale)) {
        return { locale, source: 'subdomain', confidence: 0.7 };
      }
    }

    return null;
  }

  /**
   * Cache detected language
   */
  cacheUserLanguage(locale: string): void {
    if (!this.options.caches) return;

    for (const cache of this.options.caches) {
      switch (cache) {
        case 'localStorage':
          this.cacheToLocalStorage(locale);
          break;
        case 'sessionStorage':
          this.cacheToSessionStorage(locale);
          break;
        case 'cookie':
          this.cacheToCookie(locale);
          break;
      }
    }
  }

  /**
   * Cache to localStorage
   */
  private cacheToLocalStorage(locale: string): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(this.options.lookupLocalStorage || 'i18nextLng', locale);
    } catch (error) {
      // localStorage might not be available
    }
  }

  /**
   * Cache to sessionStorage
   */
  private cacheToSessionStorage(locale: string): void {
    if (typeof sessionStorage === 'undefined') return;

    try {
      sessionStorage.setItem(this.options.lookupSessionStorage || 'i18nextLng', locale);
    } catch (error) {
      // sessionStorage might not be available
    }
  }

  /**
   * Cache to cookie
   */
  private cacheToCookie(locale: string): void {
    if (typeof document === 'undefined') return;

    const cookieName = this.options.lookupCookie || 'i18next';
    const minutes = this.options.cookieMinutes || 10080;
    const domain = this.options.cookieDomain;

    const expires = new Date();
    expires.setTime(expires.getTime() + minutes * 60 * 1000);

    let cookieString = `${cookieName}=${locale}; expires=${expires.toUTCString()}; path=/`;
    
    if (domain) {
      cookieString += `; domain=${domain}`;
    }

    if (this.options.cookieOptions?.secure) {
      cookieString += '; secure';
    }

    if (this.options.cookieOptions?.sameSite) {
      cookieString += `; samesite=${this.options.cookieOptions.sameSite}`;
    }

    document.cookie = cookieString;
  }

  /**
   * Normalize locale code
   */
  private normalizeLocale(locale: string): string {
    return locale.toLowerCase().split('-')[0];
  }

  /**
   * Check if locale is supported
   */
  private isValidLocale(locale: string): boolean {
    if (!this.options.checkWhitelist) return true;
    return this.supportedLocales.includes(this.normalizeLocale(locale));
  }

  /**
   * Update supported locales
   */
  setSupportedLocales(locales: string[]): void {
    this.supportedLocales = locales;
  }

  /**
   * Get supported locales
   */
  getSupportedLocales(): string[] {
    return [...this.supportedLocales];
  }
}