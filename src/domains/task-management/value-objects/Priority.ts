import { StringValueObject } from '../../../shared/domain/value-object';

export enum PriorityEnum {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class Priority extends StringValueObject {
  private constructor(value: PriorityEnum) {
    super(value);
  }

  public static create(priority: PriorityEnum): Priority {
    return new Priority(priority);
  }

  public static low(): Priority {
    return new Priority(PriorityEnum.LOW);
  }

  public static medium(): Priority {
    return new Priority(PriorityEnum.MEDIUM);
  }

  public static high(): Priority {
    return new Priority(PriorityEnum.HIGH);
  }

  public static critical(): Priority {
    return new Priority(PriorityEnum.CRITICAL);
  }

  protected validateString(value: string): void {
    if (!Object.values(PriorityEnum).includes(value as PriorityEnum)) {
      throw new Error(`Invalid priority: ${value}`);
    }
  }

  public getNumericValue(): number {
    const values = {
      [PriorityEnum.LOW]: 1,
      [PriorityEnum.MEDIUM]: 2,
      [PriorityEnum.HIGH]: 3,
      [PriorityEnum.CRITICAL]: 4,
    };
    return values[this.value as PriorityEnum];
  }

  public isHigherThan(other: Priority): boolean {
    return this.getNumericValue() > other.getNumericValue();
  }

  public isLowerThan(other: Priority): boolean {
    return this.getNumericValue() < other.getNumericValue();
  }

  public isCritical(): boolean {
    return this.value === PriorityEnum.CRITICAL;
  }

  public isHigh(): boolean {
    return this.value === PriorityEnum.HIGH;
  }

  public isMedium(): boolean {
    return this.value === PriorityEnum.MEDIUM;
  }

  public isLow(): boolean {
    return this.value === PriorityEnum.LOW;
  }

  public requiresUrgentAttention(): boolean {
    return [PriorityEnum.HIGH, PriorityEnum.CRITICAL].includes(
      this.value as PriorityEnum
    );
  }
}
