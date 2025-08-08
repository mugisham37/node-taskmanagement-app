/**
 * Consolidated External Service Integrations
 * Single point of access for all external service integrations
 */

// Service factory and base classes
export {
  BaseExternalService,
  ServiceFactory,
  ServiceRegistry,
} from './service-factory';
export type {
  IExternalService,
  ServiceHealthDetails,
  ServiceProvider,
  ServiceFactoryOptions,
} from './service-factory';

// Circuit breaker
export {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitBreakerState,
  CircuitBreakerOpenError,
  WithCircuitBreaker,
} from './circuit-breaker';
export type {
  CircuitBreakerOptions,
  CircuitBreakerStats,
} from './circuit-breaker';

// Email service
export {
  EmailServiceManager,
  createEmailServiceManager,
  getEmailServiceManager,
  BaseEmailService,
  SMTPEmailService,
  SendGridEmailService,
  createEmailService,
} from './consolidated-email-service';
export type {
  IEmailService,
  EmailMessage,
  EmailAttachment,
  EmailSendResult,
  EmailDeliveryStatus,
  EmailTemplate,
} from './consolidated-email-service';

// File storage service
export {
  FileStorageServiceManager,
  createFileStorageServiceManager,
  getFileStorageServiceManager,
  BaseFileStorageService,
  LocalFileStorageService,
  S3FileStorageService,
  createFileStorageService,
} from './consolidated-file-storage-service';
export type {
  IFileStorageService,
  FileMetadata,
  FileUploadOptions,
  FileDownloadOptions,
  FileUploadResult,
  FileInfo,
} from './consolidated-file-storage-service';
