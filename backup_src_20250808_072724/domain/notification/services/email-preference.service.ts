import { Injectable } from '../decorators/injectable';
import { NotificationPreferencesEntity } from '../../domain/notification/entities/notification-preferences.entity';
import { NotificationPreferencesRepository } from '../../domain/notification/repositories/notification-preferences.repository';
import { UserId } from '../../domain/authentication/value-objects/user-id';
import { NotificationType } from '../../domain/notification/value-objects/notification-type';
import { NotificationChannel } from '../../domain/notification/value-objects/notification-channel';
import { Logger } from '../../infrastructure/logging/logger';

export interface EmailPreference {
  enabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
}

export interface EmailDigestPreference {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  time: string; // HH:MM format
  timezone: string;
  includeTypes: NotificationType[];
  maxNotifications: number;
}

export interface EmailPreferenceService {
  // User email preferences
  getUserEmailPreferences(userId: UserId): Promise<{
    globalEnabled: boolean;
    typePreferences: Record<string, EmailPreference>;
    digestPreference: EmailDigestPreference;
    unsubscribeToken: string;
  }>;

  updateEmailPreference(
    userId: UserId,
    type: NotificationType,
    preference: EmailPreference
  ): Promise<void>;

  enableEmailNotifications(userId: UserId): Promise<void>;
  disableEmailNotifications(userId: UserId): Promise<void>;

  // Digest preferences
  updateDigestPreference(
    userId: UserId,
    preference: EmailDigestPreference
  ): Promise<void>;

  enableDigest(
    userId: UserId,
    frequency: 'daily' | 'weekly',
    time: string,
    timezone?: string
  ): Promise<void>;

  disableDigest(userId: UserId): Promise<void>;

  // Quiet hours
  setQuietHours(
    userId: UserId,
    type: NotificationType,
    start: string,
    end: string
  ): Promise<void>;

  removeQuietHours(userId: UserId, type: NotificationType): Promise<void>;

  // Unsubscribe management
  generateUnsubscribeToken(userId: UserId): Promise<string>;
  validateUnsubscribeToken(token: string): Promise<UserId | null>;
  unsubscribeFromEmails(token: string): Promise<boolean>;
  unsubscribeFromType(token: string, type: NotificationType): Promise<boolean>;

  // Bulk operations
  getDigestRecipients(frequency: 'daily' | 'weekly'): Promise<
    Array<{
      userId: UserId;
      email: string;
      timezone: string;
      time: string;
      includeTypes: NotificationType[];
      maxNotifications: number;
    }>
  >;

  // Analytics
  getEmailPreferenceStats(): Promise<{
    totalUsers: number;
    emailEnabled: number;
    emailDisabled: number;
    digestEnabled: number;
    digestDisabled: number;
    byType: Record<
      string,
      {
        enabled: number;
        disabled: number;
        immediate: number;
        batched: number;
      }
    >;
    byFrequency: Record<string, number>;
  }>;
}

@Injectable()
export class EmailPreferenceServiceImpl implements EmailPreferenceService {
  private unsubscribeTokens = new Map<
    string,
    { userId: UserId; createdAt: Date }
  >();

  constructor(
    private readonly preferencesRepository: NotificationPreferencesRepository,
    private readonly logger: Logger
  ) {}

  async getUserEmailPreferences(userId: UserId): Promise<{
    globalEnabled: boolean;
    typePreferences: Record<string, EmailPreference>;
    digestPreference: EmailDigestPreference;
    unsubscribeToken: string;
  }> {
    const preferences = await this.getOrCreatePreferences(userId);
    const typePreferences: Record<string, EmailPreference> = {};

    // Extract email preferences for each type
    for (const typePreference of preferences.typePreferences) {
      const emailChannel = typePreference.channels.find(ch =>
        ch.channel.equals(NotificationChannel.EMAIL)
      );

      if (emailChannel) {
        typePreferences[typePreference.type.value] = {
          enabled: emailChannel.enabled,
          frequency: emailChannel.frequency,
          quietHoursStart: emailChannel.quietHoursStart,
          quietHoursEnd: emailChannel.quietHoursEnd,
        };
      }
    }

    // Get digest preference
    const digestPreference: EmailDigestPreference = {
      enabled: preferences.digestEnabled,
      frequency: preferences.digestFrequency,
      time: preferences.digestTime,
      timezone: preferences.timezone,
      includeTypes: this.getDigestIncludeTypes(preferences),
      maxNotifications: 50, // Default max notifications in digest
    };

    const unsubscribeToken = await this.generateUnsubscribeToken(userId);

    return {
      globalEnabled: preferences.globalEnabled,
      typePreferences,
      digestPreference,
      unsubscribeToken,
    };
  }

