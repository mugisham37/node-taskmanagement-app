export { ValidationMiddleware } from '@taskmanagement/validation/middleware';
export * from './auth-middleware';
export * from './cors-middleware';
export * from './error-handler-middleware';
export * from './rate-limit-middleware';
export * from './security-middleware';
export { setupMiddleware } from './setup';

// Enhanced middleware from migration
export * from './comprehensive-security-middleware';

// Phase 7 comprehensive middleware
export { ComprehensiveValidationMiddleware } from '@taskmanagement/validation/middleware';
export * from './standardized-response-middleware';
