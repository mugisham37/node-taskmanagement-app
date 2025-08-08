import { ValueObject } from '../../shared/value-objects/value-object';

export interface CalendarNameProps {
  value: string;
}

export class CalendarName extends ValueObject<CalendarNameProps> {
  private constructor(props: CalendarNameProps) {
    super(props);
  }

  public static create(name: string): CalendarName {
    if (!name || name.trim().length === 0) {
      throw new Error('Calendar name cannot be empty');
    }

    if (name.length > 255) {
      throw new Error('Calendar name cannot exceed 255 characters');
    }

    return new CalendarName({ value: name.trim() });
  }

  public get value(): string {
    return this.props.value;
  }
}
