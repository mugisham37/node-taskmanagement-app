import { describe, expect, it } from 'vitest';
import { DomainError, NotFoundError, ValidationError } from '../index';

describe('DomainError', () => {
  describe('constructor', () => {
    it('should create a domain error with message and context', () => {
      const context = { field: 'test', value: 'invalid' };
      const error = new ValidationError('Test error', context);
      
      expect(error.message).toBe('Test error');
      expect(error.context).toEqual(context);
      expect(error.name).toBe('ValidationError');
    });

    it('should create a domain error without context', () => {
      const error = new ValidationError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.context).toBeUndefined();
    });
  });

  describe('ValidationError', () => {
    it('should have correct code and status code', () => {
      const error = new ValidationError('Validation failed');
      
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('NotFoundError', () => {
    it('should have correct code and status code', () => {
      const error = new NotFoundError('Resource not found');
      
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('inheritance', () => {
    it('should be instance of Error', () => {
      const error = new ValidationError('Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DomainError);
    });

    it('should have proper stack trace', () => {
      const error = new ValidationError('Test error');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ValidationError');
    });
  });
});