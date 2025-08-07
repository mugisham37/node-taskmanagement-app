import { Injectable } from '../../application/decorators/injectable';
import { NotificationEntity } from '../../domain/notification/entities/notification.entity';
import { NotificationChannel } from '../../domain/notification/value-objects/notification-channel';
import {
  DeliveryProvider,
  DeliveryResult,
} from '../../domain/notification/services/notification-delivery.service';
import { Logger } from '../logging/logger';

export interface PushConfig {
  // Firebase Cloud Messaging (FCM) configuration
  fcm?: {
    serverKey: string;
    senderId: string;
    projectId: string;
  };

  // Apple Push Notification Service (APNs) configuration
  apns?: {
    keyId: string;
    teamId: string;
    bundleId: string;
    privateKey: string;
    production: boolean;
  };

  // Web Push configuration
  webPush?: {
    publicKey: string;
    privateKey: string;
    subject: string;
  };

  // General settings
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
}

export interface PushDevice {
  id: string;
  userId: string;
  platform: 'ios' | 'android' | 'web';
  token: string;
  endpoint?: string; // For web push
  keys?: {
    p256dh: string;
    auth: string;
  }; // For web push
  isActive: boolean;
  lastUsed: Date;
  metadata: Record<string, any>;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  sound?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
}

@Injectable()
export class PushDeliveryProvider implements DeliveryProvider {
  public readonly channel = NotificationChannel.PUSH;
  private config: PushConfig;
  private deviceRegistry = new Map<string, PushDevice[]>(); // userId -> devices
  private isHealthy = false;
  private lastHealthCheck = new Date();

  constructor(
    config: PushConfig,
    private readonly logger: Logger
  ) {
    this.config = config;
    this.validateConfiguration();
  }

  canDeliver(notification: NotificationEntity): boolean {
    // Check if notification has push channel
    const hasPushChannel = notification.channels.some(channel =>
      channel.equals(NotificationChannel.PUSH)
    );

    if (!hasPushChannel) {
      return false;
    }

    // Check if we have registered devices for the user
    const userDevices =
      this.deviceRegistry.get(notification.userId.value) || [];
    const activeDevices = userDevices.filter(device => device.isActive);

    if (activeDevices.length === 0) {
      this.logger.warn('No active push devices found for user', {
        userId: notification.userId.value,
        notificationId: notification.id.value,
      });
      return false;
    }

    return true;
  }

  async deliver(
    notification: NotificationEntity,
    content: { subject: string; body: string }
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      const userDevices =
        this.deviceRegistry.get(notification.userId.value) || [];
      const activeDevices = userDevices.filter(device => device.isActive);

      if (activeDevices.length === 0) {
        throw new Error('No active devices found for user');
      }

      // Create push payload
      const payload = this.createPushPayload(notification, content);

      // Send to all active devices
      const deliveryPromises = activeDevices.map(device =>
        this.sendToDevice(device, payload, notification)
      );

      const results = await Promise.allSettled(deliveryPromises);

      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      const deliveryTime = Date.now() - startTime;

      // Update device status based on results
      await this.updateDeviceStatus(activeDevices, results);

      this.logger.info('Push notification delivery completed', {
        notificationId: notification.id.value,
        successful,
        failed,
        totalDevices: activeDevices.length,
        deliveryTime,
      });

      return {
        success: successful > 0,
        channel: this.channel,
        messageId: `push-${notification.id.value}-${Date.now()}`,
        timestamp: new Date(),
        metadata: {
          deliveryTime,
          successful,
          failed,
          totalDevices: activeDevices.length,
          deviceResults: results.map((result, index) => ({
            deviceId: activeDevices[index].id,
            platform: activeDevices[index].platform,
            success: result.status === 'fulfilled',
            error:
              result.status === 'rejected' ? result.reason?.message : undefined,
          })),
        },
      };
    } catch (error) {
      const deliveryTime = Date.now() - startTime;

      this.logger.error('Failed to deliver push notification', {
        notificationId: notification.id.value,
        error: error.message,
        deliveryTime,
      });

      return {
        success: false,
        channel: this.channel,
        error: error.message,
        timestamp: new Date(),
        metadata: {
          deliveryTime,
        },
      };
    }
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      // Validate FCM configuration
      if (this.config.fcm) {
        if (!this.config.fcm.serverKey || !this.config.fcm.senderId) {
          throw new Error(
            'Invalid FCM configuration: missing serverKey or senderId'
          );
        }
      }

