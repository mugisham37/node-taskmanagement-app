import { DomainService } from '../../../shared/domain/domain-service';
import { WebhookDeliveryEntity } from '../entities/webhook-delivery.entity';
import { WebhookEntity } from '../entities/webhook.entity';
import { WebhookDeliveryId } from '../value-objects/webhook-delivery-id';
import { WebhookId } from '../value-objects/webhook-id';
import { WorkspaceId } from '../../task-management/value-objects/workspace-id';
import { WebhookEvent } from '../value-objects/webhook-event';
import { WebhookDeliveryStatus } from '../value-objects/webhook-delivery-status';

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
  metadata: {
    version: string;
    source: string;
    deliveryAttempt: number;
    webhookId: string;
    workspaceId: string;
  };
}

export interface DeliveryResult {
  success: boolean;
  deliveryId: WebhookDeliveryId;
  httpStatusCode?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  duration?: number;
  errorMessage?: string;
  willRetry: boolean;
  nextRetryAt?: Date;
}

export interface BulkDeliveryResult {
  totalWebhooks: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  results: Array<{
    webhookId: WebhookId;
    result: DeliveryResult;
  }>;
}

export interface DeliveryOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  priority?: 'low' | 'normal' | 'high';
  scheduledFor?: Date;
  metadata?: Record<string, any>;
}

export interface WebhookDeliveryService extends DomainService {
  // Core delivery operations
  deliverWebhook(
    webhook: WebhookEntity,
    event: WebhookEvent,
    payload: Record<string, any>,
    options?: DeliveryOptions
  ): Promise<DeliveryResult>;

  deliverToMultipleWebhooks(
    webhooks: WebhookEntity[],
    event: WebhookEvent,
    payload: Record<string, any>,
    options?: DeliveryOptions
  ): Promise<BulkDeliveryResult>;

  deliverEventToWorkspace(
    workspaceId: WorkspaceId,
    event: WebhookEvent,
    payload: Record<string, any>,
    options?: DeliveryOptions
  ): Promise<BulkDeliveryResult>;

  // Scheduled delivery
  scheduleWebhookDelivery(
    webhook: WebhookEntity,
    event: WebhookEvent,
    payload: Record<string, any>,
    scheduledFor: Date,
    options?: Omit<DeliveryOptions, 'scheduledFor'>
  ): Promise<WebhookDeliveryEntity>;

  cancelScheduledDelivery(deliveryId: WebhookDeliveryId): Promise<void>;

