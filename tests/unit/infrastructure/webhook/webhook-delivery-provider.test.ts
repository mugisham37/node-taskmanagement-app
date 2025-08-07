import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { WebhookDeliveryProvider, WebhookConfig } from '../../../../src/infrastructure/webhook/webhook-delivery-provider';
import { NotificationEntity } from '../../../../src/domain/notification/entities/notification.entity';
import { UserId } from '../../../../src/domain/authentication/value-objects/UserId';
import { NotificationType } from '../../../../src/domain/notification/value-objects/notification-type';
import { NotificationChannel } from '../../../../src/domain/notification/value-objects/notification-channel';
import { NotificationPriority } from '../../../../src/domain/notification/value-objects/notification-priority';
import { ConsoleLogger } from '../../../../src/infrastructure/logging/logger';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      request: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

describe('WebhookDeliveryProvider', () => {
  let provider: WebhookDeliveryProvider;
  let mockHttpClient: any;
  let config: Partial<WebhookConfig>;
  let logger: ConsoleLogger;

  beforeEach(() => {
    // Setup mock HTTP client
    mockHttpClient = {
      request: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    (axios.create as Mock).mockReturnValue(mockHttpClient);

    config = {
      timeout: 30000,
      