      // Validate APNs configuration
      if (this.config.apns) {
        if (
          !this.config.apns.keyId ||
          !this.config.apns.teamId ||
          !this.config.apns.privateKey
        ) {
          throw new Error(
            'Invalid APNs configuration: missing required fields'
          );
        }
      }

      // Validate Web Push configuration
      if (this.config.webPush) {
        if (!this.config.webPush.publicKey || !this.config.webPush.privateKey) {
          throw new Error('Invalid Web Push configuration: missing keys');
        }
      }

      // At least one platform should be configured
      if (!this.config.fcm && !this.config.apns && !this.config.webPush) {
        throw new Error('No push notification platforms configured');
      }

      this.isHealthy = true;
      this.lastHealthCheck = new Date();

      this.logger.info(
        'Push notification configuration validated successfully'
      );
      return true;
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date();

      this.logger.error('Push notification configuration validation failed', {
        error: error.message,
      });

      return false;
    }
  }

  async getHealthStatus(): Promise<{
    healthy: boolean;
    details?: Record<string, any>;
  }> {
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - this.lastHealthCheck.getTime();

    // Re-check health if it's been more than 5 minutes
    if (timeSinceLastCheck > 300000) {
      await this.validateConfiguration();
    }

    const totalDevices = Array.from(this.deviceRegistry.values()).flat().length;

    const activeDevices = Array.from(this.deviceRegistry.values())
      .flat()
      .filter(device => device.isActive).length;

    return {
      healthy: this.isHealthy,
      details: {
        lastHealthCheck: this.lastHealthCheck,
        totalDevices,
        activeDevices,
        platforms: {
          fcm: !!this.config.fcm,
          apns: !!this.config.apns,
          webPush: !!this.config.webPush,
        },
        config: {
          maxRetries: this.config.maxRetries,
          retryDelay: this.config.retryDelay,
          batchSize: this.config.batchSize,
        },
      },
    };
  }

  // Device management methods
  async registerDevice(
    device: Omit<PushDevice, 'id' | 'lastUsed'>
  ): Promise<string> {
    const deviceId = this.generateDeviceId();
    const newDevice: PushDevice = {
      ...device,
      id: deviceId,
      lastUsed: new Date(),
    };

    // Get existing devices for user
    const userDevices = this.deviceRegistry.get(device.userId) || [];

    // Remove any existing device with the same token
    const filteredDevices = userDevices.filter(d => d.token !== device.token);

    // Add new device
    filteredDevices.push(newDevice);

    this.deviceRegistry.set(device.userId, filteredDevices);

    this.logger.info('Push device registered', {
      deviceId,
      userId: device.userId,
      platform: device.platform,
    });

    return deviceId;
  }

  async unregisterDevice(deviceId: string): Promise<boolean> {
    for (const [userId, devices] of this.deviceRegistry.entries()) {
      const deviceIndex = devices.findIndex(d => d.id === deviceId);
      if (deviceIndex >= 0) {
        devices.splice(deviceIndex, 1);

        if (devices.length === 0) {
          this.deviceRegistry.delete(userId);
        }

        this.logger.info('Push device unregistered', { deviceId, userId });
        return true;
      }
    }

    return false;
  }

  async updateDeviceToken(
    deviceId: string,
    newToken: string
  ): Promise<boolean> {
    for (const devices of this.deviceRegistry.values()) {
      const device = devices.find(d => d.id === deviceId);
      if (device) {
        device.token = newToken;
        device.lastUsed = new Date();

        this.logger.info('Push device token updated', {
          deviceId,
          newToken: '***',
        });
        return true;
      }
    }

    return false;
  }

  async getUserDevices(userId: string): Promise<PushDevice[]> {
    return this.deviceRegistry.get(userId) || [];
  }

  async getActiveDevices(userId: string): Promise<PushDevice[]> {
    const devices = this.deviceRegistry.get(userId) || [];
    return devices.filter(device => device.isActive);
  }

  // Bulk operations
  async sendBulkPushNotifications(
    notifications: Array<{
      notification: NotificationEntity;
      content: { subject: string; body: string };
    }>
  ): Promise<Map<string, DeliveryResult>> {
    const results = new Map<string, DeliveryResult>();

    // Process in batches
    const batchSize = this.config.batchSize || 100;
    const batches = this.chunkArray(notifications, batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(async ({ notification, content }) => {
        const result = await this.deliver(notification, content);
        return {
          notificationId: notification.id.value,
          result,
        };
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ notificationId, result }) => {
        results.set(notificationId, result);
      });

      // Add delay between batches if configured
      if (
        this.config.retryDelay &&
        batches.indexOf(batch) < batches.length - 1
      ) {
        await this.delay(this.config.retryDelay);
      }
    }

    return results;
  }

  // Analytics methods
  async getDeliveryStats(dateRange?: { from: Date; to: Date }): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    deliveryRate: number;
    byPlatform: Record<
      string,
      {
        sent: number;
        delivered: number;
        failed: number;
        rate: number;
      }
    >;
  }> {
    // This would typically query a database for historical data
    // For now, return placeholder data
    return {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      deliveryRate: 0,
      byPlatform: {},
    };
  }

  // Private helper methods
  private createPushPayload(
    notification: NotificationEntity,
    content: { subject: string; body: string }
  ): PushPayload {
    const payload: PushPayload = {
      title: content.subject,
      body: content.body,
      icon: notification.data.icon || '/icons/notification-icon.png',
      badge: notification.data.badge,
      sound: notification.data.sound || 'default',
      data: {
        notificationId: notification.id.value,
        type: notification.type.value,
        priority: notification.priority.value,
        actionUrl: notification.actionUrl,
        ...notification.data,
      },
      tag: `notification-${notification.id.value}`,
      requireInteraction: notification.priority.value === 'urgent',
      silent: notification.data.silent || false,
      timestamp: Date.now(),
    };

    // Add actions if specified
    if (notification.data.actions) {
      payload.actions = notification.data.actions;
    }

    return payload;
  }

  private async sendToDevice(
    device: PushDevice,
    payload: PushPayload,
    notification: NotificationEntity
  ): Promise<void> {
    switch (device.platform) {
      case 'android':
        return this.sendFCM(device, payload);
      case 'ios':
        return this.sendAPNs(device, payload);
      case 'web':
        return this.sendWebPush(device, payload);
      default:
        throw new Error(`Unsupported platform: ${device.platform}`);
    }
  }

  private async sendFCM(
    device: PushDevice,
    payload: PushPayload
  ): Promise<void> {
    if (!this.config.fcm) {
      throw new Error('FCM not configured');
    }

    // Simulate FCM API call
    this.logger.debug('Sending FCM push notification', {
      deviceId: device.id,
      token: device.token.substring(0, 10) + '...',
      title: payload.title,
    });

    // In a real implementation, this would use the Firebase Admin SDK
    // For now, simulate success
    await this.delay(100);
  }

  private async sendAPNs(
    device: PushDevice,
    payload: PushPayload
  ): Promise<void> {
    if (!this.config.apns) {
      throw new Error('APNs not configured');
    }

    // Simulate APNs API call
    this.logger.debug('Sending APNs push notification', {
      deviceId: device.id,
      token: device.token.substring(0, 10) + '...',
      title: payload.title,
    });

    // In a real implementation, this would use the node-apn library
    // For now, simulate success
    await this.delay(100);
  }

  private async sendWebPush(
    device: PushDevice,
    payload: PushPayload
  ): Promise<void> {
    if (!this.config.webPush) {
      throw new Error('Web Push not configured');
    }

    // Simulate Web Push API call
    this.logger.debug('Sending Web Push notification', {
      deviceId: device.id,
      endpoint: device.endpoint?.substring(0, 30) + '...',
      title: payload.title,
    });

    // In a real implementation, this would use the web-push library
    // For now, simulate success
    await this.delay(100);
  }

  private async updateDeviceStatus(
    devices: PushDevice[],
    results: PromiseSettledResult<void>[]
  ): Promise<void> {
    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      const result = results[i];

      if (result.status === 'fulfilled') {
        device.lastUsed = new Date();
      } else {
        // Handle specific errors that indicate invalid tokens
        const error = result.reason?.message || '';
        if (
          error.includes('invalid token') ||
          error.includes('not registered')
        ) {
          device.isActive = false;
          this.logger.warn('Device marked as inactive due to invalid token', {
            deviceId: device.id,
            error,
          });
        }
      }
    }
  }

  private generateDeviceId(): string {
    return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
