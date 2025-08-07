import { ValueObject } from '../../shared/base/value-object';
import { createId } from '@paralleldrive/cuid2';

export class NotificationPreferencesId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  public static create(value: string): NotificationPreferencesId {
    if (!value || value.trim().length === 0) {
      throw new Error('NotificationPreferencesId cannot be empty');
    }

    return new NotificationPreferencesId(value);
  }

  public static generate(): NotificationPreferencesId {
    return new NotificationPreferencesId(createId());
  }

  public get value(): string {
    return this.props;
  }

  public equals(other: NotificationPreferencesId): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
