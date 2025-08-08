import { ValueObject } from '../../shared/value-objects/value-object';

export interface EventLocationProps {
  value: string;
}

export class EventLocation extends ValueObject<EventLocationProps> {
  private constructor(props: EventLocationProps) {
    super(props);
  }

  public static create(location: string): EventLocation {
    if (location.length > 500) {
      throw new Error('Event location cannot exceed 500 characters');
    }

    return new EventLocation({ value: location.trim() });
  }

  public get value(): string {
    return this.props.value;
  }
}