  async updateEmailPreference(
    userId: UserId,
    type: NotificationType,
    preference: EmailPreference
  ): Promise<void> {
    const preferences = await this.getOrCreatePreferences(userId);

    preferences.setChannelPreference(
      type,
      NotificationChannel.EMAIL,
      preference.enabled,
      preference.frequency,
      preference.quietHoursStart && preference.quietHoursEnd
        ? { start: preference.quietHoursStart, end: preference.quietHoursEnd }
        : undefined
    );

    await this.preferencesRepository.update(preferences);

    this.logger.info('Email preference updated', {
      userId: userId.value,
      type: type.value,
      enabled: preference.enabled,
      frequency: preference.frequency,
    });
  }

  async enableEmailNotifications(userId: UserId): Promise<void> {
    const preferences = await this.getOrCreatePreferences(userId);

    // Enable global notifications
    preferences.enableGlobalNotifications();

    // Ensure email is in default channels
    const defaultChannels = preferences.defaultChannels;
    if (!defaultChannels.some(ch => ch.equals(NotificationChannel.EMAIL))) {
      preferences.setDefaultChannels([
        ...defaultChannels,
        NotificationChannel.EMAIL,
      ]);
    }

    await this.preferencesRepository.update(preferences);

    this.logger.info('Email notifications enabled', { userId: userId.value });
  }

  async disableEmailNotifications(userId: UserId): Promise<void> {
    const preferences = await this.getOrCreatePreferences(userId);

    // Disable email for all notification types
    for (const typePreference of preferences.typePreferences) {
      preferences.setChannelPreference(
        typePreference.type,
        NotificationChannel.EMAIL,
        false
      );
    }

    // Remove email from default channels
    const defaultChannels = preferences.defaultChannels.filter(
      ch => !ch.equals(NotificationChannel.EMAIL)
    );
    preferences.setDefaultChannels(defaultChannels);

    await this.preferencesRepository.update(preferences);

    this.logger.info('Email notifications disabled', { userId: userId.value });
  }

  async updateDigestPreference(
    userId: UserId,
    preference: EmailDigestPreference
  ): Promise<void> {
    const preferences = await this.getOrCreatePreferences(userId);

    if (preference.enabled) {
      preferences.enableDigest(preference.frequency, preference.time);
    } else {
      preferences.disableDigest();
    }

    if (preference.timezone) {
      preferences.updateTimezone(preference.timezone);
    }

    // Store digest-specific metadata
    preferences.updateMetadata({
      digestIncludeTypes: preference.includeTypes.map(t => t.value),
      digestMaxNotifications: preference.maxNotifications,
    });

    await this.preferencesRepository.update(preferences);

    this.logger.info('Digest preference updated', {
      userId: userId.value,
      enabled: preference.enabled,
      frequency: preference.frequency,
      time: preference.time,
    });
  }

  async enableDigest(
    userId: UserId,
    frequency: 'daily' | 'weekly',
    time: string,
    timezone?: string
  ): Promise<void> {
    const preferences = await this.getOrCreatePreferences(userId);

    preferences.enableDigest(frequency, time);

    if (timezone) {
      preferences.updateTimezone(timezone);
    }

    await this.preferencesRepository.update(preferences);

    this.logger.info('Email digest enabled', {
      userId: userId.value,
      frequency,
      time,
      timezone,
    });
  }

  async disableDigest(userId: UserId): Promise<void> {
    const preferences = await this.getOrCreatePreferences(userId);
    preferences.disableDigest();
    await this.preferencesRepository.update(preferences);

    this.logger.info('Email digest disabled', { userId: userId.value });
  }

  async setQuietHours(
    userId: UserId,
    type: NotificationType,
    start: string,
    end: string
  ): Promise<void> {
    const preferences = await this.getOrCreatePreferences(userId);

    preferences.setChannelPreference(
      type,
      NotificationChannel.EMAIL,
      true, // Keep enabled
      'immediate', // Keep current frequency
      { start, end }
    );

    await this.preferencesRepository.update(preferences);

    this.logger.info('Quiet hours set', {
      userId: userId.value,
      type: type.value,
      start,
      end,
    });
  }

  async removeQuietHours(
    userId: UserId,
    type: NotificationType
  ): Promise<void> {
    const preferences = await this.getOrCreatePreferences(userId);

    preferences.setChannelPreference(
      type,
      NotificationChannel.EMAIL,
      true, // Keep enabled
      'immediate' // Keep current frequency
      // No quiet hours
    );

    await this.preferencesRepository.update(preferences);

    this.logger.info('Quiet hours removed', {
      userId: userId.value,
      type: type.value,
    });
  }

  async generateUnsubscribeToken(userId: UserId): Promise<string> {
    // Generate a secure token
    const token = this.generateSecureToken();

    // Store token with expiration (30 days)
    this.unsubscribeTokens.set(token, {
      userId,
      createdAt: new Date(),
    });

    // Clean up expired tokens
    this.cleanupExpiredTokens();

    return token;
  }

