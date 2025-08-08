import { ValueObject } from '../../shared/value-objects/value-object';
import { v4 as uuidv4 } from 'uuid';

export interface CalendarIntegrationIdProps {
  value: string;
}

export class CalendarIntegrationId extends ValueObject<CalendarIntegrationIdProps> {
  private constructor(props: CalendarIntegrationIdProps) {
    super(props);
  }

  public static create(id?: string): CalendarIntegrationId {
    const value = id || uuidv4();

    if (!this.isValidUuid(value)) {
      throw new Error('Invalid calendar integration ID format');
    }

    return new CalendarIntegrationId({ value });
  }

  public get value(): string {
    return this.props.value;
  }

  public equals(other: CalendarIntegrationId): boolean {
    return this.props.value === other.props.value;
  }

  private static isValidUuid(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
