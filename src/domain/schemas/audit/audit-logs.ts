import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from '../../authentication/schemas/users';

export const auditActionEnum = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'SOFT_DELETE',
  'RESTORE',
  'LOGIN',
  'LOGOUT',
  'PASSWORD_CHANGE',
  'EMAIL_VERIFICATION',
  'PERMISSION_CHANGE',
] as const;

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: varchar('entity_type', { length: 50 }).notNull(), // 'user', 'task', 'project', etc.
    entityId: uuid('entity_id').notNull(),
    action: varchar('action', { length: 30 }).notNull(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    userEmail: varchar('user_email', { length: 255 }), // Store email for deleted users
    ipAddress: varchar('ip_address', { length: 45 }), // IPv6 support
    userAgent: text('user_agent'),
    oldValues: jsonb('old_values'), // Previous state
    newValues: jsonb('new_values'), // New state
    changes: jsonb('changes'), // Specific field changes
    metadata: jsonb('metadata').default({}), // Additional context
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => ({
    entityTypeIdx: index('audit_logs_entity_type_idx').on(table.entityType),
    entityIdIdx: index('audit_logs_entity_id_idx').on(table.entityId),
    userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
    entityTypeIdIdx: index('audit_logs_entity_type_id_idx').on(
      table.entityType,
      table.entityId
    ),
    userActionIdx: index('audit_logs_user_action_idx').on(
      table.userId,
      table.action
    ),
  })
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const insertAuditLogSchema = createInsertSchema(auditLogs, {
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid(),
  action: z.enum(auditActionEnum),
  userId: z.string().uuid().optional(),
  userEmail: z.string().email().optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  oldValues: z.record(z.any()).optional(),
  newValues: z.record(z.any()).optional(),
  changes: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const selectAuditLogSchema = createSelectSchema(auditLogs);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type AuditAction = (typeof auditActionEnum)[number];
