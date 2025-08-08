import { ValueObject } from '../../shared/value-objects/value-object';

export interface RecurrenceRuleProps {
  value: string;
}

export class RecurrenceRule extends ValueObject<RecurrenceRuleProps> {
  private constructor(props: RecurrenceRuleProps) {
    super(props);
  }

  public static create(rule: string): RecurrenceRule {
    if (rule.length > 500) {
      throw new Error('Recurrence rule cannot exceed 500 characters');
    }

    // Basic validation for RRULE format
    if (!this.isValidRRule(rule)) {
      throw new Error('Invalid recurrence rule format');
    }

    return new RecurrenceRule({ value: rule.trim() });
  }

  public get value(): string {
    return this.props.value;
  }

  private static isValidRRule(rule: string): boolean {
    // Basic RRULE validation - should start with RRULE: or be a valid RRULE string
    const rrulePattern =
      /^(RRULE:)?FREQ=(SECONDLY|MINUTELY|HOURLY|DAILY|WEEKLY|MONTHLY|YEARLY)/i;
    return rrulePattern.test(rule);
  }
}
