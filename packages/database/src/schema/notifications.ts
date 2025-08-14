import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  pgEnum,
  json,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const notificationTypeEnum = pgEnum('notification_type', [
  'task_assigned',
  'task_completed',
  'task_due_soon',
  'task_overdue',
  'project_created',
  'project_updated',
  'comment_added',
  'mention',
  'workspace_invitation',
  'system_alert',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'push',
  'in_app',
  'sms',
  'webhook',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',
  'sent',
  'delivered',
  'read',
  'failed',
]);

// Notifications table
export const notifications = pgTable(
  'notifications',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 36 }),
    projectId: varchar('project_id', { length: 36 }),
    taskId: varchar('task_id', { length: 36 }),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    data: json('data'),
    channels: json('channels').$type<string[]>().notNull(),
    status: notificationStatusEnum('status').notNull().default('pending'),
    readAt: timestamp('read_at'),
    sentAt: timestamp('sent_at'),
    deliveredAt: timestamp('delivered_at'),
    failureReason: text('failure_reason'),
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),
    scheduledFor: timestamp('scheduled_for'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    // Performance-critical indexes for user queries
    userUnreadIdx: index('idx_notifications_user_unread').on(
      table.userId,
      table.createdAt
    ),
    userStatusIdx: index('idx_notifications_user_status').on(
      table.userId,
      table.status
    ),
    workspaceIdx: index('idx_notifications_workspace').on(table.workspaceId),
    projectIdx: index('idx_notifications_project').on(table.projectId),
    taskIdx: index('idx_notifications_task').on(table.taskId),
    typeIdx: index('idx_notifications_type').on(table.type),
    statusIdx: index('idx_notifications_status').on(table.status),
    scheduledIdx: index('idx_notifications_scheduled').on(table.scheduledFor),
    expiresIdx: index('idx_notifications_expires').on(table.expiresAt),
    // Composite indexes for common queries
    pendingDeliveryIdx: index('idx_notifications_pending_delivery').on(
      table.status,
      table.scheduledFor
    ),
    failedRetryableIdx: index('idx_notifications_failed_retryable').on(
      table.status,
      table.retryCount,
      table.maxRetries
    ),
  })
);

// Notification preferences table
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 36 }),
    emailEnabled: boolean('email_enabled').notNull().default(true),
    pushEnabled: boolean('push_enabled').notNull().default(true),
    inAppEnabled: boolean('in_app_enabled').notNull().default(true),
    smsEnabled: boolean('sms_enabled').notNull().default(false),
    webhookEnabled: boolean('webhook_enabled').notNull().default(false),
    quietHours: json('quiet_hours')
      .$type<{
        enabled: boolean;
        startTime: string;
        endTime: string;
        timezone: string;
      }>()
      .notNull()
      .default({
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'UTC',
      }),
    typePreferences: json('type_preferences')
      .$type<
        Record<
          string,
          {
            enabled: boolean;
            channels: string[];
          }
        >
      >()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    userIdx: index('idx_notification_preferences_user').on(table.userId),
    userWorkspaceIdx: index('idx_notification_preferences_user_workspace').on(
      table.userId,
      table.workspaceId
    ),
  })
);

// Relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [notifications.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [notifications.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [notifications.taskId],
    references: [tasks.id],
  }),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
    workspace: one(workspaces, {
      fields: [notificationPreferences.workspaceId],
      references: [workspaces.id],
    }),
  })
);

// Import other tables for relations
import { users } from './users';
import { workspaces } from './workspaces';
import { projects } from './projects';
import { tasks } from './tasks';