import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from '../../authentication/schemas/users';

// Notification type enum
export const notificationTypeEnum = [
  'task_due_soon',
  'task_overdue',
  'task_assigned',
  'task_completed',
  'task_commented',
  'task_mentioned',
  'project_shared',
  'team_invitation',
  'workspace_invitation',
  'calendar_reminder',
  'system_announcement',
  'system_maintenance',
  'system',
  'reminder',
] as const;

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    data: jsonb('data').notNull().default({}),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at'),
    priority: varchar('priority', { length: 20 }).notNull().default('normal'),
    category: varchar('category', { length: 50 }).notNull().default('general'),
    actionUrl: text('action_url'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
    userIsReadIdx: index('notifications_user_is_read_idx').on(
      table.userId,
      table.isRead
    ),
    userCreatedAtIdx: index('notifications_user_created_at_idx').on(
      table.userId,
      table.createdAt
    ),
    typeIdx: index('notifications_type_idx').on(table.type),
    priorityIdx: index('notifications_priority_idx').on(table.priority),
    categoryIdx: index('notifications_category_idx').on(table.category),
    expiresAtIdx: index('notifications_expires_at_idx').on(table.expiresAt),
  })
);

export const notificationSettings = pgTable(
  'notification_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    emailEnabled: boolean('email_enabled').notNull().default(true),
    pushEnabled: boolean('push_enabled').notNull().default(true),
    smsEnabled: boolean('sms_enabled').notNull().default(false),
    frequency: varchar('frequency', { length: 20 })
      .notNull()
      .default('immediate'),
    quietHoursStart: varchar('quiet_hours_start', { length: 5 }),
    quietHoursEnd: varchar('quiet_hours_end', { length: 5 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
    userTypeIdx: index('notification_settings_user_type_idx').on(
      table.userId,
      table.type
    ),
    enabledIdx: index('notification_settings_enabled_idx').on(table.enabled),
  })
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const notificationSettingsRelations = relations(
  notificationSettings,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationSettings.userId],
      references: [users.id],
    }),
  })
);

export const insertNotificationSchema = createInsertSchema(notifications, {
  type: z.enum(notificationTypeEnum),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(1000),
  data: z.record(z.any()).default({}),
  isRead: z.boolean().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  category: z.string().max(50).optional(),
  actionUrl: z.string().url().optional(),
  expiresAt: z.date().optional(),
});

export const selectNotificationSchema = createSelectSchema(notifications);

export const insertNotificationSettingSchema = createInsertSchema(
  notificationSettings,
  {
    type: z.enum(notificationTypeEnum),
    enabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    frequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).optional(),
    quietHoursStart: z
      .string()
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional(),
    quietHoursEnd: z
      .string()
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional(),
  }
);

export const selectNotificationSettingSchema =
  createSelectSchema(notificationSettings);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationSetting = typeof notificationSettings.$inferSelect;
export type NewNotificationSetting = typeof notificationSettings.$inferInsert;
export type NotificationType = (typeof notificationTypeEnum)[number];
