import { ValueObject } from '../../shared/value-objects/value-object';

export interface EventColorProps {
  value: string;
}

export class EventColor extends ValueObject<EventColorProps> {
  private constructor(props: EventColorProps) {
    super(props);
  }

  public static create(color: string): EventColor {
    if (!this.isValidHexColor(color)) {
      throw new Error(
        'Event color must be a valid hex color code (e.g., #FF0000)'
      );
    }

    return new EventColor({ value: color.toUpperCase() });
  }

  public get value(): string {
    return this.props.value;
  }

  private static isValidHexColor(color: string): boolean {
    const hexColorRegex = /^#[0-9A-F]{6}$/i;
    return hexColorRegex.test(color);
  }
}
