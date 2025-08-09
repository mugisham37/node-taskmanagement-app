import {
  pgTable,
  varchar,
  text,
  timestamp,
  pgEnum,
  json,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Audit action enum
export const auditActionEnum = pgEnum('audit_action', [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'PASSWORD_CHANGE',
  'EMAIL_VERIFICATION',
  'PERMISSION_CHANGE',
  'EXPORT',
  'IMPORT',
  'SHARE',
  'ARCHIVE',
  'RESTORE',
]);

// Audit logs table with time-series optimization
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 36 }).notNull(),
    action: auditActionEnum('action').notNull(),
    userId: varchar('user_id', { length: 36 }),
    userEmail: varchar('user_email', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 45 }), // IPv6 compatible
    userAgent: text('user_agent'),
    oldValues: json('old_values'),
    newValues: json('new_values'),
    changes: json('changes'),
    metadata: json('metadata').notNull().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    // Time-series optimization indexes
    entityIdx: index('idx_audit_logs_entity').on(
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    userIdx: index('idx_audit_logs_user').on(table.userId, table.createdAt),
    actionIdx: index('idx_audit_logs_action').on(table.action, table.createdAt),
    timeIdx: index('idx_audit_logs_time').on(table.createdAt),

    // Security event indexes
    securityEventsIdx: index('idx_audit_logs_security').on(
      table.action,
      table.userId,
      table.createdAt
    ),

    // Entity-specific indexes
    entityTypeIdx: index('idx_audit_logs_entity_type').on(
      table.entityType,
      table.createdAt
    ),

    // IP address tracking for security
    ipAddressIdx: index('idx_audit_logs_ip').on(
      table.ipAddress,
      table.createdAt
    ),

    // Composite indexes for common queries
    entityActionIdx: index('idx_audit_logs_entity_action').on(
      table.entityType,
      table.entityId,
      table.action
    ),
    userActionIdx: index('idx_audit_logs_user_action').on(
      table.userId,
      table.action,
      table.createdAt
    ),
  })
);

// Relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Import other tables for relations
import { users } from './users';
