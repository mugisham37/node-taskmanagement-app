import { NextFunction, Request, Response } from 'express';

export interface LocaleMiddlewareOptions {
  defaultLocale?: string;
  supportedLocales?: string[];
  cookieName?: string;
  headerName?: string;
  queryParam?: string;
  fallbackChain?: string[];
  detectFromPath?: boolean;
  pathPattern?: RegExp;
}

export interface LocaleRequest extends Request {
  locale?: string;
  locales?: string[];
  setLocale?: (locale: string) => void;
}

export class LocaleMiddleware {
  private options: Required<LocaleMiddlewareOptions>;

  constructor(options: LocaleMiddlewareOptions = {}) {
    this.options = {
      defaultLocale: 'en',
      supportedLocales: ['en', 'es', 'de', 'fr', 'zh'],
      cookieName: 'locale',
      headerName: 'accept-language',
      queryParam: 'lang',
      fallbackChain: ['cookie', 'header', 'default'],
      detectFromPath: false,
      pathPattern: /^\/([a-z]{2})(?:\/|$)/,
      ...options,
    };
  }

  /**
   * Express middleware for locale detection and setting
   */
  middleware() {
    return (req: LocaleRequest, res: Response, next: NextFunction) => {
      const detectedLocale = this.detectLocale(req);
      
      req.locale = detectedLocale;
      req.locales = this.options.supportedLocales;
      req.setLocale = (locale: string) => {
        if (this.isValidLocale(locale)) {
          req.locale = locale;
          res.cookie(this.options.cookieName, locale, {
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
          });
        }
      };

      // Set response headers
      res.setHeader('Content-Language', detectedLocale);
      res.setHeader('Vary', 'Accept-Language');

      next();
    };
  }

  /**
   * Detect locale from various sources
   */
  private detectLocale(req: LocaleRequest): string {
    for (const source of this.options.fallbackChain) {
      let locale: string | undefined;

      switch (source) {
        case 'query':
          locale = this.getLocaleFromQuery(req);
          break;
        case 'path':
          locale = this.getLocaleFromPath(req);
          break;
        case 'cookie':
          locale = this.getLocaleFromCookie(req);
          break;
        case 'header':
          locale = this.getLocaleFromHeader(req);
          break;
        case 'default':
          locale = this.options.defaultLocale;
          break;
      }

      if (locale && this.isValidLocale(locale)) {
        return locale;
      }
    }

    return this.options.defaultLocale;
  }

  /**
   * Get locale from query parameter
   */
  private getLocaleFromQuery(req: LocaleRequest): string | undefined {
    return req.query[this.options.queryParam] as string;
  }

  /**
   * Get locale from URL path
   */
  private getLocaleFromPath(req: LocaleRequest): string | undefined {
    if (!this.options.detectFromPath) {
      return undefined;
    }

    const match = req.path.match(this.options.pathPattern);
    return match ? match[1] : undefined;
  }

  /**
   * Get locale from cookie
   */
  private getLocaleFromCookie(req: LocaleRequest): string | undefined {
    return req.cookies?.[this.options.cookieName];
  }

  /**
   * Get locale from Accept-Language header
   */
  private getLocaleFromHeader(req: LocaleRequest): string | undefined {
    const acceptLanguage = req.headers[this.options.headerName] as string;
    
    if (!acceptLanguage) {
      return undefined;
    }

    // Parse Accept-Language header
    const languages = acceptLanguage
      .split(',')
      .map(lang => {
        const [locale, quality = '1'] = lang.trim().split(';q=');
        return {
          locale: locale.toLowerCase(),
          quality: parseFloat(quality),
        };
      })
      .sort((a, b) => b.quality - a.quality);

    // Find first supported locale
    for (const { locale } of languages) {
      const baseLocale = locale.split('-')[0];
      if (this.isValidLocale(baseLocale)) {
        return baseLocale;
      }
    }

    return undefined;
  }

  /**
   * Check if locale is supported
   */
  private isValidLocale(locale: string): boolean {
    return this.options.supportedLocales.includes(locale);
  }

  /**
   * Get supported locales
   */
  getSupportedLocales(): string[] {
    return [...this.options.supportedLocales];
  }

  /**
   * Add supported locale
   */
  addSupportedLocale(locale: string): void {
    if (!this.options.supportedLocales.includes(locale)) {
      this.options.supportedLocales.push(locale);
    }
  }

  /**
   * Remove supported locale
   */
  removeSupportedLocale(locale: string): void {
    const index = this.options.supportedLocales.indexOf(locale);
    if (index > -1) {
      this.options.supportedLocales.splice(index, 1);
    }
  }

  /**
   * Update middleware options
   */
  updateOptions(newOptions: Partial<LocaleMiddlewareOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}

/**
 * Create locale middleware with options
 */
export function createLocaleMiddleware(options?: LocaleMiddlewareOptions) {
  const middleware = new LocaleMiddleware(options);
  return middleware.middleware();
}

/**
 * Locale detection for Next.js
 */
export function detectLocaleFromNextRequest(
  req: any,
  options: LocaleMiddlewareOptions = {}
): string {
  const middleware = new LocaleMiddleware(options);
  return middleware['detectLocale'](req);
}

/**
 * Locale detection for React Native
 */
export function detectLocaleFromDevice(): string {
  if (typeof navigator !== 'undefined') {
    // Browser environment
    return navigator.language.split('-')[0] || 'en';
  }
  
  // React Native environment
  try {
    const { NativeModules, Platform } = require('react-native');
    
    if (Platform.OS === 'ios') {
      return (
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        'en'
      ).split('-')[0];
    } else {
      return (NativeModules.I18nManager?.localeIdentifier || 'en').split('-')[0];
    }
  } catch (error) {
    return 'en';
  }
}