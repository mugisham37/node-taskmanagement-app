import { describe, expect, it } from 'vitest';
import { StringUtils } from '../string';

describe('StringUtils', () => {
  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(StringUtils.capitalize('hello')).toBe('Hello');
      expect(StringUtils.capitalize('HELLO')).toBe('Hello');
      expect(StringUtils.capitalize('')).toBe('');
    });
  });

  describe('toCamelCase', () => {
    it('should convert to camelCase', () => {
      expect(StringUtils.toCamelCase('hello world')).toBe('helloWorld');
      expect(StringUtils.toCamelCase('Hello World')).toBe('helloWorld');
      expect(StringUtils.toCamelCase('hello-world')).toBe('helloWorld');
    });
  });

  describe('toKebabCase', () => {
    it('should convert to kebab-case', () => {
      expect(StringUtils.toKebabCase('helloWorld')).toBe('hello-world');
      expect(StringUtils.toKebabCase('Hello World')).toBe('hello-world');
      expect(StringUtils.toKebabCase('hello_world')).toBe('hello-world');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert to snake_case', () => {
      expect(StringUtils.toSnakeCase('helloWorld')).toBe('hello_world');
      expect(StringUtils.toSnakeCase('Hello World')).toBe('hello_world');
      expect(StringUtils.toSnakeCase('hello-world')).toBe('hello_world');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(StringUtils.truncate('Hello World', 5)).toBe('He...');
      expect(StringUtils.truncate('Hello', 10)).toBe('Hello');
      expect(StringUtils.truncate('Hello World', 8, '---')).toBe('Hello---');
    });
  });

  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      expect(StringUtils.stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
      expect(StringUtils.stripHtml('No tags here')).toBe('No tags here');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML characters', () => {
      expect(StringUtils.escapeHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(StringUtils.escapeHtml('Hello & World')).toBe('Hello &amp; World');
    });
  });

  describe('isEmpty', () => {
    it('should check if string is empty', () => {
      expect(StringUtils.isEmpty('')).toBe(true);
      expect(StringUtils.isEmpty('   ')).toBe(true);
      expect(StringUtils.isEmpty(null)).toBe(true);
      expect(StringUtils.isEmpty(undefined)).toBe(true);
      expect(StringUtils.isEmpty('hello')).toBe(false);
    });
  });

  describe('isEmail', () => {
    it('should validate email addresses', () => {
      expect(StringUtils.isEmail('test@example.com')).toBe(true);
      expect(StringUtils.isEmail('invalid-email')).toBe(false);
      expect(StringUtils.isEmail('test@')).toBe(false);
    });
  });

  describe('isUrl', () => {
    it('should validate URLs', () => {
      expect(StringUtils.isUrl('https://example.com')).toBe(true);
      expect(StringUtils.isUrl('http://localhost:3000')).toBe(true);
      expect(StringUtils.isUrl('not-a-url')).toBe(false);
    });
  });

  describe('slugify', () => {
    it('should create URL-friendly slugs', () => {
      expect(StringUtils.slugify('Hello World!')).toBe('hello-world');
      expect(StringUtils.slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
      expect(StringUtils.slugify('Special@#$Characters')).toBe('specialcharacters');
    });
  });

  describe('wordCount', () => {
    it('should count words', () => {
      expect(StringUtils.wordCount('Hello world')).toBe(2);
      expect(StringUtils.wordCount('  Multiple   spaces  ')).toBe(2);
      expect(StringUtils.wordCount('')).toBe(0);
    });
  });

  describe('reverse', () => {
    it('should reverse strings', () => {
      expect(StringUtils.reverse('hello')).toBe('olleh');
      expect(StringUtils.reverse('12345')).toBe('54321');
      expect(StringUtils.reverse('')).toBe('');
    });
  });
});