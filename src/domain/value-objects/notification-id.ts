import { ValueObject } from './value-object';

export interface NotificationIdProps {
  value: string;
}

export class NotificationId extends ValueObject<NotificationIdProps> {
  constructor(props: NotificationIdProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(value?: string): NotificationId {
    return new NotificationId({
      value: value || crypto.randomUUID(),
    });
  }

  public static fromString(value: string): NotificationId {
    if (!value || value.trim().length === 0) {
      throw new Error('NotificationId cannot be empty');
    }
    return new NotificationId({ value: value.trim() });
  }

  public equals(other: NotificationId): boolean {
    return this.props.value === other.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
