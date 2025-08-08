import { Injectable } from '../decorators/injectable';
import {
  PushDeliveryProvider,
  PushDevice,
} from '../../infrastructure/push/push-delivery-provider';
import { NotificationPreferencesRepository } from '../../domain/notification/repositories/notification-preferences.repository';
import { UserId } from '../../domain/authentication/value-objects/user-id';
import { NotificationType } from '../../domain/notification/value-objects/notification-type';
import { NotificationChannel } from '../../domain/notification/value-objects/notification-channel';
import { Logger } from '../../infrastructure/logging/logger';

export interface PushSubscription {
  id: string;
  userId: string;
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  token: string;
  endpoint?: string; // For web push
  keys?: {
    p256dh: string;
    auth: string;
  }; // For web push
  userAgent?: string;
  isActive: boolean;
  enabledTypes: NotificationType[];
  settings: {
    sound: boolean;
    vibration: boolean;
    badge: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PushNotificationService {
  // Subscription management
  createSubscription(
    userId: UserId,
    platform: 'ios' | 'android' | 'web',
    token: string,
    options?: {
      endpoint?: string;
      keys?: { p256dh: string; auth: string };
      userAgent?: string;
      enabledTypes?: NotificationType[];
    }
  ): Promise<PushSubscription>;

  updateSubscription(
    subscriptionId: string,
    updates: Partial<
      Pick<
        PushSubscription,
        'token' | 'endpoint' | 'keys' | 'isActive' | 'settings'
      >
    >
  ): Promise<PushSubscription>;

  deleteSubscription(subscriptionId: string): Promise<boolean>;

  getUserSubscriptions(userId: UserId): Promise<PushSubscription[]>;
  getActiveSubscriptions(userId: UserId): Promise<PushSubscription[]>;

  // Permission management
  updateNotificationPermissions(
    subscriptionId: string,
    enabledTypes: NotificationType[]
  ): Promise<void>;

  enableNotificationType(
    subscriptionId: string,
    type: NotificationType
  ): Promise<void>;

  disableNotificationType(
    subscriptionId: string,
    type: NotificationType
  ): Promise<void>;

  // Settings management
  updatePushSettings(
    subscriptionId: string,
    settings: Partial<PushSubscription['settings']>
  ): Promise<void>;

  setQuietHours(
    subscriptionId: string,
    start: string,
    end: string
  ): Promise<void>;

  removeQuietHours(subscriptionId: string): Promise<void>;

  // Bulk operations
  enablePushForUser(userId: UserId): Promise<void>;
  disablePushForUser(userId: UserId): Promise<void>;

  updateUserPushSettings(
    userId: UserId,
    settings: Partial<PushSubscription['settings']>
  ): Promise<void>;

  // Analytics and monitoring
  getSubscriptionStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byPlatform: Record<string, number>;
    byType: Record<string, number>;
  }>;

  getUserEngagementStats(userId: UserId): Promise<{
    totalNotifications: number;
    delivered: number;
    clicked: number;
    dismissed: number;
    engagementRate: number;
  }>;

  // Device token management
  refreshDeviceToken(oldToken: string, newToken: string): Promise<boolean>;
  validateDeviceToken(
    token: string,
    platform: 'ios' | 'android' | 'web'
  ): Promise<boolean>;

  // Testing and debugging
  sendTestNotification(
    subscriptionId: string,
    title: string,
    body: string
  ): Promise<boolean>;

  validateSubscription(subscriptionId: string): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }>;
}

@Injectable()
export class PushNotificationServiceImpl implements PushNotificationService {
  private subscriptions = new Map<string, PushSubscription>();
  private userSubscriptions = new Map<string, string[]>(); // userId -> subscriptionIds

  constructor(
    private readonly pushProvider: PushDeliveryProvider,
    private readonly preferencesRepository: NotificationPreferencesRepository,
    private readonly logger: Logger
  ) {}

