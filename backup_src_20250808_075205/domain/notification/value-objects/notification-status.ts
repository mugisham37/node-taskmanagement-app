import { ValueObject } from '../../shared/base/value-object';

export enum NotificationStatusEnum {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  PROCESSING = 'processing',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export class NotificationStatus extends ValueObject<NotificationStatusEnum> {
  private constructor(value: NotificationStatusEnum) {
    super(value);
  }

  public static create(value: string): NotificationStatus {
    const enumValue = Object.values(NotificationStatusEnum).find(
      status => status === value
    );

    if (!enumValue) {
      throw new Error(`Invalid notification status: ${value}`);
    }

    return new NotificationStatus(enumValue);
  }

  public static fromEnum(value: NotificationStatusEnum): NotificationStatus {
    return new NotificationStatus(value);
  }

  // Predefined statuses
  public static PENDING = new NotificationStatus(
    NotificationStatusEnum.PENDING
  );
  public static SCHEDULED = new NotificationStatus(
    NotificationStatusEnum.SCHEDULED
  );
  public static PROCESSING = new NotificationStatus(
    NotificationStatusEnum.PROCESSING
  );
  public static DELIVERED = new NotificationStatus(
    NotificationStatusEnum.DELIVERED
  );
  public static FAILED = new NotificationStatus(NotificationStatusEnum.FAILED);
  public static EXPIRED = new NotificationStatus(
    NotificationStatusEnum.EXPIRED
  );
  public static CANCELLED = new NotificationStatus(
    NotificationStatusEnum.CANCELLED
  );

  public get value(): NotificationStatusEnum {
    return this.props;
  }

  public equals(other: NotificationStatus): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }

  // Helper methods
  public isActive(): boolean {
    return [
      NotificationStatusEnum.PENDING,
      NotificationStatusEnum.SCHEDULED,
      NotificationStatusEnum.PROCESSING,
    ].includes(this.value);
  }

  public isCompleted(): boolean {
    return [
      NotificationStatusEnum.DELIVERED,
      NotificationStatusEnum.FAILED,
      NotificationStatusEnum.EXPIRED,
      NotificationStatusEnum.CANCELLED,
    ].includes(this.value);
  }

  public isSuccessful(): boolean {
    return this.value === NotificationStatusEnum.DELIVERED;
  }

  public canTransitionTo(newStatus: NotificationStatus): boolean {
    const validTransitions: Record<
      NotificationStatusEnum,
      NotificationStatusEnum[]
    > = {
      [NotificationStatusEnum.PENDING]: [
        NotificationStatusEnum.PROCESSING,
        NotificationStatusEnum.SCHEDULED,
        NotificationStatusEnum.CANCELLED,
        NotificationStatusEnum.EXPIRED,
      ],
      [NotificationStatusEnum.SCHEDULED]: [
        NotificationStatusEnum.PENDING,
        NotificationStatusEnum.PROCESSING,
        NotificationStatusEnum.CANCELLED,
        NotificationStatusEnum.EXPIRED,
      ],
      [NotificationStatusEnum.PROCESSING]: [
        NotificationStatusEnum.DELIVERED,
        NotificationStatusEnum.FAILED,
        NotificationStatusEnum.CANCELLED,
      ],
      [NotificationStatusEnum.DELIVERED]: [],
      [NotificationStatusEnum.FAILED]: [
        NotificationStatusEnum.PENDING,
        NotificationStatusEnum.PROCESSING,
        NotificationStatusEnum.CANCELLED,
      ],
      [NotificationStatusEnum.EXPIRED]: [],
      [NotificationStatusEnum.CANCELLED]: [],
    };

    return validTransitions[this.value]?.includes(newStatus.value) || false;
  }

  public getDisplayName(): string {
    const displayNames: Record<NotificationStatusEnum, string> = {
      [NotificationStatusEnum.PENDING]: 'Pending',
      [NotificationStatusEnum.SCHEDULED]: 'Scheduled',
      [NotificationStatusEnum.PROCESSING]: 'Processing',
      [NotificationStatusEnum.DELIVERED]: 'Delivered',
      [NotificationStatusEnum.FAILED]: 'Failed',
      [NotificationStatusEnum.EXPIRED]: 'Expired',
      [NotificationStatusEnum.CANCELLED]: 'Cancelled',
    };

    return displayNames[this.value];
  }

  public getColor(): string {
    const colors: Record<NotificationStatusEnum, string> = {
      [NotificationStatusEnum.PENDING]: '#6B7280',
      [NotificationStatusEnum.SCHEDULED]: '#3B82F6',
      [NotificationStatusEnum.PROCESSING]: '#F59E0B',
      [NotificationStatusEnum.DELIVERED]: '#10B981',
      [NotificationStatusEnum.FAILED]: '#EF4444',
      [NotificationStatusEnum.EXPIRED]: '#9CA3AF',
      [NotificationStatusEnum.CANCELLED]: '#6B7280',
    };

    return colors[this.value];
  }

  public getIcon(): string {
    const icons: Record<NotificationStatusEnum, string> = {
      [NotificationStatusEnum.PENDING]: '⏳',
      [NotificationStatusEnum.SCHEDULED]: '📅',
      [NotificationStatusEnum.PROCESSING]: '⚡',
      [NotificationStatusEnum.DELIVERED]: '✅',
      [NotificationStatusEnum.FAILED]: '❌',
      [NotificationStatusEnum.EXPIRED]: '⏰',
      [NotificationStatusEnum.CANCELLED]: '🚫',
    };

    return icons[this.value];
  }
}
