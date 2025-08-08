import { randomUUID } from 'crypto';

export class RoleId {
  private constructor(private readonly _value: string) {
    if (!_value || _value.trim().length === 0) {
      throw new Error('RoleId cannot be empty');
    }
  }

  public static create(value: string): RoleId {
    return new RoleId(value);
  }

  public static generate(): RoleId {
    return new RoleId(randomUUID());
  }

  public get value(): string {
    return this._value;
  }

  public equals(other: RoleId): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}
