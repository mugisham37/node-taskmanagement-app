import { Repository } from '../../shared/base/repository';
import { WebhookDeliveryEntity } from '../entities/webhook-delivery.entity';
import { WebhookDeliveryId } from '../value-objects/webhook-delivery-id';
import { WebhookId } from '../value-objects/webhook-id';
import { WorkspaceId } from '../../task-management/value-objects/workspace-id';
import { WebhookEvent } from '../value-objects/webhook-event';
import { WebhookDeliveryStatus } from '../value-objects/webhook-delivery-status';

export interface WebhookDeliveryFilters {
  webhookId?: WebhookId;
  webhookIds?: WebhookId[];
  workspaceId?: WorkspaceId;
  event?: WebhookEvent;
  events?: WebhookEvent[];
  status?: WebhookDeliveryStatus;
  statuses?: WebhookDeliveryStatus[];
  createdAfter?: Date;
  createdBefore?: Date;
  deliveredAfter?: Date;
  deliveredBefore?: Date;
  nextRetryBefore?: Date;
  httpStatusCode?: number;
  httpStatusCodes?: number[];
  hasError?: boolean;
  attemptCountMin?: number;
  attemptCountMax?: number;
}

export interface WebhookDeliveryQueryOptions {
  page?: number;
  limit?: number;
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'deliveredAt'
    | 'nextRetryAt'
    | 'attemptCount'
    | 'duration';
  sortOrder?: 'asc' | 'desc';
}

export interface WebhookDeliveryStats {
  total: number;
  pending: number;
  delivered: number;
  failed: number;
  totalAttempts: number;
  averageAttempts: number;
  averageDuration: number;
  successRate: number;
  byEvent: Record<string, { total: number; delivered: number; failed: number }>;
  byHttpStatus: Record<number, number>;
  deliveriesByHour: Array<{
    hour: string;
    count: number;
    successCount: number;
    failureCount: number;
  }>;
}

export interface WebhookRepository
  extends Repository<WebhookDeliveryEntity, WebhookDeliveryId> {
  // Basic CRUD operations
  findById(id: WebhookDeliveryId): Promise<WebhookDeliveryEntity | null>;
  findByIds(ids: WebhookDeliveryId[]): Promise<WebhookDeliveryEntity[]>;
  save(delivery: WebhookDeliveryEntity): Promise<void>;
  delete(id: WebhookDeliveryId): Promise<void>;

  // Query operations
  findMany(
    filters?: WebhookDeliveryFilters,
    options?: WebhookDeliveryQueryOptions
  ): Promise<{
    deliveries: WebhookDeliveryEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  findByWebhook(
    webhookId: WebhookId,
    options?: WebhookDeliveryQueryOptions
  ): Promise<WebhookDeliveryEntity[]>;

  findByWorkspace(
    workspaceId: WorkspaceId,
    options?: WebhookDeliveryQueryOptions
  ): Promise<WebhookDeliveryEntity[]>;

  // Status-based queries
  findPending(limit?: number): Promise<WebhookDeliveryEntity[]>;
  findFailed(limit?: number): Promise<WebhookDeliveryEntity[]>;
  findDelivered(
    dateRange?: { from: Date; to: Date },
    limit?: number
  ): Promise<WebhookDeliveryEntity[]>;

  // Retry operations
  findReadyForRetry(limit?: number): Promise<WebhookDeliveryEntity[]>;
  findOverdueRetries(limit?: number): Promise<WebhookDeliveryEntity[]>;

  // Recent deliveries
  findRecentDeliveries(
    webhookId: WebhookId,
    limit?: number
  ): Promise<WebhookDeliveryEntity[]>;

  findRecentFailures(
    webhookId: WebhookId,
    limit?: number
  ): Promise<WebhookDeliveryEntity[]>;

  // Bulk operations
  markAsDelivered(
    ids: WebhookDeliveryId[],
    httpStatusCode: number,
    responseBody?: string,
    duration?: number
  ): Promise<number>;

  markAsFailed(
    ids: WebhookDeliveryId[],
    errorMessage: string,
    httpStatusCode?: number
  ): Promise<number>;

  cancelPendingDeliveries(webhookId: WebhookId): Promise<number>;

  deleteByWebhook(webhookId: WebhookId): Promise<number>;
  deleteByWorkspace(workspaceId: WorkspaceId): Promise<number>;

  // Analytics
  getStats(
    webhookId?: WebhookId,
    workspaceId?: WorkspaceId,
    dateRange?: { from: Date; to: Date }
  ): Promise<WebhookDeliveryStats>;

  getDeliveryTrends(
    webhookId: WebhookId,
    dateRange: { from: Date; to: Date },
    granularity: 'hour' | 'day' | 'week'
  ): Promise<
    Array<{
      period: string;
      total: number;
      delivered: number;
      failed: number;
      averageDuration: number;
    }>
  >;

  getErrorAnalysis(
    webhookId?: WebhookId,
    dateRange?: { from: Date; to: Date }
  ): Promise<
    Array<{
      errorMessage: string;
      count: number;
      lastOccurrence: Date;
      httpStatusCodes: number[];
    }>
  >;

  // Health monitoring
  findConsecutiveFailures(
    webhookId: WebhookId,
    minCount: number
  ): Promise<WebhookDeliveryEntity[]>;

  findSlowDeliveries(
    minDuration: number,
    limit?: number
  ): Promise<WebhookDeliveryEntity[]>;

  getHealthMetrics(webhookId: WebhookId): Promise<{
    recentSuccessRate: number; // Last 100 deliveries
    averageResponseTime: number; // Last 24 hours
    consecutiveFailures: number;
    lastSuccessfulDelivery?: Date;
    lastFailedDelivery?: Date;
  }>;

  // Maintenance
  cleanupOldDeliveries(olderThan: Date): Promise<number>;
  cleanupSuccessfulDeliveries(
    olderThan: Date,
    keepCount?: number
  ): Promise<number>;

  // Queue management
  getQueueSize(): Promise<number>;
  getOldestPendingDelivery(): Promise<WebhookDeliveryEntity | null>;

  // Debugging
  findDeliveriesWithPayload(
    webhookId: WebhookId,
    payloadMatch: Record<string, any>
  ): Promise<WebhookDeliveryEntity[]>;
}
