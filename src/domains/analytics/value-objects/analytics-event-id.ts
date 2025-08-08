import { StringValueObject } from '../../../shared/domain/value-object';
import { randomUUID } from 'crypto';

export class AnalyticsEventId extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }

  public static create(id: string): AnalyticsEventId {
    return new AnalyticsEventId(id);
  }

  public static generate(): AnalyticsEventId {
    return new AnalyticsEventId(randomUUID());
  }

  protected validateString(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('AnalyticsEventId cannot be empty');
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value.trim())) {
      throw new Error('AnalyticsEventId must be a valid UUID');
    }
  }
}
