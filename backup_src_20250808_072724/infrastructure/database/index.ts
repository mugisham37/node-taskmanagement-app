// Database infrastructure exports
export { prisma, checkDatabaseHealth, gracefulShutdown } from './prisma-client';
export type { PrismaClient } from './prisma-client';

export {
  runMigrations,
  resetDatabase,
  generatePrismaClient,
  checkMigrationStatus,
  createMigration,
} from './migration-utils';
export type { MigrationResult } from './migration-utils';

export {
  performDatabaseHealthCheck,
  getDatabaseMetrics,
  checkMaintenanceNeeds,
} from './health-check';
export type { DatabaseHealthStatus } from './health-check';

export { seedDatabase } from './seeds';

// Re-export Prisma types for convenience
export type {
  User,
  Account,
  Session,
  Device,
  WebAuthnCredential,
  Workspace,
  WorkspaceRole,
  WorkspaceMember,
  Project,
  ProjectTemplate,
  ProjectMember,
  Task,
  TaskDependency,
  RecurringTask,
  Team,
  TeamMember,
  Comment,
  Notification,
  Activity,
  AuditLog,
  TimeEntry,
  // Enums
  MemberStatus,
  ProjectStatus,
  ProjectMemberRole,
  TaskStatus,
  Priority,
  DependencyType,
  RecurrencePattern,
  TeamMemberRole,
  NotificationType,
  ActivityType,
} from '@prisma/client';
