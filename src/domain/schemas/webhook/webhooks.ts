import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { workspaces } from '../../task-management/schemas/workspaces';
import { users } from '../../authentication/schemas/users';

export const webhookStatusEnum = pgEnum('WebhookStatus', [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'FAILED',
]);
export const webhookDeliveryStatusEnum = pgEnum('WebhookDeliveryStatus', [
  'PENDING',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
]);

export const webhooks = pgTable(
  'webhooks',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    secret: text('secret'),
    status: webhookStatusEnum('status').notNull().default('ACTIVE'),
    events: text('events').array(),
    headers: jsonb('headers').notNull().default({}),
    httpMethod: text('http_method').notNull().default('POST'),
    contentType: text('content_type').notNull().default('application/json'),
    signatureHeader: text('signature_header'),
    signatureAlgorithm: text('signature_algorithm').notNull().default('sha256'),
    timeout: integer('timeout').notNull().default(30000),
    maxRetries: integer('max_retries').notNull().default(3),
    retryDelay: integer('retry_delay').notNull().default(1000),
    metadata: jsonb('metadata').notNull().default({}),
    successCount: integer('success_count').notNull().default(0),
    failureCount: integer('failure_count').notNull().default(0),
    lastDeliveryAt: timestamp('last_delivery_at'),
    lastDeliveryStatus: text('last_delivery_status'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  table => ({
    workspaceIdIdx: index('webhooks_workspace_id_idx').on(table.workspaceId),
    userIdIdx: index('webhooks_user_id_idx').on(table.userId),
    statusIdx: index('webhooks_status_idx').on(table.status),
    createdAtIdx: index('webhooks_created_at_idx').on(table.createdAt),
  })
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    webhookId: text('webhook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    payload: jsonb('payload').notNull(),
    status: webhookDeliveryStatusEnum('status').notNull().default('PENDING'),
    httpStatusCode: integer('http_status_code'),
    responseBody: text('response_body'),
    responseHeaders: jsonb('response_headers'),
    errorMessage: text('error_message'),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    nextRetryAt: timestamp('next_retry_at'),
    deliveredAt: timestamp('delivered_at'),
    duration: integer('duration'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  table => ({
    webhookIdIdx: index('webhook_deliveries_webhook_id_idx').on(
      table.webhookId
    ),
    workspaceIdIdx: index('webhook_deliveries_workspace_id_idx').on(
      table.workspaceId
    ),
    statusIdx: index('webhook_deliveries_status_idx').on(table.status),
    eventIdx: index('webhook_deliveries_event_idx').on(table.event),
    createdAtIdx: index('webhook_deliveries_created_at_idx').on(
      table.createdAt
    ),
    nextRetryAtIdx: index('webhook_deliveries_next_retry_at_idx').on(
      table.nextRetryAt
    ),
    deliveredAtIdx: index('webhook_deliveries_delivered_at_idx').on(
      table.deliveredAt
    ),
  })
);

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
