import {
  pgTable,
  varchar,
  text,
  timestamp,
  pgEnum,
  json,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Webhook event enum
export const webhookEventEnum = pgEnum('webhook_event', [
  'task.created',
  'task.updated',
  'task.completed',
  'task.deleted',
  'project.created',
  'project.updated',
  'project.deleted',
  'user.joined',
  'user.left',
  'comment.added',
  'file.uploaded',
]);

// Webhook status enum
export const webhookStatusEnum = pgEnum('webhook_status', [
  'active',
  'inactive',
  'failed',
  'suspended',
]);

// Webhook delivery status enum
export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', [
  'pending',
  'success',
  'failed',
  'retrying',
]);

// Webhooks table
export const webhooks = pgTable(
  'webhooks',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    url: text('url').notNull(),
    secret: varchar('secret', { length: 255 }).notNull(),
    events: json('events').$type<string[]>().notNull(),
    status: webhookStatusEnum('status').notNull().default('active'),
    workspaceId: varchar('workspace_id', { length: 36 }).notNull(),
    createdBy: varchar('created_by', { length: 36 }).notNull(),
    lastTriggeredAt: timestamp('last_triggered_at'),
    failureCount: integer('failure_count').notNull().default(0),
    maxFailures: integer('max_failures').notNull().default(5),
    timeout: integer('timeout').notNull().default(30000), // milliseconds
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),
    headers: json('headers')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    metadata: json('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    // Workspace and status indexes for delivery tracking
    workspaceIdx: index('idx_webhooks_workspace').on(table.workspaceId),
    statusIdx: index('idx_webhooks_status').on(table.status),
    workspaceStatusIdx: index('idx_webhooks_workspace_status').on(
      table.workspaceId,
      table.status
    ),

    // URL index for duplicate detection
    urlIdx: index('idx_webhooks_url').on(table.url),

    // Creator index
    createdByIdx: index('idx_webhooks_created_by').on(table.createdBy),

    // Active webhooks for event delivery
    activeWebhooksIdx: index('idx_webhooks_active').on(
      table.status,
      table.workspaceId
    ),

    // Failed webhooks for monitoring
    failedWebhooksIdx: index('idx_webhooks_failed').on(
      table.status,
      table.failureCount
    ),
  })
);

// Webhook deliveries table with delivery status tracking
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    webhookId: varchar('webhook_id', { length: 36 }).notNull(),
    event: webhookEventEnum('event').notNull(),
    payload: json('payload').$type<Record<string, any>>().notNull(),
    status: webhookDeliveryStatusEnum('status').notNull().default('pending'),
    httpStatus: integer('http_status'),
    responseBody: text('response_body'),
    errorMessage: text('error_message'),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    nextRetryAt: timestamp('next_retry_at'),
    deliveredAt: timestamp('delivered_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    // Webhook relationship index
    webhookIdx: index('idx_webhook_deliveries_webhook').on(
      table.webhookId,
      table.createdAt
    ),

    // Status tracking indexes
    statusIdx: index('idx_webhook_deliveries_status').on(table.status),
    webhookStatusIdx: index('idx_webhook_deliveries_webhook_status').on(
      table.webhookId,
      table.status
    ),

    // Event tracking
    eventIdx: index('idx_webhook_deliveries_event').on(
      table.event,
      table.createdAt
    ),

    // Retry scheduling
    retryIdx: index('idx_webhook_deliveries_retry').on(
      table.status,
      table.nextRetryAt
    ),

    // Pending deliveries for processing
    pendingIdx: index('idx_webhook_deliveries_pending').on(
      table.status,
      table.createdAt
    ),

    // Time-based queries for analytics
    timeIdx: index('idx_webhook_deliveries_time').on(table.createdAt),

    // Delivery success tracking
    deliveredIdx: index('idx_webhook_deliveries_delivered').on(
      table.deliveredAt,
      table.status
    ),
  })
);

// Relations
export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [webhooks.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [webhooks.createdBy],
    references: [users.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(
  webhookDeliveries,
  ({ one }) => ({
    webhook: one(webhooks, {
      fields: [webhookDeliveries.webhookId],
      references: [webhooks.id],
    }),
  })
);

// Import other tables for relations
import { users } from './users';
import { workspaces } from './workspaces';
