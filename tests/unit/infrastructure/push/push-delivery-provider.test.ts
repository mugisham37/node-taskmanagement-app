import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PushDeliveryProvider,
  PushConfig,
} from '../../../../src/infrastructure/push/push-delivery-provider';
import { NotificationEntity } from '../../../../src/domain/notification/entities/notification.entity';
import { UserId } from '../../../../src/domain/authentication/value-objects/UserId';
import { NotificationType } from '../../../../src/domain/notification/value-objects/notification-type';
import { NotificationChannel } from '../../../../src/domain/notification/value-objects/notification-channel';
import { NotificationPriority } from '../../../../src/domain/notification/value-objects/notification-priority';
import { ConsoleLogger } from '../../../../src/infrastructure/logging/logger';

describe('PushDeliveryProvider', () => {
  let provider: PushDeliveryProvider;
  let config: PushConfig;
  let logger: ConsoleLogger;

  beforeEach(() => {
    config = {
      fcm: {
        serverKey: 'test-server-key',
        senderId: 'test-sender-id',
        projectId: 'test-project',
      },
      apns: {
        keyId: 'test-key-id',
        teamId: 'test-team-id',
        bundleId: 'com.example.app',
        privateKey: 'test-private-key',
        production: false,
      },
      webPush: {
        publicKey: 'test-public-key',
        privateKey: 'test-private-key',
        subject: 'mailto:test@example.com',
      },
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 100,
    };

    logger = new ConsoleLogger();
    provider = new PushDeliveryProvider(config, logger);
  });

  describe('canDeliver', () => {
    it('should return true for notification with push channel and registered devices', async () => {
      const userId = UserId.generate();
      const notification = NotificationEntity.create(
        userId,
        NotificationType.TASK_ASSIGNED,
        'Test Notification',
        'Test message',
        {},
        [NotificationChannel.PUSH]
      );

      // Register a device for the user
      await provider.registerDevice({
        userId: userId.value,
        platform: 'android',
        token: 'test-fcm-token',
        isActive: true,
        metadata: {},
      });

      expect(provider.canDeliver(notification)).toBe(true);
    });

    it('should return false for notification without push channel', () => {
      const notification = NotificationEntity.create(
        UserId.generate(),
        NotificationType.TASK_ASSIGNED,
        'Test Notification',
        'Test message',
        {},
        [NotificationChannel.EMAIL]
      );

      expect(provider.canDeliver(notification)).toBe(false);
    });

    it('should return false for notification without registered devices', () => {
      const notification = NotificationEntity.create(
        UserId.generate(),
        NotificationType.TASK_ASSIGNED,
        'Test Notification',
        'Test message',
        {},
        [NotificationChannel.PUSH]
      );

      expect(provider.canDeliver(notification)).toBe(false);
    });

    it('should return false for user with only inactive devices', async () => {
      const userId = UserId.generate();
      const notification = NotificationEntity.create(
        userId,
        NotificationType.TASK_ASSIGNED,
        'Test Notification',
        'Test message',
        {},
        [NotificationChannel.PUSH]
      );

      // Register an inactive device
      await provider.registerDevice({
        userId: userId.value,
        platform: 'android',
        token: 'test-fcm-token',
        isActive: false,
        metadata: {},
      });

      expect(provider.canDeliver(notification)).toBe(false);
    });
  });

  describe('deliver', () => {
    it('should successfully deliver push notification to active devices', async () => {
      const userId = UserId.generate();
      const notification = NotificationEntity.create(
        userId,
        NotificationType.TASK_ASSIGNED,
        'Test Notification',
        'Test message',
        { icon: '/test-icon.png' },
        [NotificationChannel.PUSH]
      );

      // Register devices for the user
      await provider.registerDevice({
        userId: userId.value,
        platform: 'android',
        token: 'test-fcm-token',
        isActive: true,
        metadata: {},
      });

      await provider.registerDevice({
        userId: userId.value,
        platform: 'ios',
        token: 'test-apns-token',
        isActive: true,
        metadata: {},
      });

      const content = {
        subject: 'Test Subject',
        body: 'Test push notification body',
      };

      const result = await provider.deliver(notification, content);

      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannel.PUSH);
      expect(result.messageId).toContain('push-');
      expect(result.metadata).toEqual({
        deliveryTime: expect.any(Number),
        successful: 2,
        failed: 0,
        totalDevices: 2,
        deviceResults: expect.arrayContaining([
          expect.objectContaining({
            platform: 'android',
            success: true,
          }),
          expect.objectContaining({
            platform: 'ios',
            success: true,
          }),
        ]),
      });
    });

    it('should handle delivery failure gracefully', async () => {
      const userId = UserId.generate();
      const notification = NotificationEntity.create(
        userId,
        NotificationType.TASK_ASSIGNED,
        'Test Notification',
        'Test message',
        {},
        [NotificationChannel.PUSH]
      );

      // Don't register any devices to simulate failure
      const content = {
        subject: 'Test Subject',
        body: 'Test push notification body',
      };

      const result = await provider.deliver(notification, content);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannel.PUSH);
      expect(result.error).toBe('No active devices found for user');
      expect(result.metadata).toEqual({
        deliveryTime: expect.any(Number),
      });
    });

    it('should create proper push payload with notification data', async () => {
      const userId = UserId.generate();
      const notification = NotificationEntity.create(
        userId,
        NotificationType.TASK_ASSIGNED,
        'Test Notification',
        'Test message',
        {
          icon: '/custom-icon.png',
          sound: 'custom-sound.wav',
          actions: [
            { action: 'view', title: 'View Task' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        },
        [NotificationChannel.PUSH],
        NotificationPriority.HIGH,
        { actionUrl: 'https://app.example.com/tasks/123' }
      );

      await provider.registerDevice({
        userId: userId.value,
        platform: 'web',
        token: 'test-web-token',
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
        isActive: true,
        metadata: {},
      });

      const content = {
        subject: 'Task Assignment',
        body: 'You have been assigned a new task',
      };

      const result = await provider.deliver(notification, content);

      expect(result.success).toBe(true);
      expect(result.metadata?.deviceResults).toEqual([
        expect.objectContaining({
          platform: 'web',
          success: true,
        }),
      ]);
    });
  });

  describe('validateConfiguration', () => {
    it('should return true for valid configuration', async () => {
      const isValid = await provider.validateConfiguration();
      expect(isValid).toBe(true);
    });

    it('should return false for invalid FCM configuration', async () => {
      const invalidConfig = {
        ...config,
        fcm: {
          serverKey: '',
          senderId: 'test-sender-id',
          projectId: 'test-project',
        },
      };

      const invalidProvider = new PushDeliveryProvider(invalidConfig, logger);
      const isValid = await invalidProvider.validateConfiguration();
      expect(isValid).toBe(false);
    });

    it('should return false for invalid APNs configuration', async () => {
      const invalidConfig = {
        ...config,
        apns: {
          keyId: '',
          teamId: 'test-team-id',
          bundleId: 'com.example.app',
          privateKey: 'test-private-key',
          production: false,
        },
      };

      const invalidProvider = new PushDeliveryProvider(invalidConfig, logger);
      const isValid = await invalidProvider.validateConfiguration();
      expect(isValid).toBe(false);
    });

    it('should return false when no platforms are configured', async () => {
      const invalidConfig = {
        maxRetries: 3,
        retryDelay: 1000,
        batchSize: 100,
      };

      const invalidProvider = new PushDeliveryProvider(invalidConfig, logger);
      const isValid = await invalidProvider.validateConfiguration();
      expect(isValid).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status with device statistics', async () => {
      const userId = UserId.generate();

      // Register some devices
      await provider.registerDevice({
        userId: userId.value,
        platform: 'android',
        token: 'test-fcm-token-1',
        isActive: true,
        metadata: {},
      });

      await provider.registerDevice({
        userId: userId.value,
        platform: 'ios',
        token: 'test-apns-token-1',
        isActive: false,
        metadata: {},
      });

      const health = await provider.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.details).toEqual({
        lastHealthCheck: expect.any(Date),
        totalDevices: 2,
        activeDevices: 1,
        platforms: {
          fcm: true,
          apns: true,
          webPush: true,
        },
        config: {
          maxRetries: 3,
          retryDelay: 1000,
          batchSize: 100,
        },
      });
    });
  });

  describe('device management', () => {
    it('should register a new device', async () => {
      const deviceId = await provider.registerDevice({
        userId: 'user-123',
        platform: 'android',
        token: 'test-fcm-token',
        isActive: true,
        metadata: { appVersion: '1.0.0' },
      });

      expect(deviceId).toMatch(/^device-\d+-[a-z0-9]+$/);

      const devices = await provider.getUserDevices('user-123');
      expect(devices).toHaveLength(1);
      expect(devices[0]).toEqual(
        expect.objectContaining({
          id: deviceId,
          userId: 'user-123',
          platform: 'android',
          token: 'test-fcm-token',
          isActive: true,
        })
      );
    });

    it('should replace existing device with same token', async () => {
      const token = 'test-fcm-token';

      // Register first device
      const deviceId1 = await provider.registerDevice({
        userId: 'user-123',
        platform: 'android',
        token,
        isActive: true,
        metadata: { version: '1.0' },
      });

      // Register second device with same token
      const deviceId2 = await provider.registerDevice({
        userId: 'user-123',
        platform: 'android',
        token,
        isActive: true,
        metadata: { version: '2.0' },
      });

      const devices = await provider.getUserDevices('user-123');
      expect(devices).toHaveLength(1);
      expect(devices[0].id).toBe(deviceId2);
      expect(devices[0].metadata.version).toBe('2.0');
    });

    it('should unregister a device', async () => {
      const deviceId = await provider.registerDevice({
        userId: 'user-123',
        platform: 'android',
        token: 'test-fcm-token',
        isActive: true,
        metadata: {},
      });

      const unregistered = await provider.unregisterDevice(deviceId);
      expect(unregistered).toBe(true);

      const devices = await provider.getUserDevices('user-123');
      expect(devices).toHaveLength(0);
    });

    it('should update device token', async () => {
      const deviceId = await provider.registerDevice({
        userId: 'user-123',
        platform: 'android',
        token: 'old-token',
        isActive: true,
        metadata: {},
      });

      const updated = await provider.updateDeviceToken(deviceId, 'new-token');
      expect(updated).toBe(true);

      const devices = await provider.getUserDevices('user-123');
      expect(devices[0].token).toBe('new-token');
    });

    it('should get active devices only', async () => {
      const userId = 'user-123';

      await provider.registerDevice({
        userId,
        platform: 'android',
        token: 'active-token',
        isActive: true,
        metadata: {},
      });

      await provider.registerDevice({
        userId,
        platform: 'ios',
        token: 'inactive-token',
        isActive: false,
        metadata: {},
      });

      const allDevices = await provider.getUserDevices(userId);
      const activeDevices = await provider.getActiveDevices(userId);

      expect(allDevices).toHaveLength(2);
      expect(activeDevices).toHaveLength(1);
      expect(activeDevices[0].token).toBe('active-token');
    });
  });

  describe('sendBulkPushNotifications', () => {
    it('should send notifications to multiple users', async () => {
      const user1 = UserId.generate();
      const user2 = UserId.generate();

      // Register devices for both users
      await provider.registerDevice({
        userId: user1.value,
        platform: 'android',
        token: 'user1-token',
        isActive: true,
        metadata: {},
      });

      await provider.registerDevice({
        userId: user2.value,
        platform: 'ios',
        token: 'user2-token',
        isActive: true,
        metadata: {},
      });

      const notifications = [
        {
          notification: NotificationEntity.create(
            user1,
            NotificationType.TASK_ASSIGNED,
            'Task 1',
            'Message 1',
            {},
            [NotificationChannel.PUSH]
          ),
          content: { subject: 'Task 1', body: 'You have a new task' },
        },
        {
          notification: NotificationEntity.create(
            user2,
            NotificationType.TASK_ASSIGNED,
            'Task 2',
            'Message 2',
            {},
            [NotificationChannel.PUSH]
          ),
          content: { subject: 'Task 2', body: 'You have a new task' },
        },
      ];

      const results = await provider.sendBulkPushNotifications(notifications);

      expect(results.size).toBe(2);
      for (const [notificationId, result] of results) {
        expect(result.success).toBe(true);
        expect(result.channel).toBe(NotificationChannel.PUSH);
      }
    });
  });

  describe('getDeliveryStats', () => {
    it('should return delivery statistics', async () => {
      const stats = await provider.getDeliveryStats();

      expect(stats).toEqual({
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        deliveryRate: 0,
        byPlatform: {},
      });
    });
  });
});
