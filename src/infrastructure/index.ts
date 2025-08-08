// Consolidated Infrastructure Layer Exports

// Database infrastructure
export * from './database';

// Caching infrastructure
export * from './cache';

// Logging infrastructure
export * from './logging';

// Repository implementations
export * from './repositories';

// External service integrations
export * from './external-services';

// Configuration exports
export * from './config/configuration';

// Monitoring exports
export * from './monitoring/metrics';
export * from './monitoring/health-check';

// Security exports
export * from './security/encryption';
export * from './security/authentication';

// Server exports
export * from './server/fastify-server';

// WebSocket exports
export * from './websocket/websocket-manager';

// Storage exports
export * from './storage/file-storage';

// Push notifications exports
export * from './push/push-notification-service';

// Search exports
export * from './search/search-service';

// Webhook exports
export * from './webhook/webhook-service';

// IoC Container exports
export * from './ioc/container';

// Re-export commonly used types and interfaces
export type {
  IUnitOfWork,
  ICacheClient,
  ICacheManager,
  IExternalService,
  ServiceProvider,
  ServiceFactoryOptions,
  EmailMessage,
  EmailSendResult,
  IEmailService,
} from './index';

// Infrastructure setup and initialization
export { InfrastructureBootstrap } from './bootstrap';
