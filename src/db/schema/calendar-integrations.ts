import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';

// Calendar provider enum
export const calendarProviderEnum = ['google', 'microsoft', 'apple', 'other'] as const;

// Sync direction enum
export const syncDirectionEnum = ['import', 'export', 'both'] as const;

export const calendarIntegrations = pgTable('calendar_integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 20 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  calendarId: varchar('calendar_id', { length: 255 }).notNull(),
  calendarName: varchar('calendar_name', { length: 255 }).notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiry: timestamp('token_expiry'),
  syncEnabled: boolean('sync_enabled').notNull().default(true),
  lastSyncedAt: timestamp('last_synced_at'),
  syncErrors: jsonb('sync_errors').default([]),
  settings: jsonb('settings').notNull().default({
    syncDirection: 'both',
    syncTasks: true,
    syncMeetings: true,
    syncDeadlines: true,
    defaultReminders: [30]
  }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userProviderIdx: index('calendar_integrations_user_provider_idx').on(table.userId, table.provider, table.calendarId),
  providerAccountIdx: index('calendar_integrations_provider_account_idx').on(table.provider, table.providerAccountId),
  syncEnabledIdx: index('calendar_integrations_sync_enabled_idx').on(table.syncEnabled),
  lastSyncedIdx: index('calendar_integrations_last_synced_idx').on(table.lastSyncedAt),
}));

export const calendarIntegrationsRelations = relations(calendarIntegrations, ({ one }) => ({
  user: one(users, {
    fields: [calendarIntegrations.userId],
    references: [users.id],
  }),
}));

export const insertCalendarIntegrationSchema = createInsertSchema(calendarIntegrations, {
  provider: z.enum(calendarProviderEnum),
  providerAccountId: z.string().min(1).max(255),
  calendarId: z.string().min(1).max(255),
  calendarName: z.string().min(1).max(255),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  tokenExpiry: z.date().optional(),
  syncEnabled: z.boolean().optional(),
  lastSyncedAt: z.date().optional(),
  syncErrors: z.array(z.any()).optional(),
  settings: z.object({
    syncDirection: z.enum(syncDirectionEnum).optional(),
    syncTasks: z.boolean().optional(),
    syncMeetings: z.boolean().optional(),
    syncDeadlines: z.boolean().optional(),
    defaultReminders: z.array(z.number().min(0)).optional(),
  }).optional(),
});

export const selectCalendarIntegrationSchema = createSelectSchema(calendarIntegrations);

export type CalendarIntegration = typeof calendarIntegrations.$inferSelect;
export type NewCalendarIntegration = typeof calendarIntegrations.$inferInsert;
export type CalendarProvider = typeof calendarProviderEnum[number];
export type SyncDirection = typeof syncDirectionEnum[number];
