import { z } from 'zod';

// Webhook Event Schema
export const webhookEventSchema = z.enum([
  // Task events
  'task.created',
  'task.updated',
  'task.deleted',
  'task.assigned',
  'task.completed',
  'task.status_changed',
  'task.priority_changed',
  'task.due_date_changed',
  'task.comment_added',

  // Project events
  'project.created',
  'project.updated',
  'project.deleted',
  'project.archived',
  'project.member_added',
  'project.member_removed',

  // Workspace events
  'workspace.created',
  'workspace.updated',
  'workspace.member_added',
  'workspace.member_removed',
  'workspace.member_role_changed',

  // Team events
  'team.created',
  'team.updated',
  'team.deleted',
  'team.member_added',
  'team.member_removed',

  // User events
  'user.created',
  'user.updated',
  'user.deleted',
  'user.login',
  'user.logout',

  // Comment events
  'comment.created',
  'comment.updated',
  'comment.deleted',

  // Notification events
  'notification.created',
  'notification.delivered',
  'notification.read',

  // Calendar events
  'calendar.event_created',
  'calendar.event_updated',
  'calendar.event_deleted',
  'calendar.reminder_sent',

  // System events
  'system.maintenance_started',
  'system.maintenance_completed',
  'system.backup_completed',
  'system.error_occurred',

  // Webhook events
  'webhook.test',
  'webhook.delivery_failed',
]);

// Webhook Status Schema
export const webhookStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'FAILED',
]);

// Webhook Delivery Status Schema
export const webhookDeliveryStatusSchema = z.enum([
  'PENDING',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
]);

// HTTP Method Schema
export const httpMethodSchema = z.enum(['POST', 'PUT', 'PATCH']);

// Content Type Schema
export const contentTypeSchema = z.enum([
  'application/json',
  'application/x-www-form-urlencoded',
]);

// Signature Algorithm Schema
export const signatureAlgorithmSchema = z.enum(['sha256', 'sha1', 'md5']);

// Create Webhook Schema
export const createWebhookSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be less than 200 characters'),

  url: z
    .string()
    .url('Invalid URL format')
    .refine(url => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    }, 'URL must use HTTP or HTTPS protocol'),

  events: z
    .array(webhookEventSchema)
    .min(1, 'At least one event must be specified')
    .max(50, 'Maximum 50 events allowed'),

  secret: z
    .string()
    .min(8, 'Secret must be at least 8 characters')
    .max(256, 'Secret must be less than 256 characters')
    .optional(),

  headers: z
    .record(z.string(), z.string())
    .refine(
      headers => Object.keys(headers).length <= 20,
      'Maximum 20 custom headers allowed'
    )
    .optional(),

  httpMethod: httpMethodSchema.default('POST'),

  contentType: contentTypeSchema.default('application/json'),

  signatureHeader: z
    .string()
    .max(100, 'Signature header name must be less than 100 characters')
    .optional(),

  signatureAlgorithm: signatureAlgorithmSchema.default('sha256'),

  timeout: z
    .number()
    .int('Timeout must be an integer')
    .min(1000, 'Timeout must be at least 1000ms')
    .max(60000, 'Timeout must be at most 60000ms')
    .default(30000),

  maxRetries: z
    .number()
    .int('Max retries must be an integer')
    .min(0, 'Max retries must be at least 0')
    .max(10, 'Max retries must be at most 10')
    .default(3),

  retryDelay: z
    .number()
    .int('Retry delay must be an integer')
    .min(100, 'Retry delay must be at least 100ms')
    .max(60000, 'Retry delay must be at most 60000ms')
    .default(1000),

  metadata: z
    .record(z.any())
    .refine(
      metadata => JSON.stringify(metadata).length <= 10000,
      'Metadata must be less than 10KB when serialized'
    )
    .optional(),
});

