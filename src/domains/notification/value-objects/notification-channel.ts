import { ValueObject } from '../../../shared/domain/value-object';

export enum NotificationChannelEnum {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  TEAMS = 'teams',
  DISCORD = 'discord',
}

export class NotificationChannel extends ValueObject<NotificationChannelEnum> {
  private constructor(value: NotificationChannelEnum) {
    super(value);
  }

  public static create(value: string): NotificationChannel {
    const enumValue = Object.values(NotificationChannelEnum).find(
      channel => channel === value
    );

    if (!enumValue) {
      throw new Error(`Invalid notification channel: ${value}`);
    }

    return new NotificationChannel(enumValue);
  }

  public static fromEnum(value: NotificationChannelEnum): NotificationChannel {
    return new NotificationChannel(value);
  }

  // Predefined channels
  public static IN_APP = new NotificationChannel(
    NotificationChannelEnum.IN_APP
  );
  public static EMAIL = new NotificationChannel(NotificationChannelEnum.EMAIL);
  public static PUSH = new NotificationChannel(NotificationChannelEnum.PUSH);
  public static SMS = new NotificationChannel(NotificationChannelEnum.SMS);
  public static WEBHOOK = new NotificationChannel(
    NotificationChannelEnum.WEBHOOK
  );
  public static SLACK = new NotificationChannel(NotificationChannelEnum.SLACK);
  public static TEAMS = new NotificationChannel(NotificationChannelEnum.TEAMS);
  public static DISCORD = new NotificationChannel(
    NotificationChannelEnum.DISCORD
  );

  public get value(): NotificationChannelEnum {
    return this.props;
  }

  public equals(other: NotificationChannel): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }

  // Helper methods
  public isRealTime(): boolean {
    return [
      NotificationChannelEnum.IN_APP,
      NotificationChannelEnum.PUSH,
      NotificationChannelEnum.WEBHOOK,
    ].includes(this.value);
  }

  public isExternal(): boolean {
    return [
      NotificationChannelEnum.EMAIL,
      NotificationChannelEnum.SMS,
      NotificationChannelEnum.SLACK,
      NotificationChannelEnum.TEAMS,
      NotificationChannelEnum.DISCORD,
    ].includes(this.value);
  }

  public requiresConfiguration(): boolean {
    return [
      NotificationChannelEnum.SMS,
      NotificationChannelEnum.WEBHOOK,
      NotificationChannelEnum.SLACK,
      NotificationChannelEnum.TEAMS,
      NotificationChannelEnum.DISCORD,
    ].includes(this.value);
  }

  public getDisplayName(): string {
    const displayNames: Record<NotificationChannelEnum, string> = {
      [NotificationChannelEnum.IN_APP]: 'In-App',
      [NotificationChannelEnum.EMAIL]: 'Email',
      [NotificationChannelEnum.PUSH]: 'Push Notification',
      [NotificationChannelEnum.SMS]: 'SMS',
      [NotificationChannelEnum.WEBHOOK]: 'Webhook',
      [NotificationChannelEnum.SLACK]: 'Slack',
      [NotificationChannelEnum.TEAMS]: 'Microsoft Teams',
      [NotificationChannelEnum.DISCORD]: 'Discord',
    };

    return displayNames[this.value];
  }

  public getIcon(): string {
    const icons: Record<NotificationChannelEnum, string> = {
      [NotificationChannelEnum.IN_APP]: '🔔',
      [NotificationChannelEnum.EMAIL]: '📧',
      [NotificationChannelEnum.PUSH]: '📱',
      [NotificationChannelEnum.SMS]: '💬',
      [NotificationChannelEnum.WEBHOOK]: '🔗',
      [NotificationChannelEnum.SLACK]: '💬',
      [NotificationChannelEnum.TEAMS]: '👥',
      [NotificationChannelEnum.DISCORD]: '🎮',
    };

    return icons[this.value];
  }
}
