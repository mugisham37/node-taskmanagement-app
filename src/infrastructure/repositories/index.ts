/**
 * Consolidated Repository Implementations
 * Single point of access for all repository implementations
 */

// Authentication repositories
export * from './authentication';

// Task management repositories
export * from './task-management';

// Calendar repositories
export * from './calendar';

// Base repository
export { BasePrismaRepository } from '../database/base-repository';
