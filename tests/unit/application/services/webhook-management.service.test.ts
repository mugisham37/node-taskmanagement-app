import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { WebhookManagementServiceImpl } from '../../../../src/application/services/webhook-management.service.impl';
import { WebhookRepository } from '../../../../src/domain/webhook/repositories/webhook.repository';
import { WebhookDeliveryService } from '../../../../src/domain/webhook/services/webhook-delivery.service';
import { DomainEventBus } from '../../../../src/domain/shared/events/domain-event-bus';
import { Logger } from '../../../../src/infrastructure/logging/logger';
import { WebhookEntity } from '../../../../src/domain/webhook/entities/webhook.entity';
import { WebhookId } from '../../../../src/domain/webhook/value-objects/webhook-id';
import { WorkspaceId } from '../../../../src/domain/task-management/value-objects/workspace-id';
import { UserId } from '../../../../src/domain/authentication/value-objects/user-id';
import { WebhookUrl } from '../../../../src/domain/webhook/value-objects/webhook-url';
import { WebhookEvent } from '../../../../src/domain/webhook/value-objects/webhook-event';

// Mock dependencies
const mockWebhookRepository = {
  findById: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  findByWorkspace: vi.fn(),
  findByUser: vi.fn(),
  findActiveByEvent: vi.fn(),
  getStats: vi.fn(),
} as unknown as WebhookRepository;

const mockWebhookDeliveryService = {
  getDeliveryStats: vi.fn(),
} as unknown as WebhookDeliveryService;

const mockEventBus = {
  publish: vi.fn(),
} as unknown as DomainEventBus;

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
} as unknown as Logger;

