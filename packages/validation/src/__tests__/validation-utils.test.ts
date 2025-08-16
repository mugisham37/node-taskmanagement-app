import { describe, expect, it } from 'vitest';
import { ValidationUtils } from '../validation-utils';

describe('ValidationUtils', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(ValidationUtils.isValidEmail('test@example.com')).toBe(true);
      expect(ValidationUtils.isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(ValidationUtils.isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(ValidationUtils.isValidEmail('invalid-email')).toBe(false);
      expect(ValidationUtils.isValidEmail('test@')).toBe(false);
      expect(ValidationUtils.isValidEmail('@example.com')).toBe(false);
      expect(ValidationUtils.isValidEmail('')).toBe(false);
      expect(ValidationUtils.isValidEmail(null as any)).toBe(false);
    });
  });

  describe('isStrongPassword', () => {
    it('should validate strong passwords', () => {
      expect(ValidationUtils.isStrongPassword('Password123!')).toBe(true);
      expect(ValidationUtils.isStrongPassword('MyStr0ng@Pass')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(ValidationUtils.isStrongPassword('password')).toBe(false); // No uppercase, number, special char
      expect(ValidationUtils.isStrongPassword('PASSWORD')).toBe(false); // No lowercase, number, special char
      expect(ValidationUtils.isStrongPassword('Password')).toBe(false); // No number, special char
      expect(ValidationUtils.isStrongPassword('Pass123')).toBe(false); // No special char
      expect(ValidationUtils.isStrongPassword('Pass!')).toBe(false); // Too short
      expect(ValidationUtils.isStrongPassword('')).toBe(false);
      expect(ValidationUtils.isStrongPassword(null as any)).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUIDs', () => {
      expect(ValidationUtils.isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(ValidationUtils.isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(ValidationUtils.isValidUUID('invalid-uuid')).toBe(false);
      expect(ValidationUtils.isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(ValidationUtils.isValidUUID('')).toBe(false);
      expect(ValidationUtils.isValidUUID(null as any)).toBe(false);
    });
  });

  describe('isNotEmpty', () => {
    it('should validate non-empty strings', () => {
      expect(ValidationUtils.isNotEmpty('hello')).toBe(true);
      expect(ValidationUtils.isNotEmpty('  world  ')).toBe(true);
    });

    it('should reject empty strings', () => {
      expect(ValidationUtils.isNotEmpty('')).toBe(false);
      expect(ValidationUtils.isNotEmpty('   ')).toBe(false);
      expect(ValidationUtils.isNotEmpty(null as any)).toBe(false);
    });
  });

  describe('isLengthInRange', () => {
    it('should validate strings within range', () => {
      expect(ValidationUtils.isLengthInRange('hello', 3, 10)).toBe(true);
      expect(ValidationUtils.isLengthInRange('test', 4, 4)).toBe(true);
    });

    it('should reject strings outside range', () => {
      expect(ValidationUtils.isLengthInRange('hi', 3, 10)).toBe(false);
      expect(ValidationUtils.isLengthInRange('this is too long', 3, 10)).toBe(false);
      expect(ValidationUtils.isLengthInRange('', 1, 10)).toBe(false);
    });
  });

  describe('isNumberInRange', () => {
    it('should validate numbers within range', () => {
      expect(ValidationUtils.isNumberInRange(5, 1, 10)).toBe(true);
      expect(ValidationUtils.isNumberInRange(1, 1, 10)).toBe(true);
      expect(ValidationUtils.isNumberInRange(10, 1, 10)).toBe(true);
    });

    it('should reject numbers outside range', () => {
      expect(ValidationUtils.isNumberInRange(0, 1, 10)).toBe(false);
      expect(ValidationUtils.isNumberInRange(11, 1, 10)).toBe(false);
      expect(ValidationUtils.isNumberInRange(NaN, 1, 10)).toBe(false);
    });
  });

  describe('isPositiveInteger', () => {
    it('should validate positive integers', () => {
      expect(ValidationUtils.isPositiveInteger(1)).toBe(true);
      expect(ValidationUtils.isPositiveInteger(100)).toBe(true);
    });

    it('should reject non-positive integers', () => {
      expect(ValidationUtils.isPositiveInteger(0)).toBe(false);
      expect(ValidationUtils.isPositiveInteger(-1)).toBe(false);
      expect(ValidationUtils.isPositiveInteger(1.5)).toBe(false);
      expect(ValidationUtils.isPositiveInteger(NaN)).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(ValidationUtils.isValidUrl('https://example.com')).toBe(true);
      expect(ValidationUtils.isValidUrl('http://localhost:3000')).toBe(true);
      expect(ValidationUtils.isValidUrl('https://sub.domain.com/path?query=1')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(ValidationUtils.isValidUrl('invalid-url')).toBe(false);
      expect(ValidationUtils.isValidUrl('ftp://example.com')).toBe(false);
      expect(ValidationUtils.isValidUrl('')).toBe(false);
      expect(ValidationUtils.isValidUrl(null as any)).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should sanitize strings by removing HTML tags', () => {
      expect(ValidationUtils.sanitizeString('<script>alert("xss")</script>Hello')).toBe('Hello');
      expect(ValidationUtils.sanitizeString('<b>Bold</b> text')).toBe('Bold text');
      expect(ValidationUtils.sanitizeString('  Normal text  ')).toBe('Normal text');
    });

    it('should handle null and undefined inputs', () => {
      expect(ValidationUtils.sanitizeString(null as any)).toBe('');
      expect(ValidationUtils.sanitizeString(undefined as any)).toBe('');
    });
  });

  describe('isNotEmptyArray', () => {
    it('should validate non-empty arrays', () => {
      expect(ValidationUtils.isNotEmptyArray([1, 2, 3])).toBe(true);
      expect(ValidationUtils.isNotEmptyArray(['a'])).toBe(true);
    });

    it('should reject empty arrays and non-arrays', () => {
      expect(ValidationUtils.isNotEmptyArray([])).toBe(false);
      expect(ValidationUtils.isNotEmptyArray(null as any)).toBe(false);
      expect(ValidationUtils.isNotEmptyArray('not an array' as any)).toBe(false);
    });
  });

  describe('hasRequiredFields', () => {
    it('should validate objects with required fields', () => {
      const obj = { name: 'John', email: 'john@example.com', age: 30 };
      expect(ValidationUtils.hasRequiredFields(obj, ['name', 'email'])).toBe(true);
    });

    it('should reject objects missing required fields', () => {
      const obj = { name: 'John' };
      expect(ValidationUtils.hasRequiredFields(obj, ['name', 'email'])).toBe(false);
      expect(ValidationUtils.hasRequiredFields(null as any, ['name'])).toBe(false);
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should validate phone numbers', () => {
      expect(ValidationUtils.isValidPhoneNumber('+1234567890')).toBe(true);
      expect(ValidationUtils.isValidPhoneNumber('(123) 456-7890')).toBe(true);
      expect(ValidationUtils.isValidPhoneNumber('123-456-7890')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(ValidationUtils.isValidPhoneNumber('123')).toBe(false);
      expect(ValidationUtils.isValidPhoneNumber('abc')).toBe(false);
      expect(ValidationUtils.isValidPhoneNumber('')).toBe(false);
    });
  });

  describe('isValidISODate', () => {
    it('should validate ISO date strings', () => {
      expect(ValidationUtils.isValidISODate('2023-12-25T10:30:00.000Z')).toBe(true);
    });

    it('should reject invalid date strings', () => {
      expect(ValidationUtils.isValidISODate('2023-12-25')).toBe(false);
      expect(ValidationUtils.isValidISODate('invalid-date')).toBe(false);
      expect(ValidationUtils.isValidISODate('')).toBe(false);
    });
  });

  describe('isValidEnumValue', () => {
    enum TestEnum {
      VALUE1 = 'value1',
      VALUE2 = 'value2',
    }

    it('should validate enum values', () => {
      expect(ValidationUtils.isValidEnumValue('value1', TestEnum)).toBe(true);
      expect(ValidationUtils.isValidEnumValue('value2', TestEnum)).toBe(true);
    });

    it('should reject invalid enum values', () => {
      expect(ValidationUtils.isValidEnumValue('value3', TestEnum)).toBe(false);
      expect(ValidationUtils.isValidEnumValue('', TestEnum)).toBe(false);
    });
  });
});