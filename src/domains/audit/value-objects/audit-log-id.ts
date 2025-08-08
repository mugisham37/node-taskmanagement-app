import { StringValueObject } from '../../../shared/domain/value-object';
import { randomUUID } from 'crypto';

export class AuditLogId extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }

  public static create(id: string): AuditLogId {
    return new AuditLogId(id);
  }

  public static generate(): AuditLogId {
    return new AuditLogId(randomUUID());
  }

  protected validateString(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('AuditLogId cannot be empty');
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value.trim())) {
      throw new Error('AuditLogId must be a valid UUID');
    }
  }
}