  async validateUnsubscribeToken(token: string): Promise<UserId | null> {
    const tokenData = this.unsubscribeTokens.get(token);

    if (!tokenData) {
      return null;
    }

    // Check if token is expired (30 days)
    const expirationTime = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    const isExpired =
      Date.now() - tokenData.createdAt.getTime() > expirationTime;

    if (isExpired) {
      this.unsubscribeTokens.delete(token);
      return null;
    }

    return tokenData.userId;
  }

  async unsubscribeFromEmails(token: string): Promise<boolean> {
    const userId = await this.validateUnsubscribeToken(token);

    if (!userId) {
      return false;
    }

    await this.disableEmailNotifications(userId);

    // Remove token after use
    this.unsubscribeTokens.delete(token);

    this.logger.info('User unsubscribed from all emails', {
      userId: userId.value,
      token,
    });

    return true;
  }

  async unsubscribeFromType(
    token: string,
    type: NotificationType
  ): Promise<boolean> {
    const userId = await this.validateUnsubscribeToken(token);

    if (!userId) {
      return false;
    }

    await this.updateEmailPreference(userId, type, {
      enabled: false,
      frequency: 'immediate',
    });

    this.logger.info('User unsubscribed from notification type', {
      userId: userId.value,
      type: type.value,
      token,
    });

    return true;
  }

  async getDigestRecipients(frequency: 'daily' | 'weekly'): Promise<
    Array<{
      userId: UserId;
      email: string;
      timezone: string;
      time: string;
      includeTypes: NotificationType[];
      maxNotifications: number;
    }>
  > {
    const preferences =
      await this.preferencesRepository.findUsersWithDigestEnabled(frequency);
    const recipients: Array<{
      userId: UserId;
      email: string;
      timezone: string;
      time: string;
      includeTypes: NotificationType[];
      maxNotifications: number;
    }> = [];

    for (const preference of preferences) {
      // Get user email (would need to fetch from user repository)
      const userEmail = await this.getUserEmail(preference.userId);

      if (userEmail) {
        recipients.push({
          userId: preference.userId,
          email: userEmail,
          timezone: preference.timezone,
          time: preference.digestTime,
          includeTypes: this.getDigestIncludeTypes(preference),
          maxNotifications: preference.metadata.digestMaxNotifications || 50,
        });
      }
    }

    return recipients;
  }

  async getEmailPreferenceStats(): Promise<{
    totalUsers: number;
    emailEnabled: number;
    emailDisabled: number;
    digestEnabled: number;
    digestDisabled: number;
    byType: Record<
      string,
      {
        enabled: number;
        disabled: number;
        immediate: number;
        batched: number;
      }
    >;
    byFrequency: Record<string, number>;
  }> {
    const stats = await this.preferencesRepository.getPreferencesStats();

    // Calculate email-specific stats
    const emailStats = {
      totalUsers: stats.totalUsers,
      emailEnabled: stats.byChannel.email?.enabled || 0,
      emailDisabled: stats.byChannel.email?.disabled || 0,
      digestEnabled: stats.digestEnabled,
      digestDisabled: stats.digestDisabled,
      byType: {} as Record<string, any>,
      byFrequency: {} as Record<string, number>,
    };

    // This would require more detailed analysis of preferences
    // For now, return basic stats
    return emailStats;
  }

  // Private helper methods
  private async getOrCreatePreferences(
    userId: UserId
  ): Promise<NotificationPreferencesEntity> {
    let preferences = await this.preferencesRepository.findByUserId(userId);

    if (!preferences) {
      preferences =
        await this.preferencesRepository.createDefaultPreferencesForUser(
          userId
        );
    }

    return preferences;
  }

  private getDigestIncludeTypes(
    preferences: NotificationPreferencesEntity
  ): NotificationType[] {
    const includeTypes = preferences.metadata.digestIncludeTypes;

    if (Array.isArray(includeTypes)) {
      return includeTypes.map(type => NotificationType.create(type));
    }

    // Default to all task-related types
    return [
      NotificationType.TASK_ASSIGNED,
      NotificationType.TASK_DUE_SOON,
      NotificationType.TASK_OVERDUE,
      NotificationType.TASK_COMPLETED,
      NotificationType.TASK_COMMENTED,
    ];
  }

  private async getUserEmail(userId: UserId): Promise<string | null> {
    // This would fetch the user's email from the user repository
    // For now, return a placeholder
    return `user-${userId.value}@example.com`;
  }

  private generateSecureToken(): string {
    // Generate a cryptographically secure random token
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';

    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return token;
  }

  private cleanupExpiredTokens(): void {
    const expirationTime = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = Date.now();

    for (const [token, data] of this.unsubscribeTokens.entries()) {
      if (now - data.createdAt.getTime() > expirationTime) {
        this.unsubscribeTokens.delete(token);
      }
    }
  }
}
