import { ValueObject } from '../../../shared/domain/value-object';

export enum NotificationPriorityEnum {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export class NotificationPriority extends ValueObject<NotificationPriorityEnum> {
  private constructor(value: NotificationPriorityEnum) {
    super(value);
  }

  public static create(value: string): NotificationPriority {
    const enumValue = Object.values(NotificationPriorityEnum).find(
      priority => priority === value
    );

    if (!enumValue) {
      throw new Error(`Invalid notification priority: ${value}`);
    }

    return new NotificationPriority(enumValue);
  }

  public static fromEnum(
    value: NotificationPriorityEnum
  ): NotificationPriority {
    return new NotificationPriority(value);
  }

  // Predefined priorities
  public static LOW = new NotificationPriority(NotificationPriorityEnum.LOW);
  public static NORMAL = new NotificationPriority(
    NotificationPriorityEnum.NORMAL
  );
  public static HIGH = new NotificationPriority(NotificationPriorityEnum.HIGH);
  public static URGENT = new NotificationPriority(
    NotificationPriorityEnum.URGENT
  );

  public get value(): NotificationPriorityEnum {
    return this.props;
  }

  public equals(other: NotificationPriority): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }

  // Helper methods
  public getNumericValue(): number {
    const values: Record<NotificationPriorityEnum, number> = {
      [NotificationPriorityEnum.LOW]: 1,
      [NotificationPriorityEnum.NORMAL]: 2,
      [NotificationPriorityEnum.HIGH]: 3,
      [NotificationPriorityEnum.URGENT]: 4,
    };

    return values[this.value];
  }

  public isHigherThan(other: NotificationPriority): boolean {
    return this.getNumericValue() > other.getNumericValue();
  }

  public isLowerThan(other: NotificationPriority): boolean {
    return this.getNumericValue() < other.getNumericValue();
  }

  public getColor(): string {
    const colors: Record<NotificationPriorityEnum, string> = {
      [NotificationPriorityEnum.LOW]: '#6B7280',
      [NotificationPriorityEnum.NORMAL]: '#3B82F6',
      [NotificationPriorityEnum.HIGH]: '#F59E0B',
      [NotificationPriorityEnum.URGENT]: '#EF4444',
    };

    return colors[this.value];
  }

  public getDisplayName(): string {
    const displayNames: Record<NotificationPriorityEnum, string> = {
      [NotificationPriorityEnum.LOW]: 'Low',
      [NotificationPriorityEnum.NORMAL]: 'Normal',
      [NotificationPriorityEnum.HIGH]: 'High',
      [NotificationPriorityEnum.URGENT]: 'Urgent',
    };

    return displayNames[this.value];
  }

  public getIcon(): string {
    const icons: Record<NotificationPriorityEnum, string> = {
      [NotificationPriorityEnum.LOW]: '🔵',
      [NotificationPriorityEnum.NORMAL]: '🟢',
      [NotificationPriorityEnum.HIGH]: '🟡',
      [NotificationPriorityEnum.URGENT]: '🔴',
    };

    return icons[this.value];
  }

  public shouldBypassQuietHours(): boolean {
    return this.value === NotificationPriorityEnum.URGENT;
  }

  public getRetryDelay(): number {
    // Return delay in milliseconds
    const delays: Record<NotificationPriorityEnum, number> = {
      [NotificationPriorityEnum.LOW]: 300000, // 5 minutes
      [NotificationPriorityEnum.NORMAL]: 60000, // 1 minute
      [NotificationPriorityEnum.HIGH]: 30000, // 30 seconds
      [NotificationPriorityEnum.URGENT]: 10000, // 10 seconds
    };

    return delays[this.value];
  }
}
