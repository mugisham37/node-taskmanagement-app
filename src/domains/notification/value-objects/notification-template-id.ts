import { ValueObject } from '../../../shared/domain/value-object';
import { createId } from '@paralleldrive/cuid2';

export class NotificationTemplateId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  public static create(value: string): NotificationTemplateId {
    if (!value || value.trim().length === 0) {
      throw new Error('NotificationTemplateId cannot be empty');
    }

    return new NotificationTemplateId(value);
  }

  public static generate(): NotificationTemplateId {
    return new NotificationTemplateId(createId());
  }

  public get value(): string {
    return this.props;
  }

  public equals(other: NotificationTemplateId): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
