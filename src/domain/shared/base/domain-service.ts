export interface DomainService {
  readonly name: string;
}

export abstract class BaseDomainService implements DomainService {
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  protected validateNotNull<T>(
    value: T | null | undefined,
    paramName: string
  ): T {
    if (value === null || value === undefined) {
      throw new Error(`${paramName} cannot be null or undefined`);
    }
    return value;
  }

  protected validateNotEmpty(
    value: string | null | undefined,
    paramName: string
  ): string {
    const validated = this.validateNotNull(value, paramName);
    if (validated.trim().length === 0) {
      throw new Error(`${paramName} cannot be empty`);
    }
    return validated;
  }

  protected validatePositive(value: number, paramName: string): number {
    if (value <= 0) {
      throw new Error(`${paramName} must be positive`);
    }
    return value;
  }

  protected validateArray<T>(
    value: T[] | null | undefined,
    paramName: string
  ): T[] {
    const validated = this.validateNotNull(value, paramName);
    if (!Array.isArray(validated)) {
      throw new Error(`${paramName} must be an array`);
    }
    return validated;
  }

  protected validateNonEmptyArray<T>(
    value: T[] | null | undefined,
    paramName: string
  ): T[] {
    const validated = this.validateArray(value, paramName);
    if (validated.length === 0) {
      throw new Error(`${paramName} cannot be empty`);
    }
    return validated;
  }
}
