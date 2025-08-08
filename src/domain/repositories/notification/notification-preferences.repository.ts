import { NotificationPreferencesEntity } from '../entities/notification-preferences.entity';
import { NotificationPreferencesId } from '../value-objects/notification-preferences-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { NotificationType } from '../value-objects/notification-type';
import { NotificationChannel } from '../value-objects/notification-channel';

export interface NotificationPreferencesFilters {
  userId?: UserId;
  globalEnabled?: boolean;
  timezone?: string;
  language?: string;
  digestEnabled?: boolean;
  digestFrequency?: 'daily' | 'weekly';
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface NotificationPreferencesSortOptions {
  field: 'userId' | 'timezone' | 'language' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}

export interface NotificationPreferencesPaginationOptions {
  page: number;
  limit: number;
  sort?: NotificationPreferencesSortOptions;
}

export interface NotificationPreferencesRepository {
  // Basic CRUD operations
  save(preferences: NotificationPreferencesEntity): Promise<void>;
  findById(
    id: NotificationPreferencesId
  ): Promise<NotificationPreferencesEntity | null>;
  findByUserId(userId: UserId): Promise<NotificationPreferencesEntity | null>;
  findMany(
    filters: NotificationPreferencesFilters,
    pagination?: NotificationPreferencesPaginationOptions
  ): Promise<{
    preferences: NotificationPreferencesEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  update(preferences: NotificationPreferencesEntity): Promise<void>;
  delete(id: NotificationPreferencesId): Promise<void>;
  deleteByUserId(userId: UserId): Promise<void>;

  // Specialized queries
  findUsersWithGlobalNotificationsEnabled(): Promise<UserId[]>;

  findUsersWithChannelEnabled(
    type: NotificationType,
    channel: NotificationChannel
  ): Promise<UserId[]>;

  findUsersWithDigestEnabled(
    frequency: 'daily' | 'weekly'
  ): Promise<NotificationPreferencesEntity[]>;

  findUsersByTimezone(timezone: string): Promise<UserId[]>;
  findUsersByLanguage(language: string): Promise<UserId[]>;

  // Bulk operations
  createDefaultPreferencesForUser(
    userId: UserId
  ): Promise<NotificationPreferencesEntity>;

  updateGlobalSettingForAllUsers(enabled: boolean): Promise<number>;

  updateChannelSettingForAllUsers(
    channel: NotificationChannel,
    enabled: boolean
  ): Promise<number>;

  // Analytics
  getPreferencesStats(): Promise<{
    totalUsers: number;
    globalEnabled: number;
    globalDisabled: number;
    byChannel: Record<
      string,
      {
        enabled: number;
        disabled: number;
      }
    >;
    byTimezone: Record<string, number>;
    byLanguage: Record<string, number>;
    digestEnabled: number;
    digestDisabled: number;
  }>;

  // Validation
  existsByUserId(userId: UserId): Promise<boolean>;
}
