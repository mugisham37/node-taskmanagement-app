import { Injectable } from '../decorators/injectable';
import { NotificationEntity } from '../../domain/notification/entities/notification.entity';
import { NotificationId } from '../../domain/notification/value-objects/notification-id';
import { NotificationPriority } from '../../domain/notification/value-objects/notification-priority';
import { Logger } from '../../infrastructure/logging/logger';

export interface QueuedNotification {
  notification: NotificationEntity;
  priority: number;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  queuedAt: Date;
}

export interface QueueProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{
    notificationId: string;
    error: string;
    attempts: number;
  }>;
}

export interface NotificationQueueService {
  enqueue(
    notification: NotificationEntity,
    priority?: NotificationPriority
  ): Promise<void>;
  enqueueMany(notifications: NotificationEntity[]): Promise<void>;
  dequeue(batchSize?: number): Promise<QueuedNotification[]>;
  requeueForRetry(
    notificationId: NotificationId,
    error: string,
    retryDelay?: number
  ): Promise<void>;
  remove(notificationId: NotificationId): Promise<void>;
  getQueueSize(): Promise<number>;
  getQueueStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    failed: number;
    byPriority: Record<string, number>;
  }>;
  clear(): Promise<void>;
}

@Injectable()
export class InMemoryNotificationQueueService
  implements NotificationQueueService
{
  private queue: Map<string, QueuedNotification> = new Map();
  private processing: Set<string> = new Set();

  constructor(private readonly logger: Logger) {}

  async enqueue(
    notification: NotificationEntity,
    priority?: NotificationPriority
  ): Promise<void> {
    const queuedNotification: QueuedNotification = {
      notification,
      priority: (priority || notification.priority).getNumericValue(),
      attempts: 0,
      maxAttempts: this.getMaxAttemptsForPriority(notification.priority),
      queuedAt: new Date(),
    };

    this.queue.set(notification.id.value, queuedNotification);

    this.logger.debug('Notification enqueued', {
      notificationId: notification.id.value,
      priority: queuedNotification.priority,
    });
  }

  async enqueueMany(notifications: NotificationEntity[]): Promise<void> {
    for (const notification of notifications) {
      await this.enqueue(notification);
    }

    this.logger.info('Bulk notifications enqueued', {
      count: notifications.length,
    });
  }

  async dequeue(batchSize: number = 10): Promise<QueuedNotification[]> {
    const now = new Date();
    const available = Array.from(this.queue.values())
      .filter(
        item =>
          !this.processing.has(item.notification.id.value) &&
          (!item.nextRetryAt || item.nextRetryAt <= now)
      )
      .sort((a, b) => {
        // Sort by priority (higher first), then by queued time (older first)
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.queuedAt.getTime() - b.queuedAt.getTime();
      })
      .slice(0, batchSize);

    // Mark as processing
    for (const item of available) {
      this.processing.add(item.notification.id.value);
    }

    this.logger.debug('Notifications dequeued for processing', {
      count: available.length,
      batchSize,
    });

    return available;
  }

  async requeueForRetry(
    notificationId: NotificationId,
    error: string,
    retryDelay?: number
  ): Promise<void> {
    const item = this.queue.get(notificationId.value);
    if (!item) {
      this.logger.warn('Attempted to requeue non-existent notification', {
        notificationId: notificationId.value,
      });
      return;
    }

    item.attempts += 1;

    if (item.attempts >= item.maxAttempts) {
      // Max attempts reached, remove from queue
      this.queue.delete(notificationId.value);
      this.processing.delete(notificationId.value);

      this.logger.error('Notification failed after max attempts', {
        notificationId: notificationId.value,
        attempts: item.attempts,
        error,
      });
      return;
    }

    // Calculate retry delay based on priority and attempt count
    const delay =
      retryDelay ||
      this.calculateRetryDelay(item.notification.priority, item.attempts);

    item.nextRetryAt = new Date(Date.now() + delay);
    this.processing.delete(notificationId.value);

    this.logger.debug('Notification requeued for retry', {
      notificationId: notificationId.value,
      attempts: item.attempts,
      nextRetryAt: item.nextRetryAt,
      error,
    });
  }

  async remove(notificationId: NotificationId): Promise<void> {
    this.queue.delete(notificationId.value);
    this.processing.delete(notificationId.value);

    this.logger.debug('Notification removed from queue', {
      notificationId: notificationId.value,
    });
  }

  async getQueueSize(): Promise<number> {
    return this.queue.size;
  }

  async getQueueStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    failed: number;
    byPriority: Record<string, number>;
  }> {
    const now = new Date();
    const items = Array.from(this.queue.values());

    const stats = {
      total: items.length,
      pending: 0,
      processing: this.processing.size,
      failed: 0,
      byPriority: {} as Record<string, number>,
    };

    for (const item of items) {
      // Count by status
      if (this.processing.has(item.notification.id.value)) {
        // Already counted in processing
      } else if (item.attempts >= item.maxAttempts) {
        stats.failed++;
      } else if (!item.nextRetryAt || item.nextRetryAt <= now) {
        stats.pending++;
      }

      // Count by priority
      const priorityName = item.notification.priority.value;
      stats.byPriority[priorityName] =
        (stats.byPriority[priorityName] || 0) + 1;
    }

    return stats;
  }

  async clear(): Promise<void> {
    this.queue.clear();
    this.processing.clear();

    this.logger.info('Notification queue cleared');
  }

  private getMaxAttemptsForPriority(priority: NotificationPriority): number {
    switch (priority.value) {
      case 'urgent':
        return 5;
      case 'high':
        return 4;
      case 'normal':
        return 3;
      case 'low':
        return 2;
      default:
        return 3;
    }
  }

  private calculateRetryDelay(
    priority: NotificationPriority,
    attempts: number
  ): number {
    const baseDelay = priority.getRetryDelay();

    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempts - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;

    return Math.min(exponentialDelay + jitter, 300000); // Max 5 minutes
  }
}
