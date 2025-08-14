import { ValueObject } from './value-object';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

export class MetricsId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value?: string): MetricsId {
    const id = value || uuidv4();
    return new MetricsId(id);
  }

  static fromString(value: string): MetricsId {
    return MetricsId.create(value);
  }

  override toString(): string {
    return this.value;
  }

  protected validate(value: string): void {
    if (!value || typeof value !== 'string') {
      throw new Error('MetricsId value must be a non-empty string');
    }
    
    if (!uuidValidate(value)) {
      throw new Error('MetricsId must be a valid UUID');
    }
  }
}
