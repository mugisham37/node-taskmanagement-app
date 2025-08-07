import { describe, it, expect } from 'vitest';
import {
  Email,
  Url,
  Money,
  SimpleValueObject,
} from '@/shared/domain/value-object';

describe('Value Objects', () => {
  describe('Email', () => {
    it('should create valid email', () => {
      const email = new Email('test@example.com');
      expect(email.value).toBe('test@example.com');
      expect(email.getDomain()).toBe('example.com');
      expect(email.getLocalPart()).toBe('test');
    });

    it('should throw error for invalid email', () => {
      expect(() => new Email('invalid-email')).toThrow('Invalid email format');
      expect(() => new Email('')).toThrow('Email must be a non-empty string');
    });

    it('should check equality correctly', () => {
      const email1 = new Email('test@example.com');
      const email2 = new Email('test@example.com');
      const email3 = new Email('other@example.com');

      expect(email1.equals(email2)).toBe(true);
      expect(email1.equals(email3)).toBe(false);
    });
  });

  describe('Url', () => {
    it('should create valid URL', () => {
      const url = new Url('https://example.com/path');
      expect(url.value).toBe('https://example.com/path');
      expect(url.getProtocol()).toBe('https:');
      expect(url.getHost()).toBe('example.com');
      expect(url.getPathname()).toBe('/path');
    });

    it('should throw error for invalid URL', () => {
      expect(() => new Url('invalid-url')).toThrow('Invalid URL format');
      expect(() => new Url('')).toThrow('URL must be a non-empty string');
    });
  });

  describe('Money', () => {
    it('should create valid money', () => {
      const money = new Money({ amount: 100.5, currency: 'USD' });
      expect(money.getAmount()).toBe(100.5);
      expect(money.getCurrency()).toBe('USD');
    });

    it('should throw error for invalid money', () => {
      expect(() => new Money({ amount: -10, currency: 'USD' })).toThrow(
        'Amount cannot be negative'
      );
      expect(() => new Money({ amount: 100, currency: 'INVALID' })).toThrow(
        'Currency must be a valid 3-letter ISO code'
      );
    });

    it('should perform arithmetic operations', () => {
      const money1 = new Money({ amount: 100, currency: 'USD' });
      const money2 = new Money({ amount: 50, currency: 'USD' });

      const sum = money1.add(money2);
      expect(sum.getAmount()).toBe(150);
      expect(sum.getCurrency()).toBe('USD');

      const difference = money1.subtract(money2);
      expect(difference.getAmount()).toBe(50);
      expect(difference.getCurrency()).toBe('USD');

      const product = money1.multiply(2);
      expect(product.getAmount()).toBe(200);
      expect(product.getCurrency()).toBe('USD');
    });

    it('should throw error for operations with different currencies', () => {
      const usd = new Money({ amount: 100, currency: 'USD' });
      const eur = new Money({ amount: 100, currency: 'EUR' });

      expect(() => usd.add(eur)).toThrow(
        'Cannot add money with different currencies'
      );
      expect(() => usd.subtract(eur)).toThrow(
        'Cannot subtract money with different currencies'
      );
    });

    it('should check money state', () => {
      const zero = new Money({ amount: 0, currency: 'USD' });
      const positive = new Money({ amount: 100, currency: 'USD' });

      expect(zero.isZero()).toBe(true);
      expect(zero.isPositive()).toBe(false);
      expect(zero.isNegative()).toBe(false);

      expect(positive.isZero()).toBe(false);
      expect(positive.isPositive()).toBe(true);
      expect(positive.isNegative()).toBe(false);
    });
  });

  describe('SimpleValueObject', () => {
    it('should create simple value object', () => {
      const stringValue = new SimpleValueObject('test');
      const numberValue = new SimpleValueObject(42);
      const booleanValue = new SimpleValueObject(true);

      expect(stringValue.value).toBe('test');
      expect(numberValue.value).toBe(42);
      expect(booleanValue.value).toBe(true);
    });

    it('should throw error for null or undefined', () => {
      expect(() => new SimpleValueObject(null as any)).toThrow(
        'Value cannot be null or undefined'
      );
      expect(() => new SimpleValueObject(undefined as any)).toThrow(
        'Value cannot be null or undefined'
      );
    });

    it('should check equality', () => {
      const value1 = new SimpleValueObject('test');
      const value2 = new SimpleValueObject('test');
      const value3 = new SimpleValueObject('other');

      expect(value1.equals(value2)).toBe(true);
      expect(value1.equals(value3)).toBe(false);
    });
  });
});