  processScheduledDeliveries(batchSize?: number): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }>;

  // Retry management
  retryFailedDelivery(deliveryId: WebhookDeliveryId): Promise<DeliveryResult>;

  retryAllFailedDeliveries(
    webhookId: WebhookId,
    maxAge?: Date
  ): Promise<{
    retried: number;
    successful: number;
    failed: number;
  }>;

  processRetryQueue(batchSize?: number): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }>;

  // Delivery management
  getDelivery(
    deliveryId: WebhookDeliveryId
  ): Promise<WebhookDeliveryEntity | null>;

  getDeliveriesByWebhook(
    webhookId: WebhookId,
    options?: {
      status?: WebhookDeliveryStatus;
      limit?: number;
      offset?: number;
      sortBy?: 'createdAt' | 'deliveredAt' | 'attemptCount';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{
    deliveries: WebhookDeliveryEntity[];
    total: number;
  }>;

  getRecentDeliveries(
    workspaceId: WorkspaceId,
    limit?: number
  ): Promise<WebhookDeliveryEntity[]>;

  getFailedDeliveries(
    webhookId?: WebhookId,
    workspaceId?: WorkspaceId,
    limit?: number
  ): Promise<WebhookDeliveryEntity[]>;

  // Queue management
  getQueueStatus(): Promise<{
    pendingDeliveries: number;
    scheduledDeliveries: number;
    failedDeliveries: number;
    oldestPendingDelivery?: Date;
    averageProcessingTime: number;
    queueHealth: 'healthy' | 'degraded' | 'critical';
  }>;

  pauseDeliveries(webhookId: WebhookId): Promise<void>;
  resumeDeliveries(webhookId: WebhookId): Promise<void>;

  // Payload creation and validation
  createWebhookPayload(
    event: WebhookEvent,
    data: Record<string, any>,
    metadata?: Record<string, any>
  ): WebhookPayload;

  validatePayload(payload: WebhookPayload): {
    isValid: boolean;
    errors: string[];
  };

  // Delivery analytics
  getDeliveryStats(
    webhookId?: WebhookId,
    workspaceId?: WorkspaceId,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingDeliveries: number;
    successRate: number;
    averageResponseTime: number;
    deliveriesByStatus: Record<string, number>;
    deliveriesByEvent: Record<string, number>;
    deliveriesByHour: Array<{
      hour: string;
      count: number;
      successCount: number;
      failureCount: number;
    }>;
  }>;

  getDeliveryTrends(
    webhookId: WebhookId,
    dateRange: { from: Date; to: Date },
    granularity: 'hour' | 'day' | 'week'
  ): Promise<
    Array<{
      period: string;
      totalDeliveries: number;
      successfulDeliveries: number;
      failedDeliveries: number;
      averageResponseTime: number;
      successRate: number;
    }>
  >;

  // Error analysis
  getErrorAnalysis(
    webhookId?: WebhookId,
    workspaceId?: WorkspaceId,
    dateRange?: { from: Date; to: Date }
  ): Promise<
    Array<{
      errorMessage: string;
      count: number;
      percentage: number;
      lastOccurrence: Date;
      affectedWebhooks: string[];
      httpStatusCodes: number[];
    }>
  >;

  getSlowDeliveries(
    thresholdMs: number,
    webhookId?: WebhookId,
    limit?: number
  ): Promise<
    Array<{
      delivery: WebhookDeliveryEntity;
      duration: number;
      webhook: WebhookEntity;
    }>
  >;

  // Health monitoring
  checkDeliveryHealth(webhookId: WebhookId): Promise<{
    isHealthy: boolean;
    recentSuccessRate: number;
    averageResponseTime: number;
    consecutiveFailures: number;
    lastSuccessfulDelivery?: Date;
    issues: string[];
    recommendations: string[];
  }>;

  getSystemHealth(): Promise<{
    overallHealth: 'healthy' | 'degraded' | 'critical';
    queueSize: number;
    processingRate: number;
    errorRate: number;
    averageDeliveryTime: number;
    unhealthyWebhooks: number;
    issues: string[];
  }>;

  // Debugging and testing
  simulateDelivery(
    webhook: WebhookEntity,
    event: WebhookEvent,
    payload: Record<string, any>
  ): Promise<{
    wouldSucceed: boolean;
    estimatedDuration: number;
    potentialIssues: string[];
    recommendations: string[];
  }>;

  traceDelivery(deliveryId: WebhookDeliveryId): Promise<{
    delivery: WebhookDeliveryEntity;
    webhook: WebhookEntity;
    attempts: Array<{
      attemptNumber: number;
      timestamp: Date;
      httpStatusCode?: number;
      responseTime?: number;
      errorMessage?: string;
    }>;
    timeline: Array<{
      timestamp: Date;
      event: string;
      details: Record<string, any>;
    }>;
  }>;

  // Maintenance and cleanup
  cleanupOldDeliveries(
    olderThan: Date,
    keepSuccessful?: boolean
  ): Promise<{
    deletedCount: number;
    freedSpace: number; // in bytes
  }>;

  cleanupFailedDeliveries(
    webhookId: WebhookId,
    olderThan: Date
  ): Promise<number>;

  archiveDeliveries(
    webhookId: WebhookId,
    olderThan: Date
  ): Promise<{
    archivedCount: number;
    archiveLocation: string;
  }>;

  // Batch processing
  processPendingDeliveries(
    batchSize?: number,
    maxProcessingTime?: number
  ): Promise<{
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
    processingTime: number;
  }>;

  // Event-driven delivery
  handleDomainEvent(
    event: any, // Domain event
    workspaceId: WorkspaceId
  ): Promise<BulkDeliveryResult>;

  // Configuration and optimization
  optimizeDeliverySettings(webhookId: WebhookId): Promise<{
    currentSettings: {
      timeout: number;
      maxRetries: number;
      retryDelay: number;
    };
    recommendedSettings: {
      timeout: number;
      maxRetries: number;
      retryDelay: number;
    };
    reasoning: string[];
  }>;

  // Rate limiting and throttling
  checkRateLimit(webhookId: WebhookId): Promise<{
    isAllowed: boolean;
    remainingRequests: number;
    resetTime: Date;
    retryAfter?: number;
  }>;

  setRateLimit(webhookId: WebhookId, requestsPerMinute: number): Promise<void>;
}
