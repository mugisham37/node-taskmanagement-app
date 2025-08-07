import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationEntity } from '../../../../../src/domain/notification/entities/notification.entity';
import { UserId } from '../../../../../src/domain/authentication/value-objects/UserId';
import { NotificationType } from '../../../../../src/domain/notification/value-objects/notification-type';
import { NotificationChannel } from '../../../../../src/domain/notification/value-objects/notification-channel';
import { NotificationPriority } from '../../../../../src/domain/notification/value-objects/notification-priority';

describe('NotificationEntity', () => {
  let userId: UserId;
  let notificationType: NotificationType;
  let channels: NotificationChannel[];

  beforeEach(() => {
    userId = UserId.generate(); // Use generate() to create a valid CUID
    notificationType = NotificationType.TASK_ASSIGNED;
    channels = [NotificationChannel.IN_APP, NotificationChannel.EMAIL];
  });

  describe('create', () => {
    it('should create a notification with required properties', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification'
      );

      expect(notification.userId).toBe(userId);
      expect(notification.type).toBe(notificationType);
      expect(notification.title).toBe('Test Notification');
      expect(notification.message).toBe('This is a test notification');
      expect(notification.isRead).toBe(false);
      expect(notification.deliveryAttempts).toBe(0);
      expect(notification.hasDomainEvents()).toBe(true);
    });

    it('should create a notification with custom channels and priority', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification',
        { key: 'value' },
        channels,
        NotificationPriority.HIGH
      );

      expect(notification.channels).toEqual(channels);
      expect(notification.priority).toBe(NotificationPriority.HIGH);
      expect(notification.data).toEqual({ key: 'value' });
    });

    it('should create a scheduled notification', () => {
      const scheduledFor = new Date(Date.now() + 3600000); // 1 hour from now

      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Scheduled Notification',
        'This is scheduled',
        {},
        channels,
        NotificationPriority.NORMAL,
        { scheduledFor }
      );

      expect(notification.scheduledFor).toEqual(scheduledFor);
      expect(notification.isScheduled()).toBe(true);
      expect(notification.isReadyForDelivery()).toBe(false);
    });

    it('should create a notification with expiration', () => {
      const expiresAt = new Date(Date.now() + 86400000); // 24 hours from now

      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Expiring Notification',
        'This will expire',
        {},
        channels,
        NotificationPriority.NORMAL,
        { expiresAt }
      );

      expect(notification.expiresAt).toEqual(expiresAt);
      expect(notification.isExpired()).toBe(false);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification'
      );

      expect(notification.isRead).toBe(false);
      expect(notification.readAt).toBeUndefined();

      notification.markAsRead();

      expect(notification.isRead).toBe(true);
      expect(notification.readAt).toBeInstanceOf(Date);
      expect(notification.hasDomainEvents()).toBe(true);
    });

    it('should not change state if already read', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification'
      );

      notification.markAsRead();
      const firstReadAt = notification.readAt;

      // Clear events to test idempotency
      notification.clearDomainEvents();

      notification.markAsRead();

      expect(notification.readAt).toBe(firstReadAt);
      expect(notification.hasDomainEvents()).toBe(false);
    });
  });

  describe('markAsDelivered', () => {
    it('should mark channel as delivered', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification',
        {},
        [NotificationChannel.EMAIL]
      );

      const result = { messageId: 'msg-123', timestamp: new Date() };
      notification.markAsDelivered(NotificationChannel.EMAIL, result);

      expect(
        notification.deliveryResults[NotificationChannel.EMAIL.value]
      ).toEqual({
        success: true,
        result,
        timestamp: expect.any(Date),
      });
      expect(notification.lastDeliveryAttempt).toBeInstanceOf(Date);
    });

    it('should mark as delivered when all channels are delivered', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification',
        {},
        [NotificationChannel.EMAIL, NotificationChannel.PUSH]
      );

      notification.markAsDelivered(NotificationChannel.EMAIL, {
        messageId: 'email-123',
      });
      expect(notification.status.isSuccessful()).toBe(false);

      notification.markAsDelivered(NotificationChannel.PUSH, {
        messageId: 'push-123',
      });
      expect(notification.status.isSuccessful()).toBe(true);
      expect(notification.hasDomainEvents()).toBe(true);
    });
  });

  describe('markAsDeliveryFailed', () => {
    it('should mark channel delivery as failed', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification'
      );

      const error = new Error('Delivery failed');
      notification.markAsDeliveryFailed(NotificationChannel.EMAIL, error);

      expect(notification.deliveryAttempts).toBe(1);
      expect(
        notification.deliveryResults[NotificationChannel.EMAIL.value]
      ).toEqual({
        success: false,
        error: 'Delivery failed',
        timestamp: expect.any(Date),
      });
    });

    it('should mark as failed after max attempts', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification'
      );

      // Simulate 3 failed attempts
      for (let i = 0; i < 3; i++) {
        notification.markAsDeliveryFailed(
          NotificationChannel.EMAIL,
          new Error('Failed')
        );
      }

      expect(notification.deliveryAttempts).toBe(3);
      expect(notification.status.value).toBe('failed');
      expect(notification.hasDomainEvents()).toBe(true);
    });
  });

  describe('isExpired', () => {
    it('should return false for non-expiring notification', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification'
      );

      expect(notification.isExpired()).toBe(false);
    });

    it('should return false for future expiration', () => {
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification',
        {},
        channels,
        NotificationPriority.NORMAL,
        { expiresAt }
      );

      expect(notification.isExpired()).toBe(false);
    });

    it('should return true for past expiration', () => {
      const expiresAt = new Date(Date.now() - 3600000); // 1 hour ago

      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification',
        {},
        channels,
        NotificationPriority.NORMAL,
        { expiresAt }
      );

      expect(notification.isExpired()).toBe(true);
    });
  });

  describe('isReadyForDelivery', () => {
    it('should return true for pending notification', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification'
      );

      expect(notification.isReadyForDelivery()).toBe(true);
    });

    it('should return false for expired notification', () => {
      const expiresAt = new Date(Date.now() - 3600000); // 1 hour ago

      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification',
        {},
        channels,
        NotificationPriority.NORMAL,
        { expiresAt }
      );

      expect(notification.isReadyForDelivery()).toBe(false);
    });

    it('should return false for future scheduled notification', () => {
      const scheduledFor = new Date(Date.now() + 3600000); // 1 hour from now

      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification',
        {},
        channels,
        NotificationPriority.NORMAL,
        { scheduledFor }
      );

      expect(notification.isReadyForDelivery()).toBe(false);
    });

    it('should return true for past scheduled notification', () => {
      const scheduledFor = new Date(Date.now() - 3600000); // 1 hour ago

      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification',
        {},
        channels,
        NotificationPriority.NORMAL,
        { scheduledFor }
      );

      expect(notification.isReadyForDelivery()).toBe(true);
    });
  });

  describe('canRetryDelivery', () => {
    it('should return true for failed notification under max attempts', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification'
      );

      notification.markAsDeliveryFailed(
        NotificationChannel.EMAIL,
        new Error('Failed')
      );

      expect(notification.canRetryDelivery()).toBe(true);
    });

    it('should return false for notification at max attempts', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification'
      );

      // Simulate 3 failed attempts (max)
      for (let i = 0; i < 3; i++) {
        notification.markAsDeliveryFailed(
          NotificationChannel.EMAIL,
          new Error('Failed')
        );
      }

      expect(notification.canRetryDelivery()).toBe(false);
    });

    it('should return false for expired notification', () => {
      const expiresAt = new Date(Date.now() - 3600000); // 1 hour ago

      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification',
        {},
        channels,
        NotificationPriority.NORMAL,
        { expiresAt }
      );

      notification.markAsDeliveryFailed(
        NotificationChannel.EMAIL,
        new Error('Failed')
      );

      expect(notification.canRetryDelivery()).toBe(false);
    });
  });

  describe('channel management', () => {
    it('should add new channel', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification',
        {},
        [NotificationChannel.EMAIL]
      );

      expect(notification.channels).toHaveLength(1);

      notification.addChannel(NotificationChannel.PUSH);

      expect(notification.channels).toHaveLength(2);
      expect(notification.channels).toContain(NotificationChannel.PUSH);
    });

    it('should not add duplicate channel', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification',
        {},
        [NotificationChannel.EMAIL]
      );

      notification.addChannel(NotificationChannel.EMAIL);

      expect(notification.channels).toHaveLength(1);
    });

    it('should remove channel', () => {
      const notification = NotificationEntity.create(
        userId,
        notificationType,
        'Test Notification',
        'This is a test notification',
        {},
        [NotificationChannel.EMAIL, NotificationChannel.PUSH]
      );

      expect(notification.channels).toHaveLength(2);

      notification.removeChannel(NotificationChannel.EMAIL);

      expect(notification.channels).toHaveLength(1);
      expect(notification.channels).not.toContain(NotificationChannel.EMAIL);
    });
  });
});
