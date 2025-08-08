import { ValueObject } from '../../shared/value-objects/value-object';

export enum CalendarProviderType {
  GOOGLE = 'google',
  MICROSOFT = 'microsoft',
  APPLE = 'apple',
  OTHER = 'other',
}

export interface CalendarProviderProps {
  value: CalendarProviderType;
}

export class CalendarProvider extends ValueObject<CalendarProviderProps> {
  private constructor(props: CalendarProviderProps) {
    super(props);
  }

  public static create(provider: string): CalendarProvider {
    const normalizedProvider = provider.toLowerCase();

    if (
      !Object.values(CalendarProviderType).includes(
        normalizedProvider as CalendarProviderType
      )
    ) {
      throw new Error(
        `Invalid calendar provider: ${provider}. Must be one of: ${Object.values(CalendarProviderType).join(', ')}`
      );
    }

    return new CalendarProvider({
      value: normalizedProvider as CalendarProviderType,
    });
  }

  public get value(): CalendarProviderType {
    return this.props.value;
  }

  public isGoogle(): boolean {
    return this.props.value === CalendarProviderType.GOOGLE;
  }

  public isMicrosoft(): boolean {
    return this.props.value === CalendarProviderType.MICROSOFT;
  }

  public isApple(): boolean {
    return this.props.value === CalendarProviderType.APPLE;
  }

  public getDisplayName(): string {
    switch (this.props.value) {
      case CalendarProviderType.GOOGLE:
        return 'Google Calendar';
      case CalendarProviderType.MICROSOFT:
        return 'Microsoft Outlook';
      case CalendarProviderType.APPLE:
        return 'Apple Calendar';
      case CalendarProviderType.OTHER:
        return 'Other';
      default:
        return 'Unknown';
    }
  }
}
