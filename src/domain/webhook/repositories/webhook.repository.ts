import { Repository } from '../../../shared/domain/repository';
import { WebhookEntity } from '../entities/webhook.entity';
import { WebhookId } from '../value-objects/webhook-id';
import { WorkspaceId } from '../../task-management/value-objects/workspace-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { WebhookEvent } from '../value-objects/webhook-event';
import { WebhookStatus } from '../value-objects/webhook-status';

export interface WebhookFilters {
  workspaceId?: WorkspaceId;
  userId?: UserId;
  status?: WebhookStatus;
  events?: WebhookEvent[];
  name?: string;
  url?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  lastDeliveryAfter?: Date;
  lastDeliveryBefore?: Date;
  minSuccessRate?: number;
  maxFailureCount?: number;
}

export interface WebhookQueryOptions {
  page?: number;
  limit?: number;
  sortBy?:
    | 'name'
    | 'createdAt'
    | 'updatedAt'
    | 'lastDeliveryAt'
    | 'successCount'
    | 'failureCount';
  sortOrder?: 'asc' | 'desc';
}

export interface WebhookStats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageSuccessRate: number;
  byEvent: Record<string, number>;
}

export interface WebhookRepository
  extends Repository<WebhookEntity, WebhookId> {
  // Basic CRUD operations
  findById(id: WebhookId): Promise<WebhookEntity | null>;
  findByIds(ids: WebhookId[]): Promise<WebhookEntity[]>;
  save(webhook: WebhookEntity): Promise<void>;
  delete(id: WebhookId): Promise<void>;

  // Query operations
  findMany(
    filters?: WebhookFilters,
    options?: WebhookQueryOptions
  ): Promise<{
    webhooks: WebhookEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  findByWorkspace(
    workspaceId: WorkspaceId,
    options?: WebhookQueryOptions
  ): Promise<WebhookEntity[]>;

  findByUser(
    userId: UserId,
    options?: WebhookQueryOptions
  ): Promise<WebhookEntity[]>;

  findActiveByEvent(
    event: WebhookEvent,
    workspaceId?: WorkspaceId
  ): Promise<WebhookEntity[]>;

  findByUrl(url: string): Promise<WebhookEntity[]>;

  // Status operations
  findActive(workspaceId?: WorkspaceId): Promise<WebhookEntity[]>;
  findInactive(workspaceId?: WorkspaceId): Promise<WebhookEntity[]>;
  findSuspended(workspaceId?: WorkspaceId): Promise<WebhookEntity[]>;

  // Bulk operations
  updateStatus(ids: WebhookId[], status: WebhookStatus): Promise<number>;
  deleteByWorkspace(workspaceId: WorkspaceId): Promise<number>;
  deleteByUser(userId: UserId): Promise<number>;

  // Analytics
  getStats(workspaceId?: WorkspaceId): Promise<WebhookStats>;
  getDeliveryStats(
    webhookId: WebhookId,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    successRate: number;
    averageResponseTime: number;
    deliveriesByDay: Array<{
      date: string;
      count: number;
      successCount: number;
      failureCount: number;
    }>;
  }>;

  // Health and monitoring
  findUnhealthyWebhooks(criteria?: {
    minFailureRate?: number;
    minConsecutiveFailures?: number;
    noDeliveryForDays?: number;
  }): Promise<WebhookEntity[]>;

  findDuplicateUrls(): Promise<
    Array<{ url: string; webhooks: WebhookEntity[] }>
  >;

  // Maintenance
  cleanupOldWebhooks(olderThan: Date): Promise<number>;
  resetFailureCounts(webhookIds?: WebhookId[]): Promise<number>;
}
