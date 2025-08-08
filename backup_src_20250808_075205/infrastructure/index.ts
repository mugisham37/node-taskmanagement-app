// Database exports
export * from './database/prisma-client';
export * from './database/unit-of-work';
export * from './database/base-repository';

// Repository implementations
export * from './repositories/task.repository.impl';
export * from './repositories/project.repository.impl';

// Caching exports
export * from './cache/redis-client';
export * from './cache/cache-manager';

// External services exports
export * from './external-services/circuit-breaker';
export * from './external-services/service-factory';
export * from './external-services/email/email-service';

// Logging exports
export * from './logging/logger';

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