  async createSubscription(
    userId: UserId,
    platform: 'ios' | 'android' | 'web',
    token: string,
    options: {
      endpoint?: string;
      keys?: { p256dh: string; auth: string };
      userAgent?: string;
      enabledTypes?: NotificationType[];
    } = {}
  ): Promise<PushSubscription> {
    // Validate token format based on platform
    if (!this.isValidToken(token, platform)) {
      throw new Error(`Invalid ${platform} push token format`);
    }

    // Register device with push provider
    const deviceId = await this.pushProvider.registerDevice({
      userId: userId.value,
      platform,
      token,
      endpoint: options.endpoint,
      keys: options.keys,
      isActive: true,
      metadata: {
        userAgent: options.userAgent,
        createdAt: new Date(),
      },
    });

    // Create subscription
    const subscriptionId = this.generateSubscriptionId();
    const subscription: PushSubscription = {
      id: subscriptionId,
      userId: userId.value,
      deviceId,
      platform,
      token,
      endpoint: options.endpoint,
      keys: options.keys,
      userAgent: options.userAgent,
      isActive: true,
      enabledTypes: options.enabledTypes || this.getDefaultEnabledTypes(),
      settings: {
        sound: true,
        vibration: true,
        badge: true,
      },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store subscription
    this.subscriptions.set(subscriptionId, subscription);

    // Update user subscriptions index
    const userSubs = this.userSubscriptions.get(userId.value) || [];
    userSubs.push(subscriptionId);
    this.userSubscriptions.set(userId.value, userSubs);

    this.logger.info('Push subscription created', {
      subscriptionId,
      userId: userId.value,
      platform,
      deviceId,
    });

    return subscription;
  }

  async updateSubscription(
    subscriptionId: string,
    updates: Partial<
      Pick<
        PushSubscription,
        'token' | 'endpoint' | 'keys' | 'isActive' | 'settings'
      >
    >
  ): Promise<PushSubscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    // Update subscription
    Object.assign(subscription, updates, { updatedAt: new Date() });

    // Update device token if changed
    if (updates.token && updates.token !== subscription.token) {
      await this.pushProvider.updateDeviceToken(
        subscription.deviceId,
        updates.token
      );
    }

    this.logger.info('Push subscription updated', {
      subscriptionId,
      updates: Object.keys(updates),
    });

    return subscription;
  }

  async deleteSubscription(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    // Unregister device from push provider
    await this.pushProvider.unregisterDevice(subscription.deviceId);

    // Remove from storage
    this.subscriptions.delete(subscriptionId);

    // Update user subscriptions index
    const userSubs = this.userSubscriptions.get(subscription.userId) || [];
    const updatedSubs = userSubs.filter(id => id !== subscriptionId);

    if (updatedSubs.length === 0) {
      this.userSubscriptions.delete(subscription.userId);
    } else {
      this.userSubscriptions.set(subscription.userId, updatedSubs);
    }

    this.logger.info('Push subscription deleted', {
      subscriptionId,
      userId: subscription.userId,
    });

    return true;
  }

  async getUserSubscriptions(userId: UserId): Promise<PushSubscription[]> {
    const subscriptionIds = this.userSubscriptions.get(userId.value) || [];
    return subscriptionIds
      .map(id => this.subscriptions.get(id))
      .filter((sub): sub is PushSubscription => sub !== undefined);
  }

  async getActiveSubscriptions(userId: UserId): Promise<PushSubscription[]> {
    const subscriptions = await this.getUserSubscriptions(userId);
    return subscriptions.filter(sub => sub.isActive);
  }

  async updateNotificationPermissions(
    subscriptionId: string,
    enabledTypes: NotificationType[]
  ): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    subscription.enabledTypes = enabledTypes;
    subscription.updatedAt = new Date();

