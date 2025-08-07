import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  EmailDeliveryProvider,
  EmailConfig,
} from '../../../../src/infrastructure/email/email-delivery-provider';
import { NotificationEntity } from '../../../../src/domain/notification/entities/notification.entity';
import { UserId } from '../../../../src/domain/authentication/value-objects/UserId';
import { NotificationType } from '../../../../src/domain/notification/value-objects/notification-type';
import { NotificationChannel } from '../../../../src/domain/notification/value-objects/notification-channel';
import { NotificationPriority } from '../../../../src/domain/notification/value-objects/notification-priority';
import { ConsoleLogger } from '../../../../src/infrastructure/logging/logger';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
vi.mock('nodemailer', () => ({
  createTransporter: vi.fn(),
}));

describe('EmailDeliveryProvider', () => {
  let provider: EmailDeliveryProvider;
  let mockTransporter: any;
  let config: EmailConfig;
  let logger: ConsoleLogger;

  beforeEach(() => {
    // Setup mock transporter
    mockTransporter = {
      sendMail: vi.fn(),
      verify: vi.fn(),
    };

    (nodemailer.createTransporter as Mock).mockReturnValue(mockTransporter);

    config = {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@example.com',
        pass: 'password',
      },
      from: 'noreply@example.com',
      maxConnections: 5,
      pool: true,
    };

    logger = new ConsoleLogger();
    provider = new EmailDeliveryProvider(config, logger);
  });

  describe('canDeliver', () => {
    it('should return true for notification with email channel and recipient', () => {
      const notification = NotificationEntity.create(
        UserId.generate(),
        NotificationType.TASK_ASSIGNED,
        'Test Notification',
        'Test message',
        { email: 'user@example.com' },
        [NotificationChannel.EMAIL]
      );

      expect(provider.canDeliver(notification)).toBe(true);
    });

    it('should return false for notification without email channel', () => {
      const notification = NotificationEntity.create(
        UserId.generate(),
        NotificationType.TASK_ASSIGNED,
        'Test Notification',
        'Test message',
        { email: 'user@example.com' },
        [NotificationChannel.IN_APP]
      );

      expect(provider.canDeliver(notification)).toBe(false);
    });

    it('should return false for notification without recipient email', () => {
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
  });

  describe('deliver', () => {
    it('should successfully deliver email notification', async () => {
      const notification = NotificationEntity.create(
        UserId.generate(),
        NotificationType.TASK_ASSIGNED,
        'Test Notification',
        'Test message',
        { email: 'user@example.com' }
      );

      const content = {
        subject: 'Test Subject',
        body: '<p>Test HTML body</p>',
      };

      const mockResult = {
        messageId: 'test-message-id',
        response: '250 OK',
        envelope: { from: 'noreply@example.com', to: ['user@example.com'] },
      };

      mockTransporter.sendMail.mockResolvedValue(mockResult);

      const result = await provider.deliver(notification, content);

      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannel.EMAIL);
      expect(result.messageId).toBe('test-message-id');
      expect(result.metadata).toEqual({
        deliveryTime: expect.any(Number),
        response: '250 OK',
        envelope: mockResult.envelope,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: config.from,
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML body</p>',
        text: 'Test HTML body',
        replyTo: undefined,
        headers: {
          'X-Notification-ID': notification.id.value,
          'X-Notification-Type': notification.type.value,
          'X-Notification-Priority': notification.priority.value,
        },
      });
    });

    it('should handle delivery failure', async () => {
      const notification = NotificationEntity.create(
        UserId.generate(),
        NotificationType.TASK_ASSIGNED,
        'Test Notification',
        'Test message',
        { email: 'user@example.com' }
      );

      const content = {
        subject: 'Test Subject',
        body: '<p>Test HTML body</p>',
      };

      const error = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValue(error);

      const result = await provider.deliver(notification, content);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannel.EMAIL);
      expect(result.error).toBe('SMTP connection failed');
      expect(result.metadata).toEqual({
        deliveryTime: expect.any(Number),
      });
    });

    it('should include action URL in headers when available', async () => {
      const notification = NotificationEntity.create(
        UserId.generate(),
        NotificationType.TASK_ASSIGNED,
        'Test Notification',
        'Test message',
        { email: 'user@example.com' },
        [NotificationChannel.EMAIL],
        NotificationPriority.NORMAL,
        { actionUrl: 'https://app.example.com/tasks/123' }
      );

      const content = {
        subject: 'Test Subject',
        body: '<p>Test HTML body</p>',
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
        envelope: {},
      });

      await provider.deliver(notification, content);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Action-URL': 'https://app.example.com/tasks/123',
          }),
        })
      );
    });

    it('should include attachments when specified', async () => {
      const attachments = [
        {
          filename: 'test.pdf',
          content: Buffer.from('test content'),
          contentType: 'application/pdf',
        },
      ];

      const notification = NotificationEntity.create(
        UserId.generate(),
        NotificationType.TASK_ASSIGNED,
        'Test Notification',
        'Test message',
        {
          email: 'user@example.com',
          attachments,
        }
      );

      const content = {
        subject: 'Test Subject',
        body: '<p>Test HTML body</p>',
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
        envelope: {},
      });

      await provider.deliver(notification, content);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments,
        })
      );
    });
  });

  describe('validateConfiguration', () => {
    it('should return true for valid configuration', async () => {
      mockTransporter.verify.mockResolvedValue(true);

      const isValid = await provider.validateConfiguration();

      expect(isValid).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('should return false for invalid configuration', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('Connection failed'));

      const isValid = await provider.validateConfiguration();

      expect(isValid).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status with details', async () => {
      mockTransporter.verify.mockResolvedValue(true);
      await provider.validateConfiguration();

      const health = await provider.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.details).toEqual({
        lastHealthCheck: expect.any(Date),
        transporterAvailable: true,
        config: {
          host: config.host,
          port: config.port,
          secure: config.secure,
          from: config.from,
        },
      });
    });

    it('should re-check health if last check was too long ago', async () => {
      vi.useFakeTimers();

      // Mock a successful verification
      mockTransporter.verify.mockResolvedValue(true);

      // Get initial health status
      await provider.getHealthStatus();

      // Advance time by 6 minutes
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Reset mock to track new calls
      mockTransporter.verify.mockClear();
      mockTransporter.verify.mockResolvedValue(true);

      // Get health status again
      await provider.getHealthStatus();

      expect(mockTransporter.verify).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('sendBulkEmails', () => {
    it('should send multiple emails in batches', async () => {
      const notifications = [
        NotificationEntity.create(
          UserId.generate(),
          NotificationType.TASK_ASSIGNED,
          'Task 1',
          'Message 1',
          { email: 'user1@example.com' }
        ),
        NotificationEntity.create(
          UserId.generate(),
          NotificationType.TASK_ASSIGNED,
          'Task 2',
          'Message 2',
          { email: 'user2@example.com' }
        ),
      ];

      const templates = new Map([
        [
          'task_assigned',
          { subject: 'Task Assigned', body: '<p>Task assigned</p>' },
        ],
      ]);

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
        envelope: {},
      });

      const results = await provider.sendBulkEmails(notifications, templates);

      expect(results.size).toBe(2);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);

      for (const [notificationId, result] of results) {
        expect(result.success).toBe(true);
        expect(result.messageId).toBe('test-message-id');
      }
    });

    it('should handle missing templates gracefully', async () => {
      const notifications = [
        NotificationEntity.create(
          UserId.generate(),
          NotificationType.TASK_ASSIGNED,
          'Task 1',
          'Message 1',
          { email: 'user1@example.com' }
        ),
      ];

      const templates = new Map(); // Empty templates

      const results = await provider.sendBulkEmails(notifications, templates);

      expect(results.size).toBe(1);
      const result = Array.from(results.values())[0];
      expect(result.success).toBe(false);
      expect(result.error).toContain('No template found');
    });
  });

  describe('sendDigestEmail', () => {
    it('should send digest email with summary', async () => {
      const digestData = {
        subject: 'Daily Digest',
        notifications: [
          NotificationEntity.create(
            UserId.generate(),
            NotificationType.TASK_ASSIGNED,
            'Task 1',
            'Message 1'
          ),
        ],
        summary: {
          totalCount: 1,
          unreadCount: 1,
          urgentCount: 0,
          categories: { task: 1 },
        },
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'digest-message-id',
        response: '250 OK',
        envelope: {},
      });

      const result = await provider.sendDigestEmail(
        'user@example.com',
        digestData
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('digest-message-id');
      expect(result.metadata).toEqual({
        type: 'digest',
        notificationCount: 1,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Daily Digest',
          html: expect.stringContaining('Daily Digest'),
          text: expect.stringContaining('Daily Digest'),
          headers: {
            'X-Notification-Type': 'digest',
            'X-Notification-Count': '1',
          },
        })
      );
    });
  });

  describe('configuration management', () => {
    it('should update configuration and reinitialize transporter', () => {
      const newConfig = { host: 'new-smtp.example.com' };

      provider.updateConfiguration(newConfig);

      const updatedConfig = provider.getConfiguration();
      expect(updatedConfig.host).toBe('new-smtp.example.com');
      expect(updatedConfig.port).toBe(config.port); // Other values preserved
    });

    it('should return current configuration', () => {
      const currentConfig = provider.getConfiguration();
      expect(currentConfig).toEqual(config);
    });
  });
});
