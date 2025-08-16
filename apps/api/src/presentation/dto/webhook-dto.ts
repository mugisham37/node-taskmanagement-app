import { z } from 'zod';
import { BaseDto, BaseQuerySchema } from './base-dto';

// Webhook DTOs
export interface WebhookDto extends BaseDto {
  workspaceId: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  headers?: Record<string, string>;
  httpMethod: 'POST' | 'PUT' | 'PATCH';
  contentType: 'application/json' | 'application/x-www-form-urlencoded';
  signatureHeader?: string;
  signatureAlgorithm: 'sha256' | 'sha1' | 'md5';
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  status: 'active' | 'inactive' | 'failed';
  successCount: number;
  failureCount: number;
  deliveryRate: number;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: string;
  lastError?: string;
  metadata?: Record<string, any>;
}

export interface WebhookDeliveryDto extends BaseDto {
  webhookId: string;
  event: string;
  payload: Record<string, any>;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  httpStatusCode?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  errorMessage?: string;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface WebhookEventDto {
  value: string;
  category: string;
  action: string;
  description?: string;
  payloadSchema?: Record<string, any>;
}

export interface WebhookStatsDto {
  webhookId: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  deliveryRate: number;
  averageResponseTime: number;
  lastDeliveryAt?: Date;
  deliveriesByDay: Array<{
    date: string;
    total: number;
    successful: number;
    failed: number;
  }>;
  errorsByType: Record<string, number>;
  responseTimeHistory: Array<{
    timestamp: string;
    responseTime: number;
  }>;
}

export interface WorkspaceWebhookStatsDto {
  workspaceId: string;
  totalWebhooks: number;
  activeWebhooks: number;
  totalDeliveries: number;
  successRate: number;
  averageResponseTime: number;
  webhooksByStatus: Record<string, number>;
  recentActivity: Array<{
    webhookId: string;
    webhookName: string;
    event: string;
    status: string;
    timestamp: string;
  }>;
}

export interface WebhookTestResultDto {
  webhookId: string;
  status: 'success' | 'failed';
  httpStatusCode?: number;
  responseTime: number;
  responseBody?: string;
  errorMessage?: string;
  testedAt: Date;
  testId: string;
}

export interface WebhookValidationResultDto {
  webhookId: string;
  isValid: boolean;
  checks: {
    urlReachable: boolean;
    sslValid: boolean;
    responseTimeAcceptable: boolean;
    authenticationValid: boolean;
  };
  warnings: string[];
  errors: string[];
  validatedAt: Date;
}

// Validation schemas
export const WebhookQuerySchema = BaseQuerySchema.extend({
  status: z.enum(['active', 'inactive', 'failed']).optional(),
  event: z.string().optional(),
});

export const CreateWebhookSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().optional(),
  headers: z.record(z.string()).optional(),
  httpMethod: z.enum(['POST', 'PUT', 'PATCH']).default('POST'),
  contentType: z
    .enum(['application/json', 'application/x-www-form-urlencoded'])
    .default('application/json'),
  signatureHeader: z.string().optional(),
  signatureAlgorithm: z.enum(['sha256', 'sha1', 'md5']).default('sha256'),
  timeout: z.number().min(1).max(30).default(10),
  maxRetries: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(1).max(3600).default(60),
  metadata: z.record(z.any()).optional(),
});

export const UpdateWebhookSchema = CreateWebhookSchema.partial();

export const DeliveryQuerySchema = BaseQuerySchema.extend({
  status: z.enum(['pending', 'success', 'failed', 'retrying']).optional(),
});

export const TestWebhookSchema = z.object({
  payload: z.record(z.any()).optional(),
});

export const WebhookStatsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type WebhookQuery = z.infer<typeof WebhookQuerySchema>;
export type CreateWebhookRequest = z.infer<typeof CreateWebhookSchema>;
export type UpdateWebhookRequest = z.infer<typeof UpdateWebhookSchema>;
export type DeliveryQuery = z.infer<typeof DeliveryQuerySchema>;
export type TestWebhookRequest = z.infer<typeof TestWebhookSchema>;
export type WebhookStatsQuery = z.infer<typeof WebhookStatsQuerySchema>;
