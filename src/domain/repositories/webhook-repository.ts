import {
  Webhook,
  WebhookDelivery,
  WebhookEvent,
  WebhookStatus,
  WebhookDeliveryStatus,
} from '../entities/webhook';

export interface IWebhookRepository {
  save(webhook: Webhook): Promise<void>;
  findById(id: string): Promise<Webhook | null>;
  findByWorkspaceId(
    workspaceId: string,
    limit?: number,
    offset?: number
  ): Promise<Webhook[]>;
  findByStatus(
    status: WebhookStatus,
    limit?: number,
    offset?: number
  ): Promise<Webhook[]>;
  findByEvent(event: WebhookEvent, workspaceId?: string): Promise<Webhook[]>;
  findActive(): Promise<Webhook[]>;
  findFailed(): Promise<Webhook[]>;
  findByUrl(url: string): Promise<Webhook[]>;
  getWebhookStats(workspaceId: string): Promise<{
    total: number;
    active: number;
    failed: number;
    suspended: number;
    byEvent: Record<WebhookEvent, number>;
    totalDeliveries: number;
    successRate: number;
  }>;
  delete(id: string): Promise<void>;
  deleteByWorkspaceId(workspaceId: string): Promise<void>;
}

export interface IWebhookDeliveryRepository {
  save(delivery: WebhookDelivery): Promise<void>;
  findById(id: string): Promise<WebhookDelivery | null>;
  findByWebhookId(
    webhookId: string,
    limit?: number,
    offset?: number
  ): Promise<WebhookDelivery[]>;
  findByStatus(
    status: WebhookDeliveryStatus,
    limit?: number,
    offset?: number
  ): Promise<WebhookDelivery[]>;
  findPending(): Promise<WebhookDelivery[]>;
  findReadyForRetry(): Promise<WebhookDelivery[]>;
  findByEvent(
    event: WebhookEvent,
    limit?: number,
    offset?: number
  ): Promise<WebhookDelivery[]>;
  findByDateRange(
    startDate: Date,
    endDate: Date,
    limit?: number,
    offset?: number
  ): Promise<WebhookDelivery[]>;
  getDeliveryStats(
    webhookId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    pending: number;
    retrying: number;
    successRate: number;
    averageAttempts: number;
    byEvent: Record<WebhookEvent, { total: number; successful: number }>;
  }>;
  getRecentDeliveries(
    webhookId: string,
    limit?: number
  ): Promise<WebhookDelivery[]>;
  delete(id: string): Promise<void>;
  deleteByWebhookId(webhookId: string): Promise<void>;
  deleteOlderThan(date: Date): Promise<number>;
  deleteSuccessfulOlderThan(date: Date): Promise<number>;
}
