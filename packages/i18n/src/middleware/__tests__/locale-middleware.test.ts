import { describe, expect, it } from 'vitest';
import {
    createLocaleMiddleware,
    detectLocaleFromDevice,
    detectLocaleFromNextRequest,
    LocaleMiddleware
} from '../locale-middleware';

describe('Locale Middleware', () => {
  describe('detectLocaleFromDevice', () => {
    it('should detect locale from navigator', () => {
      // Mock navigator
      const mockNavigator = {
        language: 'en-US',
        languages: ['en-US', 'en', 'es'],
      };
      
      global.navigator = mockNavigator as any;
      
      const result = detectLocaleFromDevice();
      expect(result).toBe('en');
    });

    it('should handle missing navigator', () => {
      const originalNavigator = global.navigator;
      delete (global as any).navigator;
      
      const result = detectLocaleFromDevice();
      expect(result).toBe('en'); // Should fallback to default
      
      global.navigator = originalNavigator;
    });

    it('should extract language code from locale', () => {
      const mockNavigator = {
        language: 'es-ES',
        languages: ['es-ES'],
      };
      
      global.navigator = mockNavigator as any;
      
      const result = detectLocaleFromDevice();
      expect(result).toBe('es');
    });
  });

  describe('detectLocaleFromNextRequest', () => {
    it('should detect locale from Accept-Language header', () => {
      const mockRequest = {
        headers: {
          'accept-language': 'en-US,en;q=0.9,es;q=0.8',
        },
      };
      
      const result = detectLocaleFromNextRequest(mockRequest as any);
      expect(result).toBe('en');
    });

    it('should handle missing Accept-Language header', () => {
      const mockRequest = {
        headers: {},
      };
      
      const result = detectLocaleFromNextRequest(mockRequest as any);
      expect(result).toBe('en'); // Should fallback to default
    });

    it('should parse complex Accept-Language header', () => {
      const mockRequest = {
        headers: {
          'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      };
      
      const result = detectLocaleFromNextRequest(mockRequest as any);
      expect(result).toBe('fr');
    });
  });

  describe('createLocaleMiddleware', () => {
    it('should create middleware with default options', () => {
      const middleware = createLocaleMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should create middleware with custom options', () => {
      const options = {
        defaultLocale: 'es',
        supportedLocales: ['en', 'es', 'fr'],
        cookieName: 'custom-locale',
      };
      
      const middleware = createLocaleMiddleware(options);
      expect(typeof middleware).toBe('function');
    });
  });

  describe('LocaleMiddleware class', () => {
    it('should initialize with default options', () => {
      const middleware = new LocaleMiddleware();
      expect(middleware).toBeInstanceOf(LocaleMiddleware);
    });

    it('should initialize with custom options', () => {
      const options = {
        defaultLocale: 'fr',
        supportedLocales: ['en', 'fr', 'de'],
      };
      
      const middleware = new LocaleMiddleware(options);
      expect(middleware).toBeInstanceOf(LocaleMiddleware);
    });

    it('should detect locale from various sources', () => {
      const middleware = new LocaleMiddleware();
      
      // Mock request with Accept-Language header
      const mockRequest = {
        headers: {
          'accept-language': 'es-ES,es;q=0.9',
        },
        cookies: {},
      };
      
      const result = middleware.detectLocale(mockRequest as any);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should validate supported locales', () => {
      const middleware = new LocaleMiddleware({
        supportedLocales: ['en', 'es'],
      });
      
      expect(middleware.isSupported('en')).toBe(true);
      expect(middleware.isSupported('es')).toBe(true);
      expect(middleware.isSupported('fr')).toBe(false);
    });

    it('should normalize locale codes', () => {
      const middleware = new LocaleMiddleware();
      
      expect(middleware.normalizeLocale('en-US')).toBe('en');
      expect(middleware.normalizeLocale('es-ES')).toBe('es');
      expect(middleware.normalizeLocale('fr')).toBe('fr');
    });
  });
});