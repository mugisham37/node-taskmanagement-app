import { ValueObject } from '../../shared/value-objects/value-object';

export interface EventDateTimeProps {
  value: Date;
}

export class EventDateTime extends ValueObject<EventDateTimeProps> {
  private constructor(props: EventDateTimeProps) {
    super(props);
  }

  public static create(dateTime: Date): EventDateTime {
    if (!(dateTime instanceof Date) || isNaN(dateTime.getTime())) {
      throw new Error('Invalid date time provided');
    }

    return new EventDateTime({ value: new Date(dateTime) });
  }

  public get value(): Date {
    return new Date(this.props.value);
  }

  public isBefore(other: EventDateTime): boolean {
    return this.props.value < other.props.value;
  }

  public isAfter(other: EventDateTime): boolean {
    return this.props.value > other.props.value;
  }

  public equals(other: EventDateTime): boolean {
    return this.props.value.getTime() === other.props.value.getTime();
  }

  public addMinutes(minutes: number): EventDateTime {
    const newDate = new Date(this.props.value);
    newDate.setMinutes(newDate.getMinutes() + minutes);
    return EventDateTime.create(newDate);
  }

  public subtractMinutes(minutes: number): EventDateTime {
    const newDate = new Date(this.props.value);
    newDate.setMinutes(newDate.getMinutes() - minutes);
    return EventDateTime.create(newDate);
  }

  public toISOString(): string {
    return this.props.value.toISOString();
  }
}
