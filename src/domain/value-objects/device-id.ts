import { ValueObject } from './value-object';

export interface DeviceIdProps {
  value: string;
}

export class DeviceId extends ValueObject<DeviceIdProps> {
  constructor(props: DeviceIdProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(value?: string): DeviceId {
    return new DeviceId({
      value: value || crypto.randomUUID(),
    });
  }

  public static fromString(value: string): DeviceId {
    if (!value || value.trim().length === 0) {
      throw new Error('DeviceId cannot be empty');
    }
    return new DeviceId({ value: value.trim() });
  }

  public equals(other: DeviceId): boolean {
    return this.props.value === other.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