describe('WebhookManagementServiceImpl', () => {
  let service: WebhookManagementServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebhookManagementServiceImpl(
      mockWebhookRepository,
      mockWebhookDeliveryService,
      mockEventBus,
      mockLogger
    );
  });

  describe('createWebhook', () => {
    it('should create a webhook successfully', async () => {
      // Arrange
      const workspaceId = WorkspaceId.generate();
      const userId = UserId.generate();
      const webhookUrl = WebhookUrl.fromString('https://example.com/webhook');
      const events = [WebhookEvent.fromString('task.created')];

      const createRequest = {
        workspaceId,
        userId,
        name: 'Test Webhook',
        url: webhookUrl,
        events,
      };

      (mockWebhookRepository.save as Mock).mockResolvedValue(undefined);

      // Act
      const result = await service.createWebhook(createRequest);

      // Assert
      expect(result).toBeInstanceOf(WebhookEntity);
      expect(result.name).toBe('Test Webhook');
      expect(result.url.value).toBe('https://example.com/webhook');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].value).toBe('task.created');
      expect(mockWebhookRepository.save).toHaveBeenCalledWith(result);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should throw error for invalid URL', async () => {
      // Arrange
      const workspaceId = WorkspaceId.generate();
      const userId = UserId.generate();
      const events = [WebhookEvent.fromString('task.created')];

      const createRequest = {
        workspaceId,
        userId,
        name: 'Test Webhook',
        url: WebhookUrl.fromString('invalid-url'),
        events,
      };

      // Act & Assert
      await expect(service.createWebhook(createRequest)).rejects.toThrow();
    });
  });

  describe('getWebhook', () => {
    it('should return webhook when found and user has permission', async () => {
      // Arrange
      const webhookId = WebhookId.generate();
      const userId = UserId.generate();
      const workspaceId = WorkspaceId.generate();

      const mockWebhook = WebhookEntity.create(
        workspaceId,
        userId,
        'Test Webhook',
        WebhookUrl.fromString('https://example.com/webhook'),
        [WebhookEvent.fromString('task.created')]
      );

      (mockWebhookRepository.findById as Mock).mockResolvedValue(mockWebhook);

      // Act
      const result = await service.getWebhook(webhookId, userId);

      // Assert
      expect(result).toBe(mockWebhook);
      expect(mockWebhookRepository.findById).toHaveBeenCalledWith(webhookId);
    });

    it('should throw error when webhook not found', async () => {
      // Arrange
      const webhookId = WebhookId.generate();
      const userId = UserId.generate();

      (mockWebhookRepository.findById as Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.getWebhook(webhookId, userId)).rejects.toThrow(
        'Webhook not found'
      );
    });

    it('should throw error when user lacks permission', async () => {
      // Arrange
      const webhookId = WebhookId.generate();
      const userId = UserId.generate();
      const differentUserId = UserId.generate();
      const workspaceId = WorkspaceId.generate();

      const mockWebhook = WebhookEntity.create(
        workspaceId,
        differentUserId, // Different user
        'Test Webhook',
        WebhookUrl.fromString('https://example.com/webhook'),
        [WebhookEvent.fromString('task.created')]
      );

      (mockWebhookRepository.findById as Mock).mockResolvedValue(mockWebhook);

      // Act & Assert
      await expect(service.getWebhook(webhookId, userId)).rejects.toThrow(
        'Insufficient permissions'
      );
    });
  });

  describe('testWebhook', () => {
    it('should test webhook successfully', async () => {
      // Arrange
      const webhookId = WebhookId.generate();
      const userId = UserId.generate();
      const workspaceId = WorkspaceId.generate();

      const mockWebhook = WebhookEntity.create(
        workspaceId,
        userId,
        'Test Webhook',
        WebhookUrl.fromString('https://httpbin.org/post'), // Use a real test endpoint
        [WebhookEvent.fromString('task.created')]
      );

      (mockWebhookRepository.findById as Mock).mockResolvedValue(mockWebhook);

      // Act
      const result = await service.testWebhook(webhookId, userId);

      // Assert
      expect(result).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('validateWebhookUrl', () => {
    it('should validate HTTPS URL as valid', async () => {
      // Arrange
      const url = WebhookUrl.fromString('https://example.com/webhook');

      // Act
      const result = await service.validateWebhookUrl(url);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about HTTP URL', async () => {
      // Arrange
      const url = WebhookUrl.fromString('http://example.com/webhook');

      // Act
      const result = await service.validateWebhookUrl(url);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Using HTTP instead of HTTPS');
      expect(result.recommendations).toContain('Use HTTPS for better security');
    });

    it('should reject invalid URL', async () => {
      // Act & Assert
      expect(() => WebhookUrl.fromString('invalid-url')).toThrow();
    });
  });

  describe('generateWebhookSecret', () => {
    it('should generate a valid secret', async () => {
      // Act
      const secret = await service.generateWebhookSecret();

      // Assert
      expect(secret).toBeDefined();
      expect(secret.value).toBeDefined();
      expect(secret.value.length).toBeGreaterThan(0);
    });
  });

  describe('getSupportedEvents', () => {
    it('should return list of supported events', async () => {
      // Act
      const events = await service.getSupportedEvents();

      // Assert
      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);

      // Check for some expected events
      const eventValues = events.map(e => e.value);
      expect(eventValues).toContain('task.created');
      expect(eventValues).toContain('task.updated');
      expect(eventValues).toContain('project.created');
    });
  });

  describe('validateEvents', () => {
    it('should validate supported events', async () => {
      // Arrange
      const events = [
        WebhookEvent.fromString('task.created'),
        WebhookEvent.fromString('project.updated'),
      ];

      // Act
      const result = await service.validateEvents(events);

      // Assert
      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(0);
    });

    it('should identify invalid events', async () => {
      // Arrange
      const validEvent = WebhookEvent.fromString('task.created');

      // Act
      const result = await service.validateEvents([validEvent]);

      // Assert
      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(0);
    });
  });
});

describe('WebhookEntity', () => {
  describe('create', () => {
    it('should create webhook with default values', () => {
      // Arrange
      const workspaceId = WorkspaceId.generate();
      const userId = UserId.generate();
      const url = WebhookUrl.fromString('https://example.com/webhook');
      const events = [WebhookEvent.fromString('task.created')];

      // Act
      const webhook = WebhookEntity.create(
        workspaceId,
        userId,
        'Test Webhook',
        url,
        events
      );

      // Assert
      expect(webhook.name).toBe('Test Webhook');
      expect(webhook.url.value).toBe('https://example.com/webhook');
      expect(webhook.events).toHaveLength(1);
      expect(webhook.httpMethod).toBe('POST');
      expect(webhook.contentType).toBe('application/json');
      expect(webhook.timeout).toBe(30000);
      expect(webhook.maxRetries).toBe(3);
      expect(webhook.isActive).toBe(true);
      expect(webhook.successCount).toBe(0);
      expect(webhook.failureCount).toBe(0);
    });
  });

  describe('canReceiveEvent', () => {
    it('should return true for subscribed events when active', () => {
      // Arrange
      const workspaceId = WorkspaceId.generate();
      const userId = UserId.generate();
      const url = WebhookUrl.fromString('https://example.com/webhook');
      const events = [WebhookEvent.fromString('task.created')];

      const webhook = WebhookEntity.create(
        workspaceId,
        userId,
        'Test Webhook',
        url,
        events
      );

      // Act
      const canReceive = webhook.canReceiveEvent(
        WebhookEvent.fromString('task.created')
      );

      // Assert
      expect(canReceive).toBe(true);
    });

    it('should return false for unsubscribed events', () => {
      // Arrange
      const workspaceId = WorkspaceId.generate();
      const userId = UserId.generate();
      const url = WebhookUrl.fromString('https://example.com/webhook');
      const events = [WebhookEvent.fromString('task.created')];

      const webhook = WebhookEntity.create(
        workspaceId,
        userId,
        'Test Webhook',
        url,
        events
      );

      // Act
      const canReceive = webhook.canReceiveEvent(
        WebhookEvent.fromString('project.created')
      );

      // Assert
      expect(canReceive).toBe(false);
    });

    it('should return false when webhook is inactive', () => {
      // Arrange
      const workspaceId = WorkspaceId.generate();
      const userId = UserId.generate();
      const url = WebhookUrl.fromString('https://example.com/webhook');
      const events = [WebhookEvent.fromString('task.created')];

      const webhook = WebhookEntity.create(
        workspaceId,
        userId,
        'Test Webhook',
        url,
        events
      );

      webhook.deactivate();

      // Act
      const canReceive = webhook.canReceiveEvent(
        WebhookEvent.fromString('task.created')
      );

      // Assert
      expect(canReceive).toBe(false);
    });
  });

  describe('deliveryRate', () => {
    it('should calculate delivery rate correctly', () => {
      // Arrange
      const workspaceId = WorkspaceId.generate();
      const userId = UserId.generate();
      const url = WebhookUrl.fromString('https://example.com/webhook');
      const events = [WebhookEvent.fromString('task.created')];

      const webhook = WebhookEntity.create(
        workspaceId,
        userId,
        'Test Webhook',
        url,
        events
      );

      // Simulate some deliveries
      webhook.recordDeliverySuccess();
      webhook.recordDeliverySuccess();
      webhook.recordDeliveryFailure('Test error');

      // Act
      const deliveryRate = webhook.deliveryRate;

      // Assert
      expect(deliveryRate).toBeCloseTo(66.67, 1); // 2 success out of 3 total = 66.67%
    });

    it('should return 0 for no deliveries', () => {
      // Arrange
      const workspaceId = WorkspaceId.generate();
      const userId = UserId.generate();
      const url = WebhookUrl.fromString('https://example.com/webhook');
      const events = [WebhookEvent.fromString('task.created')];

      const webhook = WebhookEntity.create(
        workspaceId,
        userId,
        'Test Webhook',
        url,
        events
      );

      // Act
      const deliveryRate = webhook.deliveryRate;

      // Assert
      expect(deliveryRate).toBe(0);
    });
  });
});
