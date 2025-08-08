import { Entity } from '../../shared/base/entity';
import { NotificationPreferencesId } from '../value-objects/notification-preferences-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { NotificationType } from '../value-objects/notification-type';
import { NotificationChannel } from '../value-objects/notification-channel';
import { DomainEvent } from '../../shared/events/domain-event';

export interface ChannelPreference {
  channel: NotificationChannel;
  enabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
}

export interface TypePreference {
  type: NotificationType;
  enabled: boolean;
  channels: ChannelPreference[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface NotificationPreferencesProps {
  id: NotificationPreferencesId;
  userId: UserId;
  globalEnabled: boolean;
  typePreferences: TypePreference[];
  defaultChannels: NotificationChannel[];
  timezone: string;
  language: string;
  digestEnabled: boolean;
  digestFrequency: 'daily' | 'weekly';
  digestTime: string; // HH:MM format
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationPreferencesEntity extends Entity<NotificationPreferencesProps> {
  private constructor(props: NotificationPreferencesProps) {
    super(props);
  }

  public static create(
    userId: UserId,
    options: {
      timezone?: string;
      language?: string;
      defaultChannels?: NotificationChannel[];
    } = {}
  ): NotificationPreferencesEntity {
    const id = NotificationPreferencesId.generate();
    const now = new Date();

    const preferences = new NotificationPreferencesEntity({
      id,
      userId,
      globalEnabled: true,
      typePreferences: [],
      defaultChannels: options.defaultChannels || [
        NotificationChannel.IN_APP,
        NotificationChannel.EMAIL,
      ],
      timezone: options.timezone || 'UTC',
      language: options.language || 'en',
      digestEnabled: false,
      digestFrequency: 'daily',
      digestTime: '09:00',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });

    preferences.addDomainEvent(
      new NotificationPreferencesCreatedEvent(preferences)
    );
    return preferences;
  }

  public static fromPersistence(
    props: NotificationPreferencesProps
  ): NotificationPreferencesEntity {
    return new NotificationPreferencesEntity(props);
  }

  // Getters
  public get id(): NotificationPreferencesId {
    return this.props.id;
  }

  public get userId(): UserId {
    return this.props.userId;
  }

  public get globalEnabled(): boolean {
    return this.props.globalEnabled;
  }

  public get typePreferences(): TypePreference[] {
    return this.props.typePreferences;
  }

  public get defaultChannels(): NotificationChannel[] {
    return this.props.defaultChannels;
  }

  public get timezone(): string {
    return this.props.timezone;
  }

  public get language(): string {
    return this.props.language;
  }

  public get digestEnabled(): boolean {
    return this.props.digestEnabled;
  }

  public get digestFrequency(): 'daily' | 'weekly' {
    return this.props.digestFrequency;
  }

  public get digestTime(): string {
    return this.props.digestTime;
  }

  public get metadata(): Record<string, any> {
    return this.props.metadata;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business methods
  public enableGlobalNotifications(): void {
    if (this.props.globalEnabled) {
      return;
    }

    this.props.globalEnabled = true;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new NotificationPreferencesUpdatedEvent(this));
  }

  public disableGlobalNotifications(): void {
    if (!this.props.globalEnabled) {
      return;
    }

    this.props.globalEnabled = false;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new NotificationPreferencesUpdatedEvent(this));
  }

  public setTypePreference(
    type: NotificationType,
    enabled: boolean,
    channels: ChannelPreference[] = [],
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  ): void {
    const existingIndex = this.props.typePreferences.findIndex(pref =>
      pref.type.equals(type)
    );

    const typePreference: TypePreference = {
      type,
      enabled,
      channels:
        channels.length > 0 ? channels : this.getDefaultChannelPreferences(),
      priority,
    };

    if (existingIndex >= 0) {
      this.props.typePreferences[existingIndex] = typePreference;
    } else {
      this.props.typePreferences.push(typePreference);
    }

    this.props.updatedAt = new Date();
    this.addDomainEvent(new NotificationPreferencesUpdatedEvent(this));
  }

  public setChannelPreference(
    type: NotificationType,
    channel: NotificationChannel,
    enabled: boolean,
    frequency: 'immediate' | 'hourly' | 'daily' | 'weekly' = 'immediate',
    quietHours?: { start: string; end: string }
  ): void {
    let typePreference = this.props.typePreferences.find(pref =>
      pref.type.equals(type)
    );

    if (!typePreference) {
      typePreference = {
        type,
        enabled: true,
        channels: this.getDefaultChannelPreferences(),
        priority: 'normal',
      };
      this.props.typePreferences.push(typePreference);
    }

    const existingChannelIndex = typePreference.channels.findIndex(ch =>
      ch.channel.equals(channel)
    );

    const channelPreference: ChannelPreference = {
      channel,
      enabled,
      frequency,
      quietHoursStart: quietHours?.start,
      quietHoursEnd: quietHours?.end,
    };

    if (existingChannelIndex >= 0) {
      typePreference.channels[existingChannelIndex] = channelPreference;
    } else {
      typePreference.channels.push(channelPreference);
    }

    this.props.updatedAt = new Date();
    this.addDomainEvent(new NotificationPreferencesUpdatedEvent(this));
  }

  public setDefaultChannels(channels: NotificationChannel[]): void {
    this.props.defaultChannels = channels;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new NotificationPreferencesUpdatedEvent(this));
  }

  public updateTimezone(timezone: string): void {
    this.props.timezone = timezone;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new NotificationPreferencesUpdatedEvent(this));
  }

