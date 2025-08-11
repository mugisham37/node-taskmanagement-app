import { ValueObject } from './value-object';

export class CalendarEventId extends ValueObject<string> {
  constructor(value: string) {
    super(value);
    this.validate();
  }

  static create(value?: string): CalendarEventId {
    return new CalendarEventId(value || crypto.randomUUID());
  }

  static fromString(value: string): CalendarEventId {
    return new CalendarEventId(value);
  }

  protected validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new Error('Calendar Event ID cannot be empty');
    }
  }

  override toString(): string {
    return this.value;
  }

  override equals(other: CalendarEventId): boolean {
    return this.value === other.value;
  }
}
