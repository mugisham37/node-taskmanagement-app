// Export all shared types and interfaces
export * from './common.types';
export * from './event.interface';
export * from './logger.interface';
// Note: ValidationError is exported from errors module to avoid conflicts
export type {
  ValidationResult,
  Validator,
  ValidationRule,
  ValidationSchema,
  ValidationContext,
  ValidatorOptions,
  FieldValidator,
  SchemaBuilder,
  ValidationMiddleware,
  ValidationDecorator,
  ValidationCache,
  ValidationMetrics,
  ValidationProfile,
  ValidationReport,
} from './validator.interface';
