import { ValueObject } from '../../../shared/domain/value-object';
import { createId } from '@paralleldrive/cuid2';

export class NotificationId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  public static create(value: string): NotificationId {
    if (!value || value.trim().length === 0) {
      throw new Error('NotificationId cannot be empty');
    }

    return new NotificationId(value);
  }

  public static generate(): NotificationId {
    return new NotificationId(createId());
  }

  public get value(): string {
    return this.props;
  }

  public equals(other: NotificationId): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
