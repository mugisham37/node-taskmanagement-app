import { beforeEach, describe, expect, it } from 'vitest';
import { translationLoader } from '../translation-loader';

describe('TranslationLoader', () => {
  beforeEach(() => {
    // Clear any loaded files before each test
    translationLoader.clearCache();
  });

  describe('File Loading', () => {
    it('should load translation from object', async () => {
      const translations = {
        common: {
          hello: 'Hello',
          goodbye: 'Goodbye',
        },
      };

      await translationLoader.loadFromObject('en', 'translation', translations);
      
      const loaded = translationLoader.getLoadedFiles();
      expect(loaded.size).toBe(1);
      
      const fileKey = 'en:translation';
      expect(loaded.has(fileKey)).toBe(true);
      
      const file = loaded.get(fileKey);
      expect(file?.locale).toBe('en');
      expect(file?.namespace).toBe('translation');
      expect(file?.content).toEqual(translations);
    });

    it('should handle multiple locales', async () => {
      await translationLoader.loadFromObject('en', 'translation', { hello: 'Hello' });
      await translationLoader.loadFromObject('es', 'translation', { hello: 'Hola' });
      
      const loaded = translationLoader.getLoadedFiles();
      expect(loaded.size).toBe(2);
      expect(loaded.has('en:translation')).toBe(true);
      expect(loaded.has('es:translation')).toBe(true);
    });

    it('should handle multiple namespaces', async () => {
      await translationLoader.loadFromObject('en', 'common', { hello: 'Hello' });
      await translationLoader.loadFromObject('en', 'errors', { notFound: 'Not found' });
      
      const loaded = translationLoader.getLoadedFiles();
      expect(loaded.size).toBe(2);
      expect(loaded.has('en:common')).toBe(true);
      expect(loaded.has('en:errors')).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      await translationLoader.loadFromObject('en', 'translation', { hello: 'Hello' });
      expect(translationLoader.getLoadedFiles().size).toBe(1);
      
      translationLoader.clearCache();
      expect(translationLoader.getLoadedFiles().size).toBe(0);
    });

    it('should check if file is loaded', async () => {
      expect(translationLoader.isLoaded('en', 'translation')).toBe(false);
      
      await translationLoader.loadFromObject('en', 'translation', { hello: 'Hello' });
      expect(translationLoader.isLoaded('en', 'translation')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid translation objects', async () => {
      // This should not throw but might log warnings
      await expect(
        translationLoader.loadFromObject('en', 'translation', null as any)
      ).resolves.not.toThrow();
    });

    it('should handle empty translation objects', async () => {
      await translationLoader.loadFromObject('en', 'translation', {});
      
      const loaded = translationLoader.getLoadedFiles();
      expect(loaded.size).toBe(1);
      
      const file = loaded.get('en:translation');
      expect(file?.content).toEqual({});
    });
  });
});