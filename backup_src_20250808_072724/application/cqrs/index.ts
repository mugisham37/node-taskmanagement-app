/**
 * CQRS Infrastructure Exports
 *
 * This module exports all CQRS-related components for easy importing throughout the application.
 */

// Base CQRS infrastructure
export * from './command';
export * from './query';
export * from './command-bus';
export * from './query-bus';

// Task management commands and queries
export * from './commands/task-commands';
export * from './queries/task-queries';

// Task management handlers
export * from './handlers/task-command-handlers';
export * from './handlers/task-query-handlers';

// Validation
export * from './validation/command-validator';
export * from './validation/query-validator';

// CQRS factory for easy setup
export * from './cqrs-factory';