// Update Webhook Schema
export const updateWebhookSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be less than 200 characters')
    .optional(),

  url: z
    .string()
    .url('Invalid URL format')
    .refine(url => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    }, 'URL must use HTTP or HTTPS protocol')
    .optional(),

  events: z
    .array(webhookEventSchema)
    .min(1, 'At least one event must be specified')
    .max(50, 'Maximum 50 events allowed')
    .optional(),

  secret: z
    .string()
    .min(8, 'Secret must be at least 8 characters')
    .max(256, 'Secret must be less than 256 characters')
    .nullable()
    .optional(),

  headers: z
    .record(z.string(), z.string())
    .refine(
      headers => Object.keys(headers).length <= 20,
      'Maximum 20 custom headers allowed'
    )
    .optional(),

  httpMethod: httpMethodSchema.optional(),

  contentType: contentTypeSchema.optional(),

  signatureHeader: z
    .string()
    .max(100, 'Signature header name must be less than 100 characters')
    .nullable()
    .optional(),

  signatureAlgorithm: signatureAlgorithmSchema.optional(),

  timeout: z
    .number()
    .int('Timeout must be an integer')
    .min(1000, 'Timeout must be at least 1000ms')
    .max(60000, 'Timeout must be at most 60000ms')
    .optional(),

  maxRetries: z
    .number()
    .int('Max retries must be an integer')
    .min(0, 'Max retries must be at least 0')
    .max(10, 'Max retries must be at most 10')
    .optional(),

  retryDelay: z
    .number()
    .int('Retry delay must be an integer')
    .min(100, 'Retry delay must be at least 100ms')
    .max(60000, 'Retry delay must be at most 60000ms')
    .optional(),

  metadata: z
    .record(z.any())
    .refine(
      metadata => JSON.stringify(metadata).length <= 10000,
      'Metadata must be less than 10KB when serialized'
    )
    .optional(),
});

// Test Webhook Schema
export const testWebhookSchema = z.object({
  payload: z
    .record(z.any())
    .refine(
      payload => JSON.stringify(payload).length <= 100000,
      'Test payload must be less than 100KB when serialized'
    )
    .optional(),
});

// Webhook Query Parameters Schema
export const webhookQuerySchema = z.object({
  page: z.coerce
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),

  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must be at most 100')
    .default(20),

  status: webhookStatusSchema.optional(),

  event: webhookEventSchema.optional(),

  sortBy: z
    .enum([
      'name',
      'status',
      'createdAt',
      'lastDeliveryAt',
      'successCount',
      'failureCount',
    ])
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Webhook Delivery Query Parameters Schema
export const webhookDeliveryQuerySchema = z.object({
  page: z.coerce
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),

  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must be at most 100')
    .default(20),

  status: webhookDeliveryStatusSchema.optional(),

  sortBy: z
    .enum(['createdAt', 'deliveredAt', 'attemptCount', 'duration'])
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Webhook Stats Query Parameters Schema
export const webhookStatsQuerySchema = z
  .object({
    from: z.string().datetime('Invalid from date format').optional(),

    to: z.string().datetime('Invalid to date format').optional(),
  })
  .refine(data => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  }, 'From date must be before or equal to to date');

// Webhook URL Validation Schema
export const webhookUrlSchema = z.object({
  url: z
    .string()
    .url('Invalid URL format')
    .refine(url => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    }, 'URL must use HTTP or HTTPS protocol')
    .refine(url => {
      try {
        const parsed = new URL(url);
        // Prevent localhost and private IP ranges in production
        const hostname = parsed.hostname;
        const isLocalhost =
          hostname === 'localhost' || hostname === '127.0.0.1';
        const isPrivateIP =
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.');

        // In development, allow localhost
        if (process.env.NODE_ENV === 'development') {
          return true;
        }

        return !isLocalhost && !isPrivateIP;
      } catch {
        return false;
      }
    }, 'URL must be publicly accessible (no localhost or private IPs in production)'),
});

// Webhook Signature Verification Schema
export const webhookSignatureSchema = z.object({
  payload: z.string().min(1, 'Payload is required'),

  signature: z
    .string()
    .min(1, 'Signature is required')
    .regex(/^(sha256|sha1|md5)=[a-f0-9]+$/i, 'Invalid signature format'),

  algorithm: signatureAlgorithmSchema.default('sha256'),
});

