// Base repository exports - only technical infrastructure
export * from './base/interfaces';
export * from './base/types';
export { BaseRepository } from './base/base.repository';

// Note: Domain-specific repositories have been moved to their respective domains
// Infrastructure layer now only contains base repository functionality
// Domain repositories can be imported directly from their domain directories:
//
// Authentication: src/domains/authentication/repositories/
// Analytics: src/domains/analytics/repositories/
// Calendar: src/domains/calendar/repositories/
// Collaboration: src/domains/collaboration/repositories/
// File Management: src/domains/file-management/repositories/
// Notification: src/domains/notification/repositories/
// Search: src/domains/search/repositories/
// Task Management: src/domains/task-management/repositories/
// Webhook: src/domains/webhook/repositories/
// System Monitoring: src/domains/system-monitoring/repositories/
// Audit: src/domains/audit/repositories/
