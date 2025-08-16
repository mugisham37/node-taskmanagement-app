import { describe, expect, it } from 'vitest';
import {
    AppError,
    createError,
    ErrorAggregator,
    isAppError,
    isOperationalError,
    normalizeError,
    NotFoundError,
    ValidationError
} from '../app-error';

describe('AppError', () => {
  describe('AppError class', () => {
    it('should create an AppError with default values', () => {
      const error = new AppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.status).toBe('error');
    });

    it('should create an AppError with custom values', () => {
      const error = new AppError('Test error', 400, true, 'TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.status).toBe('fail');
      expect(error.code).toBe('TEST_ERROR');
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error', () => {
      const errors = [{ field: 'email', message: 'Invalid email' }];
      const error = new ValidationError('Validation failed', errors);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.errors).toEqual(errors);
    });
  });

  describe('NotFoundError', () => {
    it('should create a not found error', () => {
      const error = new NotFoundError('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND_ERROR');
      expect(error.message).toBe('User not found');
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      const error = new AppError('Test');
      expect(isAppError(error)).toBe(true);
    });

    it('should return false for regular errors', () => {
      const error = new Error('Test');
      expect(isAppError(error)).toBe(false);
    });
  });

  describe('isOperationalError', () => {
    it('should return true for operational errors', () => {
      const error = new AppError('Test', 400, true);
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for non-operational errors', () => {
      const error = new AppError('Test', 500, false);
      expect(isOperationalError(error)).toBe(false);
    });
  });

  describe('normalizeError', () => {
    it('should return AppError as is', () => {
      const error = new AppError('Test');
      expect(normalizeError(error)).toBe(error);
    });

    it('should convert Error to AppError', () => {
      const error = new Error('Test');
      const normalized = normalizeError(error);
      expect(normalized).toBeInstanceOf(AppError);
      expect(normalized.message).toBe('Test');
    });

    it('should convert string to AppError', () => {
      const normalized = normalizeError('Test error');
      expect(normalized).toBeInstanceOf(AppError);
      expect(normalized.message).toBe('Test error');
    });
  });

  describe('createError', () => {
    it('should create an AppError with specified parameters', () => {
      const error = createError('Test error', 400, 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_CODE');
    });
  });

  describe('ErrorAggregator', () => {
    let aggregator: ErrorAggregator;

    beforeEach(() => {
      aggregator = new ErrorAggregator();
    });

    it('should add errors', () => {
      aggregator.add('Test error');
      expect(aggregator.hasErrors()).toBe(true);
      expect(aggregator.count()).toBe(1);
    });

    it('should add AppError instances', () => {
      const error = new ValidationError('Test');
      aggregator.add(error);
      const errors = aggregator.getErrors();
      expect(errors[0]).toBe(error);
    });

    it('should throw if has errors', () => {
      aggregator.add('Test error');
      expect(() => aggregator.throwIfAny()).toThrow(ValidationError);
    });

    it('should clear errors', () => {
      aggregator.add('Test error');
      aggregator.clear();
      expect(aggregator.hasErrors()).toBe(false);
    });
  });
});