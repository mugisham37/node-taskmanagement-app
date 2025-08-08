import { ValueObject } from '../../shared/value-objects/value-object';

export interface EventTitleProps {
  value: string;
}

export class EventTitle extends ValueObject<EventTitleProps> {
  private constructor(props: EventTitleProps) {
    super(props);
  }

  public static create(title: string): EventTitle {
    if (!title || title.trim().length === 0) {
      throw new Error('Event title cannot be empty');
    }

    if (title.length > 200) {
      throw new Error('Event title cannot exceed 200 characters');
    }

    return new EventTitle({ value: title.trim() });
  }

  public get value(): string {
    return this.props.value;
  }
}