  public updateLanguage(language: string): void {
    this.props.language = language;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new NotificationPreferencesUpdatedEvent(this));
  }

  public enableDigest(frequency: 'daily' | 'weekly', time: string): void {
    this.props.digestEnabled = true;
    this.props.digestFrequency = frequency;
    this.props.digestTime = time;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new NotificationPreferencesUpdatedEvent(this));
  }

  public disableDigest(): void {
    this.props.digestEnabled = false;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new NotificationPreferencesUpdatedEvent(this));
  }

  // Query methods
  public isNotificationEnabled(
    type: NotificationType,
    channel: NotificationChannel
  ): boolean {
    if (!this.props.globalEnabled) {
      return false;
    }

    const typePreference = this.props.typePreferences.find(pref =>
      pref.type.equals(type)
    );

    if (!typePreference) {
      // Use default channels if no specific preference is set
      return this.props.defaultChannels.some(ch => ch.equals(channel));
    }

    if (!typePreference.enabled) {
      return false;
    }

    const channelPreference = typePreference.channels.find(ch =>
      ch.channel.equals(channel)
    );
    return channelPreference ? channelPreference.enabled : false;
  }

  public getChannelFrequency(
    type: NotificationType,
    channel: NotificationChannel
  ): string {
    const typePreference = this.props.typePreferences.find(pref =>
      pref.type.equals(type)
    );

    if (!typePreference) {
      return 'immediate';
    }

    const channelPreference = typePreference.channels.find(ch =>
      ch.channel.equals(channel)
    );
    return channelPreference ? channelPreference.frequency : 'immediate';
  }

  public isInQuietHours(
    type: NotificationType,
    channel: NotificationChannel,
    currentTime: Date
  ): boolean {
    const typePreference = this.props.typePreferences.find(pref =>
      pref.type.equals(type)
    );

    if (!typePreference) {
      return false;
    }

    const channelPreference = typePreference.channels.find(ch =>
      ch.channel.equals(channel)
    );

    if (
      !channelPreference ||
      !channelPreference.quietHoursStart ||
      !channelPreference.quietHoursEnd
    ) {
      return false;
    }

    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = channelPreference.quietHoursStart
      .split(':')
      .map(Number);
    const [endHour, endMinute] = channelPreference.quietHoursEnd
      .split(':')
      .map(Number);

    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    if (startTimeMinutes <= endTimeMinutes) {
      // Same day quiet hours
      return (
        currentTimeMinutes >= startTimeMinutes &&
        currentTimeMinutes <= endTimeMinutes
      );
    } else {
      // Quiet hours span midnight
      return (
        currentTimeMinutes >= startTimeMinutes ||
        currentTimeMinutes <= endTimeMinutes
      );
    }
  }

  public getEnabledChannels(type: NotificationType): NotificationChannel[] {
    if (!this.props.globalEnabled) {
      return [];
    }

    const typePreference = this.props.typePreferences.find(pref =>
      pref.type.equals(type)
    );

    if (!typePreference) {
      return this.props.defaultChannels;
    }

    if (!typePreference.enabled) {
      return [];
    }

    return typePreference.channels
      .filter(ch => ch.enabled)
      .map(ch => ch.channel);
  }

  private getDefaultChannelPreferences(): ChannelPreference[] {
    return this.props.defaultChannels.map(channel => ({
      channel,
      enabled: true,
      frequency: 'immediate' as const,
    }));
  }
}

// Domain Events
export class NotificationPreferencesCreatedEvent extends DomainEvent {
  constructor(public readonly preferences: NotificationPreferencesEntity) {
    super('notification_preferences.created', preferences.id.value);
  }
}

export class NotificationPreferencesUpdatedEvent extends DomainEvent {
  constructor(public readonly preferences: NotificationPreferencesEntity) {
    super('notification_preferences.updated', preferences.id.value);
  }
}