    this.logger.info('Push notification permissions updated', {
      subscriptionId,
      enabledTypes: enabledTypes.map(t => t.value),
    });
  }

  async enableNotificationType(
    subscriptionId: string,
    type: NotificationType
  ): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (!subscription.enabledTypes.some(t => t.equals(type))) {
      subscription.enabledTypes.push(type);
      subscription.updatedAt = new Date();

      this.logger.info('Push notification type enabled', {
        subscriptionId,
        type: type.value,
      });
    }
  }

  async disableNotificationType(
    subscriptionId: string,
    type: NotificationType
  ): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    subscription.enabledTypes = subscription.enabledTypes.filter(
      t => !t.equals(type)
    );
    subscription.updatedAt = new Date();

    this.logger.info('Push notification type disabled', {
      subscriptionId,
      type: type.value,
    });
  }

  async updatePushSettings(
    subscriptionId: string,
    settings: Partial<PushSubscription['settings']>
  ): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    subscription.settings = { ...subscription.settings, ...settings };
    subscription.updatedAt = new Date();

    this.logger.info('Push settings updated', {
      subscriptionId,
      settings: Object.keys(settings),
    });
  }

  async setQuietHours(
    subscriptionId: string,
    start: string,
    end: string
  ): Promise<void> {
    await this.updatePushSettings(subscriptionId, {
      quietHoursStart: start,
      quietHoursEnd: end,
    });
  }

  async removeQuietHours(subscriptionId: string): Promise<void> {
    await this.updatePushSettings(subscriptionId, {
      quietHoursStart: undefined,
      quietHoursEnd: undefined,
    });
  }

  async enablePushForUser(userId: UserId): Promise<void> {
    const subscriptions = await this.getUserSubscriptions(userId);

    for (const subscription of subscriptions) {
      subscription.isActive = true;
      subscription.updatedAt = new Date();
    }

    this.logger.info('Push notifications enabled for user', {
      userId: userId.value,
      subscriptionCount: subscriptions.length,
    });
  }

  async disablePushForUser(userId: UserId): Promise<void> {
    const subscriptions = await this.getUserSubscriptions(userId);

    for (const subscription of subscriptions) {
      subscription.isActive = false;
      subscription.updatedAt = new Date();
    }

    this.logger.info('Push notifications disabled for user', {
      userId: userId.value,
      subscriptionCount: subscriptions.length,
    });
  }

  async updateUserPushSettings(
    userId: UserId,
    settings: Partial<PushSubscription['settings']>
  ): Promise<void> {
    const subscriptions = await this.getUserSubscriptions(userId);

    for (const subscription of subscriptions) {
      subscription.settings = { ...subscription.settings, ...settings };
      subscription.updatedAt = new Date();
    }

    this.logger.info('Push settings updated for user', {
      userId: userId.value,
      subscriptionCount: subscriptions.length,
      settings: Object.keys(settings),
    });
  }

  async getSubscriptionStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byPlatform: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const allSubscriptions = Array.from(this.subscriptions.values());

    const stats = {
      total: allSubscriptions.length,
      active: allSubscriptions.filter(s => s.isActive).length,
      inactive: allSubscriptions.filter(s => !s.isActive).length,
      byPlatform: {} as Record<string, number>,
      byType: {} as Record<string, number>,
    };

    // Count by platform
    for (const subscription of allSubscriptions) {
      stats.byPlatform[subscription.platform] =
        (stats.byPlatform[subscription.platform] || 0) + 1;
    }

    // Count by enabled types
    for (const subscription of allSubscriptions) {
      for (const type of subscription.enabledTypes) {
        stats.byType[type.value] = (stats.byType[type.value] || 0) + 1;
      }
    }

    return stats;
  }

  async getUserEngagementStats(userId: UserId): Promise<{
    totalNotifications: number;
    delivered: number;
    clicked: number;
    dismissed: number;
    engagementRate: number;
  }> {
    // This would typically query analytics data
    // For now, return placeholder data
    return {
      totalNotifications: 0,
      delivered: 0,
      clicked: 0,
      dismissed: 0,
      engagementRate: 0,
    };
  }

  async refreshDeviceToken(
    oldToken: string,
    newToken: string
  ): Promise<boolean> {
    // Find subscription with old token
    for (const subscription of this.subscriptions.values()) {
      if (subscription.token === oldToken) {
        subscription.token = newToken;
        subscription.updatedAt = new Date();

        // Update in push provider
        await this.pushProvider.updateDeviceToken(
          subscription.deviceId,
          newToken
        );

        this.logger.info('Device token refreshed', {
          subscriptionId: subscription.id,
          oldToken: oldToken.substring(0, 10) + '...',
          newToken: newToken.substring(0, 10) + '...',
        });

        return true;
      }
    }

    return false;
  }

  async validateDeviceToken(
    token: string,
    platform: 'ios' | 'android' | 'web'
  ): Promise<boolean> {
    return this.isValidToken(token, platform);
  }

  async sendTestNotification(
    subscriptionId: string,
    title: string,
    body: string
  ): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || !subscription.isActive) {
      return false;
    }

    try {
      // Create a test notification entity
      const testNotification = {
        id: { value: `test-${Date.now()}` },
        userId: { value: subscription.userId },
        type: { value: 'system' },
        priority: { value: 'normal' },
        channels: [NotificationChannel.PUSH],
        data: {
          test: true,
        },
        actionUrl: undefined,
      };

      // Send through push provider
      const result = await this.pushProvider.deliver(testNotification as any, {
        subject: title,
        body,
      });

      this.logger.info('Test notification sent', {
        subscriptionId,
        success: result.success,
      });

      return result.success;
    } catch (error) {
      this.logger.error('Failed to send test notification', {
        subscriptionId,
        error: error.message,
      });
      return false;
    }
  }

  async validateSubscription(subscriptionId: string): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      return {
        valid: false,
        issues: ['Subscription not found'],
        recommendations: ['Create a new subscription'],
      };
    }

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if subscription is active
    if (!subscription.isActive) {
      issues.push('Subscription is inactive');
      recommendations.push('Reactivate the subscription');
    }

    // Check token validity
    if (!this.isValidToken(subscription.token, subscription.platform)) {
      issues.push('Invalid device token format');
      recommendations.push('Refresh the device token');
    }

    // Check if any notification types are enabled
    if (subscription.enabledTypes.length === 0) {
      issues.push('No notification types enabled');
      recommendations.push('Enable at least one notification type');
    }

    // Check for stale subscription (not updated in 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (subscription.updatedAt < thirtyDaysAgo) {
      issues.push('Subscription is stale (not updated in 30 days)');
      recommendations.push(
        'Refresh the subscription or verify device is still active'
      );
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations,
    };
  }

  // Private helper methods
  private isValidToken(
    token: string,
    platform: 'ios' | 'android' | 'web'
  ): boolean {
    switch (platform) {
      case 'ios':
        // APNs device tokens are 64 hex characters
        return /^[a-fA-F0-9]{64}$/.test(token);
      case 'android':
        // FCM tokens are base64-encoded strings, typically 152+ characters
        return token.length >= 140 && /^[A-Za-z0-9_-]+$/.test(token);
      case 'web':
        // Web push tokens can vary, but should be non-empty strings
        return token.length > 0;
      default:
        return false;
    }
  }

  private getDefaultEnabledTypes(): NotificationType[] {
    return [
      NotificationType.TASK_ASSIGNED,
      NotificationType.TASK_DUE_SOON,
      NotificationType.TASK_OVERDUE,
      NotificationType.TASK_COMMENTED,
      NotificationType.TEAM_INVITATION,
      NotificationType.SYSTEM_ANNOUNCEMENT,
      NotificationType.SECURITY_ALERT,
    ];
  }

  private generateSubscriptionId(): string {
    return `push-sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
