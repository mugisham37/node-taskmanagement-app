import { ValueObject } from '../../shared/base/value-object';
import { v4 as uuidv4 } from 'uuid';

export class WebhookId extends ValueObject<string> {
  constructor(value: string) {
    super(value);
    this.validate();
  }

  private validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new Error('Webhook ID cannot be empty');
    }

    // UUID validation
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(this.value)) {
      throw new Error('Webhook ID must be a valid UUID');
    }
  }

  static generate(): WebhookId {
    return new WebhookId(uuidv4());
  }

  static fromString(value: string): WebhookId {
    return new WebhookId(value);
  }
}
