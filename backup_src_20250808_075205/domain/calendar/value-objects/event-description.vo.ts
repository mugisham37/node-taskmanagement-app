import { ValueObject } from '../../shared/value-objects/value-object';

export interface EventDescriptionProps {
  value: string;
}

export class EventDescription extends ValueObject<EventDescriptionProps> {
  private constructor(props: EventDescriptionProps) {
    super(props);
  }

  public static create(description: string): EventDescription {
    if (description.length > 1000) {
      throw new Error('Event description cannot exceed 1000 characters');
    }

    return new EventDescription({ value: description.trim() });
  }

  public get value(): string {
    return this.props.value;
  }
}
