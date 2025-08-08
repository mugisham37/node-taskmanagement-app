import { NotificationEntity } from '../entities/notification.entity';
import { NotificationChannel } from '../value-objects/notification-channel';
import { NotificationPriority } from '../value-objects/notification-priority';
import { DomainService } from '../../shared/base/domain-service';

export interface DeliveryResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
  error?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface DeliveryProvider {
  readonly channel: NotificationChannel;
  canDeliver(notification: NotificationEntity): boolean;
  deliver(
    notification: NotificationEntity,
    content: { subject: string; body: string }
  ): Promise<DeliveryResult>;
  validateConfiguration(): Promise<boolean>;
  getHealthStatus(): Promise<{
    healthy: boolean;
    details?: Record<string, any>;
  }>;
}

export interface NotificationDeliveryService extends DomainService {
  // Provider management
  registerProvider(provider: DeliveryProvider): void;
  unregisterProvider(channel: NotificationChannel): void;
  getProvider(channel: NotificationChannel): DeliveryProvider | null;
  getAvailableChannels(): NotificationChannel[];

  // Delivery operations
  deliverNotification(
    notification: NotificationEntity
  ): Promise<DeliveryResult[]>;
  deliverToChannel(
    notification: NotificationEntity,
    channel: NotificationChannel,
    content: { subject: string; body: string }
  ): Promise<DeliveryResult>;

  // Batch operations
  deliverBatch(
    notifications: NotificationEntity[]
  ): Promise<Map<string, DeliveryResult[]>>;

  // Retry operations
  retryFailedDelivery(
    notification: NotificationEntity,
    channel: NotificationChannel
  ): Promise<DeliveryResult>;

  // Health and monitoring
  checkProvidersHealth(): Promise<Map<NotificationChannel, boolean>>;
  getDeliveryMetrics(dateRange?: { from: Date; to: Date }): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    deliveryRate: number;
    byChannel: Record<
      string,
      {
        total: number;
        successful: number;
        failed: number;
        rate: number;
      }
    >;
    byPriority: Record<
      string,
      {
        total: number;
        successful: number;
        failed: number;
        rate: number;
      }
    >;
  }>;

  // Configuration validation
  validateProviderConfiguration(channel: NotificationChannel): Promise<boolean>;
  getProviderStatus(channel: NotificationChannel): Promise<{
    available: boolean;
    healthy: boolean;
    lastCheck: Date;
    details?: Record<string, any>;
  }>;
}
