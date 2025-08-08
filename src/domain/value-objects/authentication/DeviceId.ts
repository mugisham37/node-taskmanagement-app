import { ValueObject } from '../../shared/value-objects/ValueObject';
import { cuid } from '@paralleldrive/cuid2';

export interface DeviceIdProps {
  value: string;
}

export class DeviceId extends ValueObject<DeviceIdProps> {
  private constructor(props: DeviceIdProps) {
    super(props);
  }

  public static create(value: string): DeviceId {
    if (!value || value.trim().length === 0) {
      throw new Error('DeviceId cannot be empty');
    }

    if (!this.isValid(value)) {
      throw new Error('Invalid DeviceId format');
    }

    return new DeviceId({ value: value.trim() });
  }

  public static generate(): DeviceId {
    return new DeviceId({ value: cuid() });
  }

  public static fromString(value: string): DeviceId {
    return this.create(value);
  }

  get value(): string {
    return this.props.value;
  }

  public equals(other: DeviceId): boolean {
    return this.props.value === other.props.value;
  }

  public toString(): string {
    return this.props.value;
  }

  private static isValid(value: string): boolean {
    // Basic validation for CUID format
    return /^[a-z0-9]{24,}$/.test(value);
  }
}
