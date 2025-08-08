import { ValueObject } from '../../../shared/domain/value-objects/ValueObject';

export enum PriorityEnum {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export interface PriorityProps {
  value: PriorityEnum;
}

export class Priority extends ValueObject<PriorityProps> {
  private constructor(props: PriorityProps) {
    super(props);
  }

  public static create(value: PriorityEnum): Priority {
    return new Priority({ value });
  }

  public static fromString(value: string): Priority {
    const upperValue = value.toUpperCase();
    if (!Object.values(PriorityEnum).includes(upperValue as PriorityEnum)) {
      throw new Error(`Invalid priority: ${value}`);
    }
    return new Priority({ value: upperValue as PriorityEnum });
  }

  public static low(): Priority {
    return new Priority({ value: PriorityEnum.LOW });
  }

  public static medium(): Priority {
    return new Priority({ value: PriorityEnum.MEDIUM });
  }

  public static high(): Priority {
    return new Priority({ value: PriorityEnum.HIGH });
  }

  public static urgent(): Priority {
    return new Priority({ value: PriorityEnum.URGENT });
  }

  get value(): PriorityEnum {
    return this.props.value;
  }

  get numericValue(): number {
    return this.getNumericValue();
  }

  public equals(other: Priority): boolean {
    return this.props.value === other.props.value;
  }

  public toString(): string {
    return this.props.value;
  }

  public getNumericValue(): number {
    const priorityMap = {
      [PriorityEnum.LOW]: 1,
      [PriorityEnum.MEDIUM]: 2,
      [PriorityEnum.HIGH]: 3,
      [PriorityEnum.URGENT]: 4,
    };
    return priorityMap[this.props.value];
  }

  public isHigherThan(other: Priority): boolean {
    return this.getNumericValue() > other.getNumericValue();
  }

  public isLowerThan(other: Priority): boolean {
    return this.getNumericValue() < other.getNumericValue();
  }
}
