import { DomainService } from '../../shared/base/domain-service';
import { WebhookEntity } from '../entities/webhook.entity';
import { WebhookId } from '../value-objects/webhook-id';
import { WorkspaceId } from '../../task-management/value-objects/workspace-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { WebhookUrl } from '../value-objects/webhook-url';
import { WebhookSecret } from '../value-objects/webhook-secret';
import { WebhookEvent } from '../value-objects/webhook-event';
import { WebhookStatus } from '../value-objects/webhook-status';
import { WebhookRepository } from '../repositories/webhook.repository';

export interface CreateWebhookRequest {
  workspaceId: WorkspaceId;
  userId: UserId;
  name: string;
  url: WebhookUrl;
  events: WebhookEvent[];
  secret?: WebhookSecret;
  headers?: Record<string, string>;
  httpMethod?: 'POST' | 'PUT' | 'PATCH';
  contentType?: 'application/json' | 'application/x-www-form-urlencoded';
  signatureHeader?: string;
  signatureAlgorithm?: 'sha256' | 'sha1' | 'md5';
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  metadata?: Record<string, any>;
}

export interface UpdateWebhookRequest {
  name?: string;
  url?: WebhookUrl;
  events?: WebhookEvent[];
  secret?: WebhookSecret;
  headers?: Record<string, string>;
  httpMethod?: 'POST' | 'PUT' | 'PATCH';
  contentType?: 'application/json' | 'application/x-www-form-urlencoded';
  signatureHeader?: string;
  signatureAlgorithm?: 'sha256' | 'sha1' | 'md5';
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  metadata?: Record<string, any>;
}

export interface WebhookTestResult {
  success: boolean;
  httpStatusCode?: number;
  responseTime?: number;
  responseBody?: string;
  errorMessage?: string;
  timestamp: Date;
}

export interface WebhookValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface WebhookManagementService extends DomainService {
  // Webhook lifecycle management
  createWebhook(request: CreateWebhookRequest): Promise<WebhookEntity>;

  updateWebhook(
    webhookId: WebhookId,
    request: UpdateWebhookRequest,
    userId: UserId
  ): Promise<WebhookEntity>;

  deleteWebhook(webhookId: WebhookId, userId: UserId): Promise<void>;

  activateWebhook(webhookId: WebhookId, userId: UserId): Promise<WebhookEntity>;

  deactivateWebhook(
    webhookId: WebhookId,
    userId: UserId
  ): Promise<WebhookEntity>;

  suspendWebhook(
    webhookId: WebhookId,
    userId: UserId,
    reason: string
  ): Promise<WebhookEntity>;

  // Webhook retrieval
  getWebhook(webhookId: WebhookId, userId: UserId): Promise<WebhookEntity>;

  getWebhooksByWorkspace(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<WebhookEntity[]>;

  getWebhooksByUser(userId: UserId): Promise<WebhookEntity[]>;

  getActiveWebhooksForEvent(
    event: WebhookEvent,
    workspaceId: WorkspaceId
  ): Promise<WebhookEntity[]>;

  // Webhook testing and validation
  testWebhook(
    webhookId: WebhookId,
    userId: UserId,
    customPayload?: Record<string, any>
  ): Promise<WebhookTestResult>;

  testWebhookUrl(
    url: WebhookUrl,
    userId: UserId,
    testPayload?: Record<string, any>
  ): Promise<WebhookTestResult>;

  validateWebhookConfiguration(
    webhookId: WebhookId,
    userId: UserId
  ): Promise<WebhookValidationResult>;

  validateWebhookUrl(url: WebhookUrl): Promise<WebhookValidationResult>;

  // Webhook security
  generateWebhookSecret(): WebhookSecret;

  rotateWebhookSecret(
    webhookId: WebhookId,
    userId: UserId
  ): Promise<{ webhook: WebhookEntity; newSecret: WebhookSecret }>;

  verifyWebhookSignature(
    webhookId: WebhookId,
    payload: string,
    signature: string,
    algorithm?: 'sha256' | 'sha1' | 'md5'
  ): Promise<boolean>;

  // Webhook analytics
  getWebhookStats(
    webhookId: WebhookId,
    userId: UserId,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    successRate: number;
    averageResponseTime: number;
    lastDeliveryAt?: Date;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  }>;

  getWorkspaceWebhookStats(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<{
    totalWebhooks: number;
    activeWebhooks: number;
    totalDeliveries: number;
    overallSuccessRate: number;
    webhooksByEvent: Record<string, number>;
  }>;

  // Webhook health monitoring
  checkWebhookHealth(webhookId: WebhookId): Promise<{
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
    lastCheck: Date;
  }>;

  getUnhealthyWebhooks(workspaceId?: WorkspaceId): Promise<
    Array<{
      webhook: WebhookEntity;
      issues: string[];
      severity: 'low' | 'medium' | 'high';
    }>
  >;

  // Bulk operations
  bulkUpdateWebhooks(
    webhookIds: WebhookId[],
    updates: Partial<UpdateWebhookRequest>,
    userId: UserId
  ): Promise<{
    updated: number;
    failed: number;
    errors: Array<{ webhookId: string; error: string }>;
  }>;

  bulkDeleteWebhooks(
    webhookIds: WebhookId[],
    userId: UserId
  ): Promise<{
    deleted: number;
    failed: number;
    errors: Array<{ webhookId: string; error: string }>;
  }>;

  // Webhook discovery and management
  findDuplicateWebhooks(
    workspaceId: WorkspaceId
  ): Promise<Array<{ url: string; webhooks: WebhookEntity[] }>>;

  findUnusedWebhooks(
    workspaceId: WorkspaceId,
    unusedForDays: number
  ): Promise<WebhookEntity[]>;

  optimizeWebhookConfiguration(
    webhookId: WebhookId,
    userId: UserId
  ): Promise<{
    currentConfig: any;
    recommendedConfig: any;
    improvements: string[];
  }>;

  // Event management
  getSupportedEvents(): WebhookEvent[];

  getEventsByCategory(category: string): WebhookEvent[];

  validateEvents(events: WebhookEvent[]): {
    valid: WebhookEvent[];
    invalid: string[];
  };

  // Webhook templates and presets
  createWebhookFromTemplate(
    templateName: string,
    workspaceId: WorkspaceId,
    userId: UserId,
    customizations?: Partial<CreateWebhookRequest>
  ): Promise<WebhookEntity>;

  getWebhookTemplates(): Array<{
    name: string;
    description: string;
    events: WebhookEvent[];
    recommendedSettings: Partial<CreateWebhookRequest>;
  }>;

  // Maintenance and cleanup
  cleanupOldWebhooks(
    workspaceId: WorkspaceId,
    olderThan: Date
  ): Promise<number>;

  resetWebhookFailureCounts(webhookIds: WebhookId[]): Promise<number>;

  archiveInactiveWebhooks(
    workspaceId: WorkspaceId,
    inactiveForDays: number
  ): Promise<number>;
}
