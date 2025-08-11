import { ValueObject } from './value-object';

export class AuditLogId extends ValueObject<string> {
  constructor(value: string) {
    super(value);
    this.validate();
  }

  static create(value?: string): AuditLogId {
    return new AuditLogId(value || crypto.randomUUID());
  }

  static fromString(value: string): AuditLogId {
    return new AuditLogId(value);
  }

  protected validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new Error('Audit Log ID cannot be empty');
    }
  }

  override toString(): string {
    return this.value;
  }

  override equals(other: AuditLogId): boolean {
    return this.value === other.value;
  }
}
