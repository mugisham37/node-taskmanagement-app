import { ValueObject } from './value-object';

export interface RecurrenceRuleOptions {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  count?: number | undefined;
  until?: Date | undefined;
  byWeekDay?: number[] | undefined;
  byMonthDay?: number[] | undefined;
  byMonth?: number[] | undefined;
}

export class RecurrenceRule extends ValueObject<RecurrenceRuleOptions> {
  constructor(value: RecurrenceRuleOptions) {
    super(value);
    this.validate();
  }

  static create(options: RecurrenceRuleOptions): RecurrenceRule {
    return new RecurrenceRule(options);
  }

  protected validate(): void {
    if (!this.value.frequency) {
      throw new Error('Frequency is required for recurrence rule');
    }
    if (this.value.interval <= 0) {
      throw new Error('Interval must be greater than 0');
    }
    if (this.value.count !== undefined && this.value.count <= 0) {
      throw new Error('Count must be greater than 0');
    }
  }

  get frequency(): string {
    return this.value.frequency;
  }

  get interval(): number {
    return this.value.interval;
  }

  get count(): number | undefined {
    return this.value.count;
  }

  get until(): Date | undefined {
    return this.value.until;
  }

  get byWeekDay(): number[] | undefined {
    return this.value.byWeekDay;
  }

  get byMonthDay(): number[] | undefined {
    return this.value.byMonthDay;
  }

  get byMonth(): number[] | undefined {
    return this.value.byMonth;
  }

  override toString(): string {
    return JSON.stringify(this.value);
  }

  override equals(other: RecurrenceRule): boolean {
    return JSON.stringify(this.value) === JSON.stringify(other.value);
  }
}