// Bulk Webhook Operations Schema
export const bulkWebhookOperationSchema = z.object({
  webhookIds: z
    .array(z.string().cuid('Invalid webhook ID'))
    .min(1, 'At least one webhook ID is required')
    .max(100, 'Maximum 100 webhooks can be processed at once'),

  operation: z.enum(['activate', 'deactivate', 'delete']),

  reason: z
    .string()
    .max(500, 'Reason must be less than 500 characters')
    .optional(),
});

// Webhook Event Payload Schema
export const webhookEventPayloadSchema = z.object({
  id: z.string().min(1, 'Event ID is required'),

  event: webhookEventSchema,

  timestamp: z.string().datetime('Invalid timestamp format'),

  data: z
    .record(z.any())
    .refine(
      data => JSON.stringify(data).length <= 1000000,
      'Event data must be less than 1MB when serialized'
    ),

  metadata: z.record(z.any()).optional(),
});

// Webhook Delivery Retry Schema
export const webhookDeliveryRetrySchema = z.object({
  force: z
    .boolean()
    .default(false)
    .describe('Force retry even if max attempts reached'),

  delay: z
    .number()
    .int('Delay must be an integer')
    .min(0, 'Delay must be at least 0ms')
    .max(3600000, 'Delay must be at most 1 hour')
    .optional()
    .describe('Custom delay before retry in milliseconds'),
});

// Export type definitions
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type TestWebhookInput = z.infer<typeof testWebhookSchema>;
export type WebhookQueryInput = z.infer<typeof webhookQuerySchema>;
export type WebhookDeliveryQueryInput = z.infer<
  typeof webhookDeliveryQuerySchema
>;
export type WebhookStatsQueryInput = z.infer<typeof webhookStatsQuerySchema>;
export type WebhookUrlInput = z.infer<typeof webhookUrlSchema>;
export type WebhookSignatureInput = z.infer<typeof webhookSignatureSchema>;
export type BulkWebhookOperationInput = z.infer<
  typeof bulkWebhookOperationSchema
>;
export type WebhookEventPayloadInput = z.infer<
  typeof webhookEventPayloadSchema
>;
export type WebhookDeliveryRetryInput = z.infer<
  typeof webhookDeliveryRetrySchema
>;

// Validation helper functions
export const validateCreateWebhook = (data: unknown): CreateWebhookInput => {
  return createWebhookSchema.parse(data);
};

export const validateUpdateWebhook = (data: unknown): UpdateWebhookInput => {
  return updateWebhookSchema.parse(data);
};

export const validateTestWebhook = (data: unknown): TestWebhookInput => {
  return testWebhookSchema.parse(data);
};

export const validateWebhookQuery = (data: unknown): WebhookQueryInput => {
  return webhookQuerySchema.parse(data);
};

export const validateWebhookDeliveryQuery = (
  data: unknown
): WebhookDeliveryQueryInput => {
  return webhookDeliveryQuerySchema.parse(data);
};

export const validateWebhookStatsQuery = (
  data: unknown
): WebhookStatsQueryInput => {
  return webhookStatsQuerySchema.parse(data);
};

export const validateWebhookUrl = (data: unknown): WebhookUrlInput => {
  return webhookUrlSchema.parse(data);
};

export const validateWebhookSignature = (
  data: unknown
): WebhookSignatureInput => {
  return webhookSignatureSchema.parse(data);
};

export const validateBulkWebhookOperation = (
  data: unknown
): BulkWebhookOperationInput => {
  return bulkWebhookOperationSchema.parse(data);
};

export const validateWebhookEventPayload = (
  data: unknown
): WebhookEventPayloadInput => {
  return webhookEventPayloadSchema.parse(data);
};

export const validateWebhookDeliveryRetry = (
  data: unknown
): WebhookDeliveryRetryInput => {
  return webhookDeliveryRetrySchema.parse(data);
};
